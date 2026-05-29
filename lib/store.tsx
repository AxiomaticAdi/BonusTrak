"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { toast } from "sonner";
import type { AppData, Goal, HoursEntry, HoursEntryInput, PaceMode, TimeOff } from "./types";
import { isValidEntry } from "./calculations";
import { supabase } from "./supabase";
import { useAuth } from "@/components/auth/supabase-provider";

const EMPTY: AppData = { goal: null, entries: [], timeOff: [] };

/** Debounce window (ms) before a data change is pushed to Supabase. Tune freely. */
const SAVE_DEBOUNCE_MS = 600;
/** Max automatic retries for a failed save before surfacing a toast. */
const MAX_SAVE_RETRIES = 5;

function genId(): string {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface UserRow {
	data: Partial<AppData> | null;
	pace_mode: string | null;
}

interface StoreValue {
	data: AppData;
	hydrated: boolean;
	/**
	 * True when the signed-in login has no `logins` mapping to a person (or the
	 * mapped person row is gone). The login can see no data; linking is admin-only.
	 */
	unlinked: boolean;
	/** False when the browser reports no network; UI shows a sync banner. */
	online: boolean;
	paceMode: PaceMode;
	setPaceMode: (m: PaceMode) => void;
	setGoal: (g: Goal) => void;
	addEntry: (e: HoursEntryInput) => void;
	updateEntry: (id: string, next: HoursEntryInput) => void;
	deleteEntry: (id: string) => void;
	addTimeOff: (t: Omit<TimeOff, "id">) => void;
	updateTimeOff: (id: string, patch: Partial<Omit<TimeOff, "id">>) => void;
	deleteTimeOff: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
	const { session } = useAuth();
	// The raw Supabase auth identity (a *login*). Distinct from the resolved
	// person id (a *user*) held in userIdRef below.
	const authUserId = session?.user.id ?? null;

	const [data, setData] = useState<AppData>(EMPTY);
	const [paceMode, setPaceModeState] = useState<PaceMode>("trailing");
	const [hydrated, setHydrated] = useState(false);
	const [unlinked, setUnlinked] = useState(false);
	const [online, setOnline] = useState(true);

	// Always-current snapshot so saves/retries send the LATEST blob (never stale).
	const dataRef = useRef<AppData>(data);
	useEffect(() => {
		dataRef.current = data;
	}, [data]);

	// Resolved person id (users.id) this login maps to, or null when unlinked.
	// Held in a ref so saves/retries target the right row even across re-renders.
	const userIdRef = useRef<string | null>(null);

	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dirtyRef = useRef(false); // unsaved local edits exist
	const applyingServerRef = useRef(false); // next data change came from the server, not the user
	const loadIdRef = useRef(0); // guards against overlapping loads

	// --- Apply a server row to local state ---------------------------------
	const applyRow = useCallback((row: UserRow) => {
		applyingServerRef.current = true;
		const parsed = (row.data ?? {}) as Partial<AppData>;
		// Filter entries through the shape guard so a stale old-shape row (we don't
		// migrate — the user re-enters) can't crash the span math downstream.
		setData({
			goal: parsed.goal ?? null,
			entries: Array.isArray(parsed.entries) ? parsed.entries.filter(isValidEntry) : [],
			timeOff: Array.isArray(parsed.timeOff) ? parsed.timeOff : [],
		});
		if (row.pace_mode === "trailing" || row.pace_mode === "ytd") {
			setPaceModeState(row.pace_mode);
		}
	}, []);

	// --- Load from Supabase -------------------------------------------------
	// Two-step: resolve the login -> person mapping, then load that person's row.
	const load = useCallback(async () => {
		if (!authUserId) return;
		if (dirtyRef.current) return; // never clobber unsaved local edits
		const myLoadId = ++loadIdRef.current;

		// Resolve which person (users.id) this login maps to.
		const { data: loginRow, error: loginErr } = await supabase
			.from("logins")
			.select("user_id")
			.eq("auth_user_id", authUserId)
			.maybeSingle();

		if (myLoadId !== loadIdRef.current) return; // a newer load superseded this one

		if (loginErr) {
			console.error("[bonustrak] login lookup failed:", loginErr);
			toast.error("Couldn't load your data.");
			setHydrated(true);
			return;
		}

		if (!loginRow) {
			// Authenticated with Google but not linked to a person yet. RLS denies
			// all data; an admin must insert the logins mapping by hand.
			userIdRef.current = null;
			setUnlinked(true);
			setHydrated(true);
			return;
		}

		const resolvedUserId = (loginRow as { user_id: string }).user_id;
		userIdRef.current = resolvedUserId;
		setUnlinked(false);

		const { data: row, error } = await supabase
			.from("users")
			.select("data, pace_mode")
			.eq("id", resolvedUserId)
			.maybeSingle();

		if (myLoadId !== loadIdRef.current) return;

		if (error) {
			console.error("[bonustrak] load failed:", error);
			toast.error("Couldn't load your data.");
			setHydrated(true);
			return;
		}

		if (!row) {
			// Mapped, but the person row is gone (e.g. admin deleted it mid-session).
			// Treat as unlinked rather than a broken, silently-no-op editable session.
			userIdRef.current = null;
			setUnlinked(true);
			setHydrated(true);
			return;
		}

		applyRow(row as UserRow);
		setHydrated(true);
	}, [authUserId, applyRow]);

	// Reset and reload whenever the signed-in login changes. Clearing data/pace/
	// unlinked here (not just hydrated) ensures one account's state can never
	// render — or be saved into — under another account if a load later fails.
	useEffect(() => {
		setHydrated(false);
		setUnlinked(false);
		dirtyRef.current = false;
		userIdRef.current = null;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		applyingServerRef.current = true;
		setData(EMPTY);
		setPaceModeState("trailing");
		void load();
	}, [load]);

	// Re-fetch when the tab regains focus / becomes visible (dirty-guard inside load).
	useEffect(() => {
		function onFocus() {
			void load();
		}
		function onVisible() {
			if (!document.hidden) void load();
		}
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [load]);

	// --- Save to Supabase ---------------------------------------------------
	// Always sends dataRef.current (latest), so a retry cannot resurrect a stale
	// blob over a newer one. The save UPDATEs an existing users row (the admin
	// pre-creates it; the client never inserts). targetUid is captured when the
	// save is scheduled so a retry can't write to a row we no longer own after an
	// account/link switch. update().select("id") lets us detect a zero-row update
	// (RLS-blocked or row deleted) that PostgREST reports without an error.
	const flushData = useCallback(
		async (attempt = 0, targetUid: string | null = userIdRef.current) => {
			if (!targetUid) return;
			if (userIdRef.current !== targetUid) return; // auth/link changed since scheduled

			const { data: updated, error } = await supabase
				.from("users")
				.update({
					data: dataRef.current,
					updated_at: new Date().toISOString(),
				})
				.eq("id", targetUid)
				.select("id");

			const noRows = !updated || updated.length === 0;
			if (error || noRows) {
				console.error("[bonustrak] save failed:", error ?? "0 rows updated");
				if (userIdRef.current !== targetUid) return; // don't retry a row we no longer own
				if (attempt < MAX_SAVE_RETRIES) {
					if (saveTimer.current) clearTimeout(saveTimer.current);
					saveTimer.current = setTimeout(
						() => void flushData(attempt + 1, targetUid),
						SAVE_DEBOUNCE_MS * 2,
					);
				} else {
					toast.error(
						"Couldn't save your changes — they'll sync when you reconnect.",
					);
				}
				return;
			}
			dirtyRef.current = false;
		},
		[],
	);

	// Debounced persist whenever the USER changes data (after hydration).
	useEffect(() => {
		if (!hydrated || !userIdRef.current) return;
		if (applyingServerRef.current) {
			applyingServerRef.current = false; // change came from a server load; don't echo it back
			return;
		}
		dirtyRef.current = true;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => void flushData(), SAVE_DEBOUNCE_MS);
		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		};
	}, [data, hydrated, flushData]);

	// Track online/offline. On reconnect, flush pending edits or reload.
	useEffect(() => {
		function up() {
			setOnline(true);
			if (dirtyRef.current) void flushData();
			else void load();
		}
		function down() {
			setOnline(false);
		}
		setOnline(navigator.onLine);
		window.addEventListener("online", up);
		window.addEventListener("offline", down);
		return () => {
			window.removeEventListener("online", up);
			window.removeEventListener("offline", down);
		};
	}, [load, flushData]);

	// --- Mutations (public interface unchanged) -----------------------------
	// pace_mode uses update().eq() (not the debounced data path) so it can never
	// touch the data column. select("id") detects a zero-row update; pace stays
	// fire-and-forget (a transient failure just toasts, no retry/offline replay).
	const setPaceMode = useCallback((m: PaceMode) => {
		setPaceModeState(m);
		const uid = userIdRef.current;
		if (!uid) return;
		void supabase
			.from("users")
			.update({ pace_mode: m, updated_at: new Date().toISOString() })
			.eq("id", uid)
			.select("id")
			.then(({ data: updated, error }) => {
				if (error || !updated || updated.length === 0) {
					console.error(
						"[bonustrak] pace save failed:",
						error ?? "0 rows updated",
					);
					toast.error("Couldn't save pace mode.");
				}
			});
	}, []);

	const setGoal = useCallback((g: Goal) => {
		setData((prev) => ({ ...prev, goal: g }));
	}, []);

	const addEntry = useCallback((e: HoursEntryInput) => {
		setData((prev) => ({
			...prev,
			entries: [...prev.entries, { ...e, id: genId() } as HoursEntry],
		}));
	}, []);

	// Whole-entry replace (not a shallow merge): a discriminated union can't be
	// safely Partial-patched across kinds, since a kind change would leave a stale
	// anchor field behind. The edit dialog always supplies a complete entry.
	const updateEntry = useCallback((id: string, next: HoursEntryInput) => {
		setData((prev) => ({
			...prev,
			entries: prev.entries.map((e) =>
				e.id === id ? ({ ...next, id } as HoursEntry) : e,
			),
		}));
	}, []);

	const deleteEntry = useCallback((id: string) => {
		setData((prev) => ({
			...prev,
			entries: prev.entries.filter((e) => e.id !== id),
		}));
	}, []);

	const addTimeOff = useCallback((t: Omit<TimeOff, "id">) => {
		setData((prev) => ({
			...prev,
			timeOff: [...prev.timeOff, { ...t, id: genId() }],
		}));
	}, []);

	const updateTimeOff = useCallback(
		(id: string, patch: Partial<Omit<TimeOff, "id">>) => {
			setData((prev) => ({
				...prev,
				timeOff: prev.timeOff.map((t) =>
					t.id === id ? { ...t, ...patch } : t,
				),
			}));
		},
		[],
	);

	const deleteTimeOff = useCallback((id: string) => {
		setData((prev) => ({
			...prev,
			timeOff: prev.timeOff.filter((t) => t.id !== id),
		}));
	}, []);

	const value: StoreValue = {
		data,
		hydrated,
		unlinked,
		online,
		paceMode,
		setPaceMode,
		setGoal,
		addEntry,
		updateEntry,
		deleteEntry,
		addTimeOff,
		updateTimeOff,
		deleteTimeOff,
	};

	return (
		<StoreContext.Provider value={value}>{children}</StoreContext.Provider>
	);
}

export function useStore(): StoreValue {
	const ctx = useContext(StoreContext);
	if (!ctx) throw new Error("useStore must be used within StoreProvider");
	return ctx;
}
