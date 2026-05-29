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
import type { AppData, Goal, HoursEntry, PaceMode, TimeOff } from "./types";
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

interface UserDataRow {
	data: Partial<AppData> | null;
	pace_mode: string | null;
}

interface StoreValue {
	data: AppData;
	hydrated: boolean;
	/** False when the browser reports no network; UI shows a sync banner. */
	online: boolean;
	paceMode: PaceMode;
	setPaceMode: (m: PaceMode) => void;
	setGoal: (g: Goal) => void;
	addEntry: (e: Omit<HoursEntry, "id">) => void;
	updateEntry: (id: string, patch: Partial<Omit<HoursEntry, "id">>) => void;
	deleteEntry: (id: string) => void;
	addTimeOff: (t: Omit<TimeOff, "id">) => void;
	updateTimeOff: (id: string, patch: Partial<Omit<TimeOff, "id">>) => void;
	deleteTimeOff: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
	const { session } = useAuth();
	const userId = session?.user.id ?? null;

	const [data, setData] = useState<AppData>(EMPTY);
	const [paceMode, setPaceModeState] = useState<PaceMode>("trailing");
	const [hydrated, setHydrated] = useState(false);
	const [online, setOnline] = useState(true);

	// Always-current snapshot so saves/retries send the LATEST blob (never stale).
	const dataRef = useRef<AppData>(data);
	useEffect(() => {
		dataRef.current = data;
	}, [data]);

	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dirtyRef = useRef(false); // unsaved local edits exist
	const applyingServerRef = useRef(false); // next data change came from the server, not the user
	const loadIdRef = useRef(0); // guards against overlapping loads

	// --- Apply a server row to local state ---------------------------------
	const applyRow = useCallback((row: UserDataRow) => {
		applyingServerRef.current = true;
		const parsed = (row.data ?? {}) as Partial<AppData>;
		setData({
			goal: parsed.goal ?? null,
			entries: Array.isArray(parsed.entries) ? parsed.entries : [],
			timeOff: Array.isArray(parsed.timeOff) ? parsed.timeOff : [],
		});
		if (row.pace_mode === "trailing" || row.pace_mode === "ytd") {
			setPaceModeState(row.pace_mode);
		}
	}, []);

	// --- Load from Supabase -------------------------------------------------
	const load = useCallback(async () => {
		if (!userId) return;
		if (dirtyRef.current) return; // never clobber unsaved local edits
		const myLoadId = ++loadIdRef.current;

		const { data: row, error } = await supabase
			.from("user_data")
			.select("data, pace_mode")
			.eq("user_id", userId)
			.maybeSingle();

		if (myLoadId !== loadIdRef.current) return; // a newer load superseded this one

		if (error) {
			console.error("[bonustrak] load failed:", error);
			toast.error("Couldn't load your data.");
			setHydrated(true);
			return;
		}

		if (row) {
			applyRow(row as UserDataRow);
			setHydrated(true);
			return;
		}

		// No row yet: create the default row for this account.
		const { error: insertErr } = await supabase
			.from("user_data")
			.insert({ user_id: userId });
		if (insertErr) {
			// Another tab likely inserted first — reselect rather than assume empty.
			const { data: reRow } = await supabase
				.from("user_data")
				.select("data, pace_mode")
				.eq("user_id", userId)
				.maybeSingle();
			if (myLoadId !== loadIdRef.current) return;
			if (reRow) {
				applyRow(reRow as UserDataRow);
			} else {
				applyingServerRef.current = true;
				setData(EMPTY);
				setPaceModeState("trailing");
			}
		} else {
			applyingServerRef.current = true;
			setData(EMPTY);
			setPaceModeState("trailing");
		}
		setHydrated(true);
	}, [userId, applyRow]);

	// Load whenever the signed-in user changes.
	useEffect(() => {
		setHydrated(false);
		dirtyRef.current = false;
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
	// blob over a newer one. Retries up to MAX_SAVE_RETRIES, then toasts.
	const flushData = useCallback(
		async (attempt = 0) => {
			if (!userId) return;
			const { error } = await supabase
				.from("user_data")
				.upsert({
					user_id: userId,
					data: dataRef.current,
					updated_at: new Date().toISOString(),
				});
			if (error) {
				console.error("[bonustrak] save failed:", error);
				if (attempt < MAX_SAVE_RETRIES) {
					if (saveTimer.current) clearTimeout(saveTimer.current);
					saveTimer.current = setTimeout(
						() => void flushData(attempt + 1),
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
		[userId],
	);

	// Debounced persist whenever the USER changes data (after hydration).
	useEffect(() => {
		if (!hydrated || !userId) return;
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
	}, [data, hydrated, userId, flushData]);

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
	// pace_mode uses update().eq() (not a partial upsert) so it can never touch
	// the data column. The row exists post-hydration (load inserts it).
	const setPaceMode = useCallback(
		(m: PaceMode) => {
			setPaceModeState(m);
			if (!userId) return;
			void supabase
				.from("user_data")
				.update({ pace_mode: m, updated_at: new Date().toISOString() })
				.eq("user_id", userId)
				.then(({ error }) => {
					if (error) {
						console.error("[bonustrak] pace save failed:", error);
						toast.error("Couldn't save pace mode.");
					}
				});
		},
		[userId],
	);

	const setGoal = useCallback((g: Goal) => {
		setData((prev) => ({ ...prev, goal: g }));
	}, []);

	const addEntry = useCallback((e: Omit<HoursEntry, "id">) => {
		setData((prev) => ({
			...prev,
			entries: [...prev.entries, { ...e, id: genId() }],
		}));
	}, []);

	const updateEntry = useCallback(
		(id: string, patch: Partial<Omit<HoursEntry, "id">>) => {
			setData((prev) => ({
				...prev,
				entries: prev.entries.map((e) =>
					e.id === id ? { ...e, ...patch } : e,
				),
			}));
		},
		[],
	);

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
