import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RefreshCw } from 'lucide-react';

interface AdminOverviewTabProps {
  data: any;
  onRefresh: () => void;
  onSyncKnowledge: () => void;
  syncingKb: boolean;
}

export function AdminOverviewTab({
  data,
  onRefresh,
  onSyncKnowledge,
  syncingKb,
}: AdminOverviewTabProps) {
  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-8 text-sm text-slate-400">
        Loading live database metrics...
      </div>
    );
  }

  const { stats, activeProvider, smtpStatus, projectsByCategory, recentAudit } = data;

  const cards = [
    { label: 'Published Projects', value: `${stats.publishedProjects} / ${stats.totalProjects}` },
    { label: 'Verified Certificates', value: stats.totalCertificates },
    { label: 'Experience Roles', value: `${stats.rolesCount} (${stats.companiesCount} orgs)` },
    { label: 'Unread Recruiter Threads', value: `${stats.unreadMessages} / ${stats.totalConversations}` },
    { label: 'AI Recruiter Sessions', value: stats.aiConversations },
    { label: 'Indexed Knowledge Docs', value: stats.kbDocs },
    { label: 'GitHub Repos Tracked', value: `${stats.ghSynced} (${stats.ghPending} pending)` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-white">
              {c.value}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-4">
          <p className="text-xs text-slate-400">Active Subsystems</p>
          <p className="mt-2 text-xs text-slate-200">
            AI: {activeProvider ? `${activeProvider.name} (${activeProvider.last_status})` : 'None'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            SMTP: {smtpStatus?.enabled ? 'Enabled' : smtpStatus?.configured ? 'Configured (Disabled)' : 'Awaiting Config'}
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#0D0F14] p-4">
        <div>
          <p className="text-sm font-medium text-white">RAG Knowledge Index Synchronization</p>
          <p className="text-xs text-slate-400">
            Last indexed: <span className="font-mono">{stats.lastKbSync || 'Never'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-zinc-500"
          >
            Refresh Stats
          </button>
          <button
            type="button"
            onClick={onSyncKnowledge}
            disabled={syncingKb}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingKb ? 'animate-spin' : ''}`} />
            <span>{syncingKb ? 'Indexing...' : 'Sync AI Knowledge'}</span>
          </button>
        </div>
      </div>

      {/* Chart + Recent Audit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5 lg:col-span-6">
          <h3 className="font-display text-base font-semibold text-white">
            Projects by Domain Category
          </h3>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectsByCategory} margin={{ top: 10, right: 16, left: -12, bottom: 20 }}>
                <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-12} textAnchor="end" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#07080B', borderColor: '#27272a', color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {projectsByCategory.map((_: any, index: number) => (
                    <Cell key={index} fill={index === 0 ? '#dc2626' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5 lg:col-span-6">
          <h3 className="font-display text-base font-semibold text-white">Recent Admin Activity</h3>
          <div className="mt-4 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-slate-400">
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Resource</th>
                  <th className="pb-2 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recentAudit.map((log: any) => (
                  <tr key={log.id}>
                    <td className="py-2 font-mono text-slate-200">{log.action}</td>
                    <td className="py-2 text-slate-400">{log.details || log.resource_type}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                      {log.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
