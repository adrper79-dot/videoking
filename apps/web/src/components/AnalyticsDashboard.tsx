"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/utils";

interface ChurnMetrics {
  at_risk_count: number;
  churned_last_7d: number;
  churn_rate: number;
  inactivity_threshold_days: number;
  at_risk_users: Array<{
    user_id: string;
    inactivity_days: number;
    last_activity: string | null;
    signup_date: string;
  }>;
}

interface CohortRow {
  cohort_week: string;
  signup_count: number;
  d7_retention: number;
  d14_retention: number;
  d30_retention: number;
}

interface ConversionMetrics {
  total_signups_30d: number;
  trial_activated: number;
  trial_activated_pct: number;
  converted_to_paid: number;
  conversion_rate: number;
  refer_conversion_rate: number;
  organic_conversion_rate: number;
}

interface ARPUMetrics {
  overall_arpu: number;
  citizen_arpu: number;
  vip_arpu: number;
  ad_revenue_arpu: number;
  by_cohort: Array<{
    cohort_week: string;
    arpu_cents: number;
    paying_users: number;
  }>;
}

/**
 * Analytics dashboard showing churn, cohorts, conversion, and ARPU metrics
 */
export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<"churn" | "cohorts" | "funnel" | "arpu">("churn");
  const [churnData, setChurnData] = useState<ChurnMetrics | null>(null);
  const [cohortData, setCohortData] = useState<CohortRow[]>([]);
  const [funnelData, setFunnelData] = useState<ConversionMetrics | null>(null);
  const [arpuData, setARPUData] = useState<ARPUMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inactivityThreshold, setInactivityThreshold] = useState(7);

  useEffect(() => {
    void fetchAnalytics();
  }, [activeTab, inactivityThreshold]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === "churn") {
        const churn = await api.get<ChurnMetrics>(
          `/api/admin/analytics/churn?inactivity_threshold_days=${inactivityThreshold}`
        );
        setChurnData(churn);
      } else if (activeTab === "cohorts") {
        const cohorts = await api.get<CohortRow[]>("/api/admin/analytics/cohorts");
        setCohortData(cohorts);
      } else if (activeTab === "funnel") {
        const funnel = await api.get<ConversionMetrics>("/api/admin/analytics/conversion-funnel");
        setFunnelData(funnel);
      } else if (activeTab === "arpu") {
        const arpu = await api.get<ARPUMetrics>("/api/admin/analytics/arpu");
        setARPUData(arpu);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-neutral-800">
        {(["churn", "cohorts", "funnel", "arpu"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-brand-500 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {tab === "churn" && "Churn Analysis"}
            {tab === "cohorts" && "Cohort Retention"}
            {tab === "funnel" && "Conversion Funnel"}
            {tab === "arpu" && "ARPU"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 p-4 text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {activeTab === "churn" && churnData && <ChurnAnalysis data={churnData} onThresholdChange={setInactivityThreshold} />}
          {activeTab === "cohorts" && <CohortAnalysis data={cohortData} />}
          {activeTab === "funnel" && funnelData && <ConversionFunnel data={funnelData} />}
          {activeTab === "arpu" && arpuData && <ARPUAnalysis data={arpuData} />}
        </>
      )}
    </div>
  );
}

function ChurnAnalysis({ data, onThresholdChange }: { data: ChurnMetrics; onThresholdChange: (n: number) => void }) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">At-Risk Users</p>
          <p className="text-2xl font-bold text-white">{data.at_risk_count}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Churned (7d)</p>
          <p className="text-2xl font-bold text-white">{data.churned_last_7d}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Churn Rate</p>
          <p className="text-2xl font-bold text-white">{(data.churn_rate * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Threshold Control */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-300">
          Inactivity Threshold (days): {data.inactivity_threshold_days}
        </label>
        <input
          type="range"
          min="1"
          max="30"
          defaultValue={data.inactivity_threshold_days}
          onChange={(e) => onThresholdChange(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* At-Risk Users Table */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">At-Risk Users ({data.at_risk_users.length})</h3>
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-800 text-left text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Inactivity Days</th>
                <th className="px-4 py-3 font-medium">Signup Date</th>
                <th className="px-4 py-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-900">
              {data.at_risk_users.map((user) => (
                <tr key={user.user_id} className="hover:bg-neutral-800/50">
                  <td className="px-4 py-3 font-mono text-xs">{user.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{user.inactivity_days}d</td>
                  <td className="px-4 py-3">{new Date(user.signup_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {user.last_activity ? new Date(user.last_activity).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CohortAnalysis({ data }: { data: CohortRow[] }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Cohort Week</th>
              <th className="px-4 py-3 font-medium">Signups</th>
              <th className="px-4 py-3 font-medium">D7 Retention</th>
              <th className="px-4 py-3 font-medium">D14 Retention</th>
              <th className="px-4 py-3 font-medium">D30 Retention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900">
            {data.map((row) => (
              <tr key={row.cohort_week} className="hover:bg-neutral-800/50">
                <td className="px-4 py-3">{new Date(row.cohort_week).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-semibold">{row.signup_count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded bg-neutral-700">
                      <div
                        className="h-2 rounded bg-green-500"
                        style={{ width: `${row.d7_retention * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{(row.d7_retention * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded bg-neutral-700">
                      <div
                        className="h-2 rounded bg-yellow-500"
                        style={{ width: `${row.d14_retention * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{(row.d14_retention * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded bg-neutral-700">
                      <div
                        className="h-2 rounded bg-orange-500"
                        style={{ width: `${row.d30_retention * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{(row.d30_retention * 100).toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConversionFunnel({ data }: { data: ConversionMetrics }) {
  const stages = [
    { label: "Total Signups (30d)", value: data.total_signups_30d, color: "bg-blue-600" },
    { label: "Trial Activated", value: data.trial_activated, pct: data.trial_activated_pct, color: "bg-purple-600" },
    { label: "Converted to Paid", value: data.converted_to_paid, pct: data.conversion_rate, color: "bg-green-600" },
  ];

  const maxValue = data.total_signups_30d || 1;

  return (
    <div className="space-y-6">
      {/* Funnel Visualization */}
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={stage.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-300">{stage.label}</span>
              <span className="font-mono text-white">
                {stage.value} {stage.pct ? `(${(stage.pct * 100).toFixed(1)}%)` : ""}
              </span>
            </div>
            <div className="h-8 rounded bg-neutral-800">
              <div
                className={`h-full rounded ${stage.color} transition-all`}
                style={{ width: `${(stage.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Referral Conversion Rate</p>
          <p className="text-2xl font-bold text-green-400">{(data.refer_conversion_rate * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Organic Conversion Rate</p>
          <p className="text-2xl font-bold text-blue-400">{(data.organic_conversion_rate * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

function ARPUAnalysis({ data }: { data: ARPUMetrics }) {
  return (
    <div className="space-y-6">
      {/* Key ARPU Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Overall ARPU</p>
          <p className="text-2xl font-bold text-white">{formatCents(data.overall_arpu)}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Citizen ARPU</p>
          <p className="text-2xl font-bold text-blue-400">{formatCents(data.citizen_arpu)}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">VIP ARPU</p>
          <p className="text-2xl font-bold text-purple-400">{formatCents(data.vip_arpu)}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Ad Revenue ARPU</p>
          <p className="text-2xl font-bold text-green-400">{formatCents(data.ad_revenue_arpu)}</p>
        </div>
      </div>

      {/* Cohort ARPU Breakdown */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">ARPU by Cohort</h3>
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-800 text-left text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Cohort Week</th>
                <th className="px-4 py-3 font-medium">ARPU</th>
                <th className="px-4 py-3 font-medium">Paying Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-900">
              {data.by_cohort.map((row) => (
                <tr key={row.cohort_week} className="hover:bg-neutral-800/50">
                  <td className="px-4 py-3">{new Date(row.cohort_week).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold">{formatCents(row.arpu_cents)}</td>
                  <td className="px-4 py-3">{row.paying_users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
