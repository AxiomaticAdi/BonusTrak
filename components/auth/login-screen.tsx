"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginScreen() {
	const [status, setStatus] = useState<"idle" | "redirecting" | "error">(
		"idle",
	);
	const [error, setError] = useState<string | null>(null);

	async function signIn() {
		setStatus("redirecting");
		setError(null);
		// PKCE flow: Google redirects back to this same browser, where
		// detectSessionInUrl completes the exchange. prompt=select_account lets a
		// user choose which Google account to use (and lets an admin capture
		// multiple auth identities on one machine) instead of silently reusing the
		// last Google session.
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: window.location.origin,
				queryParams: { prompt: "select_account" },
			},
		});
		// On success the browser navigates to Google; we only get here on error.
		if (error) {
			setError(error.message);
			setStatus("error");
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-center">BonusTrak</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Sign in with Google to track your billable hours.
					</p>
					<Button
						type="button"
						className="w-full"
						onClick={signIn}
						disabled={status === "redirecting"}
					>
						{status === "redirecting" ? "Redirecting…" : "Continue with Google"}
					</Button>
					{error && <p className="text-sm text-destructive">{error}</p>}
				</CardContent>
			</Card>
		</div>
	);
}
