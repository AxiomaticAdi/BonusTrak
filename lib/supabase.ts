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
 * flowType: "implicit" (instead of the default PKCE) lets a magic link be
 * opened in a DIFFERENT browser or device from the one that requested it.
 * PKCE stores a code verifier client-side, which would otherwise force the
 * link to be opened in the same browser that requested it.
 */
export const supabase = createClient(url, anonKey, {
	auth: {
		flowType: "implicit",
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});
