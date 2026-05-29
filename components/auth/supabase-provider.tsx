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
