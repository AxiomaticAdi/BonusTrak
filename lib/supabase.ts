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
