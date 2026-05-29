# Supabase Cross-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BonusTrak's per-browser `localStorage` persistence with Supabase (magic-link auth + a single JSON row per user) so a signed-in user sees the same data on every device.

**Architecture:** The app stays client-rendered with the existing React Context store. A new `SupabaseProvider` holds the auth session; an `AuthGate` shows a magic-link login screen until signed in; `StoreProvider` (rewritten internals) loads the user's row on mount/focus and saves the whole `AppData` blob with a debounced, retrying `upsert` that always sends the latest data. A dirty-guard prevents refetches from clobbering unsaved edits. Row-Level Security ties each row to its user. No Next.js API routes.

**Tech Stack:** Next.js 16 (App Router), React 19, `@supabase/supabase-js`, Supabase (Postgres + Auth + RLS), Tailwind v4, shadcn/ui, Sonner.

**Spec:** `docs/superpowers/specs/2026-05-29-supabase-cross-device-sync-design.md`

**Review history:** This plan was revised after an adversarial Codex review (2026-05-29). Folded-in fixes: dirty-guard against focus-refetch clobber, bounded/latest-snapshot retry, `shouldCreateUser: false`, first-row insert-race reselect, load sequencing, settings hydration gate, offline edit + sync-on-reconnect, pace saved via `update().eq()`. Corrected stale facts: the project **is** a git repo and `.env.local` is already gitignored.

---

## Notes for the implementer

- **This project has no test suite** and the spec keeps it that way. Verification is `npx tsc --noEmit` (the real type gate — `npm run build` ignores type errors per `next.config.mjs:2-5`), `npm run build`, and manual browser checks. There are no unit-test steps.
- **Git:** the project **is** already a git repository and `.gitignore:18-19` already ignores `.env.local`. Commit steps are real; nothing special to set up.
- All localStorage code is being **removed**, not kept as a fallback (per spec).
- The store's public interface gains exactly one field, `online: boolean`. All existing mutation signatures are unchanged. One consumer area (settings) needs a hydration gate — see Task 9.
- **Setup already done:** the Supabase project exists and `.env.local` is populated with the real URL + publishable key (Task 2 Step 5 ✅). The remaining Task 2 dashboard steps (SQL table + RLS, disable sign-ups, redirect URL, create the two users — Steps 1-4) must be confirmed before Task 12 runtime verification; the code tasks (1, 3-11) do not depend on them.

---

## File Structure

- **Create** `lib/supabase.ts` — the browser Supabase client (singleton).
- **Create** `components/auth/supabase-provider.tsx` — holds the auth `session`, exposes `useAuth()`.
- **Create** `components/auth/login-screen.tsx` — magic-link sign-in form (`shouldCreateUser: false`).
- **Create** `components/auth/auth-gate.tsx` — loading / login / app switch.
- **Create** `components/offline-indicator.tsx` — fixed banner shown when offline.
- **Create** `components/settings/settings-content.tsx` — client wrapper gating settings sections on `hydrated`.
- ~~**Create** `.env.local`~~ — **already created & populated** with real URL + publishable key (gitignored, untracked). Do not overwrite.
- **Modify** `lib/store.tsx` — swap localStorage for Supabase load/save; add `online`, dirty-guard, retry, reconnect sync.
- **Modify** `app/layout.tsx` — wrap tree in `SupabaseProvider` → `AuthGate`, add `OfflineIndicator`.
- **Modify** `app/settings/page.tsx` — render `SettingsContent` instead of the three sections directly.
- **Modify** `package.json` — add `@supabase/supabase-js` dependency.
- **Modify** `CLAUDE.md` — update the "no backend" / localStorage sections.
- **External (Supabase dashboard, Task 2):** create `user_data` table + RLS policy, enable email auth, disable public sign-ups, create the two users.

---

### Task 1: Install the Supabase client

**Files:**

- Modify: `package.json` (dependency added by npm)

- [ ] **Step 1: Install the dependency**

Run:

```bash
npm install @supabase/supabase-js
```

Expected: `package.json` gains `"@supabase/supabase-js"` under `dependencies`; `package-lock.json` updates; exit 0.

- [ ] **Step 2: Verify it resolves**

Run:

```bash
node -e "require('@supabase/supabase-js'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/supabase-js"
```

---

### Task 2: Provision Supabase (external — dashboard) and local env

Performed in the Supabase dashboard; later code tasks depend on it. Record the result in `.env.local`.

