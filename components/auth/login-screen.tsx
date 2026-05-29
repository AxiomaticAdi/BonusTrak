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
