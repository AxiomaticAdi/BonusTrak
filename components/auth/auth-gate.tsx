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