**Files:**

- Create: `.env.local` (already covered by `.gitignore:18-19`)

- [ ] **Step 1: Create a Supabase project**

In the Supabase dashboard, create a project. Note the **Project URL** and **anon public key** from Project Settings → API.

- [ ] **Step 2: Create the table and RLS policy**

In the dashboard SQL editor, run:

```sql
create table user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{"goal":null,"entries":[],"timeOff":[]}',
  pace_mode  text  not null default 'trailing',
  updated_at timestamptz not null default now()
);

alter table user_data enable row level security;

create policy "own row" on user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Configure auth**

In Authentication → Providers, ensure **Email** is enabled (magic link on by default).
In Authentication → settings, **turn OFF "Allow new users to sign up."**
In Authentication → URL Configuration, add redirect URLs: `http://localhost:3000` (dev) and the production origin.

- [ ] **Step 4: Create the two users**

In Authentication → Users → "Add user", create the two accounts (email + "Auto Confirm User"). These are the only emails that can request a working magic link.

- [x] **Step 5: Write `.env.local` — ALREADY DONE**

`.env.local` is **already created and populated** with the real `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a `sb_publishable_…` key — Supabase's newer
client-side key, which is the correct value for this var). It is gitignored
(`.gitignore:18-19`) and untracked. **Do not recreate or overwrite it.** Confirm only:
`git check-ignore .env.local` → expect `.env.local`, and that the file has both
non-placeholder values.

---

### Task 3: Supabase browser client

**Files:**

- Create: `lib/supabase.ts`

- [ ] **Step 1: Write the client**

Create `lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
	throw new Error(
		"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
			"Add them to .env.local (see docs/superpowers/specs/2026-05-29-supabase-cross-device-sync-design.md).",
	);
}

/**
 * Singleton browser client. The anon key is safe client-side because RLS
 * enforces per-user access. detectSessionInUrl completes the magic-link
 * exchange on redirect.
 *
 * NOTE (PKCE caveat): the default PKCE flow requires the magic link to be
 * opened in the SAME browser that requested it. If cross-browser link opening
 * is needed, add `flowType: "implicit"` to the auth options below (verified in
 * Task 12 Step 4).
 */
