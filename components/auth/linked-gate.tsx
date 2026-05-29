"use client";

import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { UnlinkedScreen } from "./unlinked-screen";

/**
 * Renders the "unlinked" screen for a signed-in login that has no `logins`
 * mapping to a person. Lives INSIDE StoreProvider (AuthGate sits outside the
 * store and can't read `unlinked`). While the store is still loading
 * (`hydrated === false`) we render children, which show their own skeletons.
 */
export function LinkedGate({ children }: { children: ReactNode }) {
	const { hydrated, unlinked } = useStore();

	if (hydrated && unlinked) return <UnlinkedScreen />;

	return <>{children}</>;
}
