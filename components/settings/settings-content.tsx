"use client";

import { useStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalSection } from "./goal-section";
import { TimeOffSection } from "./time-off-section";
import { HoursLogSection } from "./hours-log-section";

export function SettingsContent() {
	const { hydrated } = useStore();

	if (!hydrated) {
		return (
			<div className="flex flex-col gap-5">
				<Skeleton className="h-64 w-full rounded-xl" />
				<Skeleton className="h-64 w-full rounded-xl" />
				<Skeleton className="h-64 w-full rounded-xl" />
			</div>
		);
	}

	return (
		<>
			<GoalSection />
			<TimeOffSection />
			<HoursLogSection />
		</>
	);
}
