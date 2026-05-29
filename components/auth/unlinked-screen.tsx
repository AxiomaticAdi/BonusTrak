"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown when a login is authenticated with Google but has no `logins` mapping
 * to a person yet. RLS denies all data regardless; linking is admin-only (see
 * the runbook in supabase/migrations.sql). Sign out lets the user switch Google
 * accounts (prompt=select_account on the login screen).
 */
export function UnlinkedScreen() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-center">BonusTrak</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						This login isn&rsquo;t linked to an account yet — contact the admin.
					</p>
					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() => void supabase.auth.signOut()}
					>
						Sign out
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
