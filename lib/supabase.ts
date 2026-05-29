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
 * enforces per-user access.
 *
 * Default (PKCE) flow: correct for Google OAuth, where the provider redirects
 * back to the SAME browser that initiated sign-in — so the code verifier PKCE
 * stores client-side is always available. detectSessionInUrl completes the
 * OAuth `?code=` exchange on that redirect.
 */
export const supabase = createClient(url, anonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});