export const supabase = createClient(url, anonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/supabase.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add Supabase browser client"
```

---

### Task 4: Auth session provider

**Files:**

- Create: `components/auth/supabase-provider.tsx`

- [ ] **Step 1: Write the provider**

Create `components/auth/supabase-provider.tsx`:

```tsx
"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthValue {
	/** Current Supabase session, or null when signed out. */
	session: Session | null;
	/** True until the initial session check resolves. */
	loading: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		supabase.auth.getSession().then(({ data }) => {
			if (!mounted) return;
			setSession(data.session);
			setLoading(false);
		});

		const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
			setSession(s);
		});

		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	return (
		<AuthContext.Provider value={{ session, loading }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within SupabaseProvider");
	return ctx;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/auth/supabase-provider.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/auth/supabase-provider.tsx
git commit -m "feat: add Supabase auth session provider"
```

---

### Task 5: Magic-link login screen

**Files:**

- Create: `components/auth/login-screen.tsx`

- [ ] **Step 1: Write the login screen**

Create `components/auth/login-screen.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginScreen() {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);

	async function sendLink(e: FormEvent) {
		e.preventDefault();
		setStatus("sending");
		setError(null);
		// shouldCreateUser: false — an unknown/typo'd email cannot silently create
		// an account; Supabase returns an error instead (belt-and-suspenders with
		// the dashboard "disable sign-ups" setting).
		const { error } = await supabase.auth.signInWithOtp({
			email: email.trim(),
			options: {
				shouldCreateUser: false,
				emailRedirectTo: window.location.origin,
			},
		});
		if (error) {
			setError(error.message);
			setStatus("error");
		} else {
			setStatus("sent");
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-center">BonusTrak</CardTitle>
				</CardHeader>
				<CardContent>
					{status === "sent" ? (
						<p className="text-center text-sm text-muted-foreground">
							Check your email for a sign-in link, then return here. Open the
							link in this same browser.
						</p>
					) : (
						<form onSubmit={sendLink} className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Enter your email to get a magic sign-in link. Syncs your hours
								across devices.
							</p>
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									required
									autoFocus
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
								/>
							</div>
							<Button
								type="submit"
								className="w-full"
								disabled={status === "sending"}
							>
								{status === "sending" ? "Sending…" : "Send magic link"}
							</Button>
							{error && <p className="text-sm text-destructive">{error}</p>}
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/auth/login-screen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-screen.tsx
git commit -m "feat: add magic-link login screen"
```

---

### Task 6: Auth gate

**Files:**

- Create: `components/auth/auth-gate.tsx`

- [ ] **Step 1: Write the gate**

Create `components/auth/auth-gate.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { useAuth } from "./supabase-provider";
import { LoginScreen } from "./login-screen";

export function AuthGate({ children }: { children: ReactNode }) {
	const { session, loading } = useAuth();

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<p className="text-sm text-muted-foreground">Loading…</p>
			</div>
		);
	}

	if (!session) return <LoginScreen />;

	return <>{children}</>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/auth/auth-gate.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/auth/auth-gate.tsx
git commit -m "feat: add auth gate"
```

---

### Task 7: Rewrite the store to use Supabase

**Files:**

- Modify: `lib/store.tsx` (full replacement of file contents)

This is the core change. The public `StoreValue` interface adds one field (`online`); every mutation signature is identical to today, so dashboard/settings consumers keep working (settings still needs the hydration gate from Task 9). The save always pushes the latest `data` via a ref; a dirty-guard prevents focus/reconnect refetches from clobbering unsaved edits; an `applyingServerRef` flag stops a server load from echoing itself back as a save.

- [ ] **Step 1: Replace `lib/store.tsx` with the Supabase-backed version**

Replace the entire contents of `lib/store.tsx` with:

```tsx
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
```

- [ ] **Step 2: Confirm no stray localStorage references remain**

Run:

```bash
grep -rn "localStorage\|bonustrak:" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Expected: **no output**.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. `lib/store.tsx` and existing consumers of `useStore()` compile; `online` is a valid field.

- [ ] **Step 4: Commit**

```bash
git add lib/store.tsx
git commit -m "feat: back store with Supabase (debounced save, dirty-guard, reconnect sync)"
```

---

### Task 8: Offline indicator

**Files:**

- Create: `components/offline-indicator.tsx`

(`online` now exists on the store from Task 7, so this compiles directly.)

- [ ] **Step 1: Write the indicator**

Create `components/offline-indicator.tsx`:

```tsx
"use client";

import { useStore } from "@/lib/store";

export function OfflineIndicator() {
	const { online } = useStore();
	if (online) return null;
	return (
		<div
			role="status"
			className="fixed inset-x-0 top-0 z-50 bg-amber-500/90 py-1 text-center text-xs font-medium text-amber-950"
		>
			Offline — your changes will sync when you reconnect.
		</div>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `components/offline-indicator.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/offline-indicator.tsx
git commit -m "feat: add offline indicator"
```

---

### Task 9: Settings hydration gate

**Files:**

- Create: `components/settings/settings-content.tsx`
- Modify: `app/settings/page.tsx:4-6,21-25`

**Why:** `GoalSection` (`components/settings/goal-section.tsx:21-23`) seeds form state from `data` at mount with no `hydrated` guard; `HoursLogSection` and `TimeOffSection` render lists from `data` directly. With async server loading, a hard refresh straight to `/settings` would show defaults before the load resolves and could overwrite real data on save. A single client wrapper gates all three on `hydrated`, mirroring `DashboardView`'s skeleton pattern (`components/dashboard/dashboard-view.tsx:18-26`).

- [ ] **Step 1: Create the gate wrapper**

Create `components/settings/settings-content.tsx`:

```tsx
"use client";

import { useStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalSection } from "./goal-section";
import { TimeOffSection } from "./time-off-section";
import { HoursLogSection } from "./hours-log-section";

export function SettingsContent() {
	const { hydrated } = useStore();

	if (!hydrated) {
		return (
			<div className="flex flex-col gap-5">
				<Skeleton className="h-64 w-full rounded-xl" />
				<Skeleton className="h-64 w-full rounded-xl" />
				<Skeleton className="h-64 w-full rounded-xl" />
			</div>
		);
	}

	return (
		<>
			<GoalSection />
			<TimeOffSection />
			<HoursLogSection />
		</>
	);
}
```

- [ ] **Step 2: Render it from the settings page**

In `app/settings/page.tsx`, replace the three section imports (lines 4-6):

```tsx
import { GoalSection } from "@/components/settings/goal-section";
import { TimeOffSection } from "@/components/settings/time-off-section";
import { HoursLogSection } from "@/components/settings/hours-log-section";
```

with:

```tsx
import { SettingsContent } from "@/components/settings/settings-content";
```

and replace the `<main>` body (lines 21-25):

```tsx
<main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-16">
	<GoalSection />
	<TimeOffSection />
	<HoursLogSection />
</main>
```

with:

```tsx
<main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-16">
	<SettingsContent />
</main>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `settings-content.tsx` or `app/settings/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/settings/settings-content.tsx app/settings/page.tsx
git commit -m "fix: gate settings sections on hydration to avoid overwriting loaded data"
```

---

### Task 10: Wire providers into the layout

**Files:**

- Modify: `app/layout.tsx:5,37-43`

- [ ] **Step 1: Add imports**

In `app/layout.tsx`, add below the `Toaster` import on line 5:

```tsx
import { SupabaseProvider } from "@/components/auth/supabase-provider";
import { AuthGate } from "@/components/auth/auth-gate";
import { OfflineIndicator } from "@/components/offline-indicator";
```

- [ ] **Step 2: Wrap the tree**

Replace the existing `<body>` contents:

```tsx
<body className="font-sans antialiased">
	<StoreProvider>{children}</StoreProvider>
	<Toaster />
	{process.env.NODE_ENV === "production" && <Analytics />}
</body>
```

with:

```tsx
<body className="font-sans antialiased">
	<SupabaseProvider>
		<AuthGate>
			<StoreProvider>
				<OfflineIndicator />
				{children}
			</StoreProvider>
		</AuthGate>
	</SupabaseProvider>
	<Toaster />
	{process.env.NODE_ENV === "production" && <Analytics />}
</body>
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: type-check clean; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: gate app behind Supabase auth and mount providers"
```

---

### Task 11: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "What this is" backend statement**

Replace the paragraph beginning "There is **no backend**. All state lives in the browser's `localStorage`…" with:

```markdown
**Persistence is Supabase** (Postgres + magic-link auth). Each signed-in user has
one row in the `user_data` table holding the whole `AppData` envelope as `jsonb`
plus a `pace_mode` column. The app is still client-rendered: the React Context
store (`lib/store.tsx`) is the in-memory working copy, loaded from Supabase on
mount/focus and saved with a debounced, retrying `upsert`. A dirty-guard keeps
refetches from clobbering unsaved edits. Row-Level Security scopes each row to its
owner. Auth/session live in `components/auth/`. Sign-ups are disabled; users are
created manually in the Supabase dashboard.
```

- [ ] **Step 2: Update the State and Gotchas sections**

In the **State** bullet, replace "`StoreProvider` hydrates from `localStorage` on mount … and persists on every change." with:

```markdown
`StoreProvider` loads the user's row from Supabase on mount and on window focus
(`hydrated` guards reads until the first load completes; a dirty-guard skips
refetches while unsaved edits exist) and persists changes with a debounced,
retrying `upsert` (`SAVE_DEBOUNCE_MS`, `MAX_SAVE_RETRIES`). Don't read/write
Supabase directly elsewhere — go through `useStore()`.
```

In **Gotchas**, replace the localStorage hydration/versioning bullets with:

```markdown
- Anything reading store data must wait for `hydrated` to be `true`, or it will
  flash empty/default state before the Supabase load completes. The settings page
  gates on this via `components/settings/settings-content.tsx`; the dashboard via
  `DashboardView`.
- Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
  `.env.local`; `lib/supabase.ts` throws on startup if they're missing.
- Cross-device edits are whole-blob last-write-wins (single `jsonb` per user). Two
  devices editing different fields at once: last save wins for everything.
- When changing the persisted shape, migrate existing `user_data.data` JSON in
  Supabase (no per-user version key exists anymore).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Supabase persistence"
```

---

### Task 12: Manual end-to-end verification

**Files:** none (runtime verification). Prerequisite: Task 2 complete.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server on `http://localhost:3000`, no console error about missing env vars.

- [ ] **Step 2: Login screen appears when signed out**

Open `http://localhost:3000`. Expected: the BonusTrak magic-link login card, not the dashboard.

- [ ] **Step 3: Magic link for a real user works**

Enter a created user's email → "Send magic link" → "Check your email…". Open the link **in the same browser**. Expected: redirected to the dashboard, signed in.

- [ ] **Step 4: PKCE / same-browser check (and contingency)**

Confirm Step 3 worked with the default client config. If the link instead lands on an error or stays signed out (project uses PKCE token-hash links and you need cross-browser opening), apply the contingency: add `flowType: "implicit"` to the `auth` options in `lib/supabase.ts`, restart, and retry. Record which path was needed.

- [ ] **Step 5: Non-existent email is rejected**

Sign out (DevTools → Application → Clear site data, or a fresh private window). Request a link for an email not in the user list. Expected: an error (sign-ups disabled / `shouldCreateUser: false`), no account created, no access.

- [ ] **Step 6: Data persists to the server**

Signed in, add an hours entry and set a goal. In Supabase → Table editor → `user_data`, confirm the row's `data` JSON contains them (after ~1s debounce).

- [ ] **Step 7: Cross-device/browser sync**

Sign in as the same user in a second browser/profile. Confirm it shows Step 6's data. Add an entry in browser A; switch to B and refocus the tab. Expected: B shows A's new entry after the focus refetch.

- [ ] **Step 8: Settings hard-refresh does not clobber**

With a saved goal, hard-refresh directly on `/settings`. Expected: a skeleton shows briefly, then the **real** goal values populate the form — never the `1900`/default placeholders that a save could overwrite.

- [ ] **Step 9: Pace mode persists**

Toggle pace mode. Confirm `user_data.pace_mode` updates in the dashboard and survives a reload.

- [ ] **Step 10: Offline edit + sync on reconnect**

DevTools → Network → Offline. Expected: amber "Offline — your changes will sync when you reconnect" banner. Add an entry while offline (it appears locally). Set Network back to Online. Expected: banner disappears and the offline entry is written to `user_data` in Supabase (confirm in Table editor) — not lost, not clobbered by a refetch.

- [ ] **Step 11: Final type + build gate**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

---

## Self-Review

**Spec coverage:**

- Supabase platform, client-side + RLS → Tasks 2, 3, 7 ✅
- Magic-link auth + `shouldCreateUser: false`, loading/login/app gate → Tasks 4, 5, 6 ✅
- Discard localStorage, server sole source → Task 7 (grep gate Step 2), Task 11 ✅
- One JSON blob per user + `pace_mode` column + RLS → Task 2 ✅
- Fetch on open + focus, debounced `SAVE_DEBOUNCE_MS` writes, no realtime → Task 7 ✅
- Dirty-guard, load sequencing, bounded latest-snapshot retry, insert-race reselect → Task 7 ✅
- Offline edit + sync-on-reconnect with banner, no durable queue → Tasks 7, 8, 12 Step 10 ✅
- Settings hydration gate (consumer change) → Task 9 ✅
- No public sign-up, two users created manually → Task 2 Steps 3-4, Task 12 Step 5 ✅
- No sign-out control in scope → honored ✅
- Env vars, dependency, CLAUDE.md update → Tasks 1, 2, 11 ✅
- PKCE caveat + contingency → Task 3 note, Task 12 Step 4 ✅
- Manual verification (no test suite) → Task 12 ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. ✅

**Type consistency:** `useAuth()` returns `{ session, loading }` (Task 4), consumed identically in Tasks 6 & 7. `useStore()` gains `online: boolean` (Task 7), read in Tasks 8 & 9. `applyRow(row: UserDataRow)`, `load()`, `flushData(attempt?)`, `setPaceMode(m: PaceMode)` are consistent within the store. Supabase calls use `user_data` columns `data`, `pace_mode`, `user_id`, `updated_at` exactly as created in Task 2. `SettingsContent`/`OfflineIndicator` names match their imports in Tasks 9/10. ✅

**Codex findings resolution:** P1 focus-clobber → dirty-guard (Task 7). P1 retry loop → bounded + latest-snapshot via `dataRef` (Task 7). P1 offline read-only mismatch → resolved to edit+sync per user decision (Tasks 7, 8). P1 insert race → reselect (Task 7). P1 `shouldCreateUser` → added (Task 5). P1 whole-blob LWW → accepted by design, documented (Task 11, spec). P2 partial pace upsert → `update().eq()` (Task 7). P2 overlapping loads → `loadId` guard (Task 7). P2 redundant post-hydration write → `applyingServerRef` (Task 7). P2 settings hydration → Task 9. P2 PKCE → Task 3 note + Task 12 Step 4. P3 stale git/gitignore facts → corrected (header, Task 2). P3 Task-7 wording → obsolete after reordering (store now precedes indicator). ✅
