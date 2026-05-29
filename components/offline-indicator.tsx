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
