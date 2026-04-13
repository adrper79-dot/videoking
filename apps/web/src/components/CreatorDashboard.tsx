"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { DashboardAnalytics } from "@nichestream/types";
import { formatViews, formatCents } from "@/lib/utils";

interface EarningsSummary {
	totalGrossCents: number;
	totalNetCents: number;
	pendingCents: number;
	transferredCents: number;
}

/**
 * Creator dashboard showing stats, recent videos, and earnings overview.
 */
export function CreatorDashboard() {
	const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
	const [earnings, setEarnings] = useState<{ summary: EarningsSummary } | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void Promise.all([
			api.get<DashboardAnalytics>("/api/dashboard/analytics"),
			api.get<{ summary: EarningsSummary }>("/api/dashboard/earnings"),
		])
			.then(([analyticsData, earningsData]) => {
				setAnalytics(analyticsData);
				setEarnings(earningsData);
			})
			.catch(console.error)
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
			</div>
		);
	}

	const stats = [
		{ label: "Total Views (30d)", value: formatViews(analytics?.totalViews ?? 0) },
		{ label: "Watch Time", value: `${analytics?.totalWatchTimeMinutes ?? 0}m` },
		{ label: "Pending Earnings", value: formatCents(earnings?.summary.pendingCents ?? 0) },
		{ label: "Total Earnings", value: formatCents(earnings?.summary.totalNetCents ?? 0) },
	];

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap gap-3">
				<Link
					href="/dashboard/upload"
					className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
				>
					<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
					</svg>
					Upload Video
				</Link>
				<Link
					href="/dashboard/earnings"
					className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-neutral-800"
				>
					View Earnings
				</Link>
			</div>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
					>
						<p className="text-2xl font-bold text-white">{stat.value}</p>
						<p className="mt-1 text-sm text-neutral-400">{stat.label}</p>
					</div>
				))}
			</div>

			<div>
				<h2 className="mb-4 text-lg font-semibold text-white">Recent Videos</h2>
				{!analytics?.recentVideos?.length ? (
					<p className="text-neutral-400">No videos yet. Upload your first video!</p>
				) : (
					<div className="overflow-hidden rounded-xl border border-neutral-800">
						<table className="w-full text-sm">
							<thead className="bg-neutral-800 text-left text-neutral-400">
								<tr>
									<th className="px-4 py-3 font-medium">Title</th>
									<th className="px-4 py-3 font-medium">Views</th>
									<th className="px-4 py-3 font-medium">Watch Time</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800 bg-neutral-900">
								{analytics.recentVideos.map((video) => (
									<tr key={video.videoId} className="hover:bg-neutral-800/50">
										<td className="px-4 py-3">
											<Link
												href={`/watch/${video.videoId}`}
												className="text-white hover:text-brand-400"
											>
												{video.title ?? "Untitled Video"}
											</Link>
										</td>
										<td className="px-4 py-3 text-neutral-300 tabular-nums">
											{formatViews(video.views)}
										</td>
										<td className="px-4 py-3 text-neutral-300 tabular-nums">
											{video.watchTimeMinutes}m
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
