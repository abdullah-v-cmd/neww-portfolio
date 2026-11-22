import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FolderGit2,
  Github,
  Cpu,
  Award,
  Bot,
  Database,
  Mail,
  Inbox,
  FileCheck2,
  Palette,
  Shield,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { AdminAuthGate } from './admin/AdminAuthGate';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminContentTabs } from './admin/AdminContentTabs';
import { AdminProjectsGithubTab } from './admin/AdminProjectsGithubTab';
import { AdminAiSmtpTabs } from './admin/AdminAiSmtpTabs';
import { AdminSecurityThemeTabs } from './admin/AdminSecurityThemeTabs';
import { AdminCvRequestsTab } from './admin/AdminCvRequestsTab';
import { parseJsonSafe } from '../utils/safeFetch';

interface AdminAppProps {
  onExitAdmin: () => void;
  onPortfolioChanged: () => Promise<void>;
}

type AdminTab =
  | 'overview'
  | 'profile'
  | 'cv_requests'
  | 'experience'
  | 'projects'
  | 'github'
  | 'skills'
  | 'certificates'
  | 'ai_providers'
  | 'ai_knowledge'
  | 'messages'
  | 'smtp'
  | 'theme'
  | 'security';

const NAV_ITEMS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile', label: 'Profile & Resume', icon: User },
  { id: 'cv_requests', label: 'CV Requests & Resumes', icon: FileCheck2 },
  { id: 'experience', label: 'Experience & Edu', icon: Briefcase },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'github', label: 'GitHub Sync', icon: Github },
  { id: 'skills', label: 'Skills', icon: Cpu },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'ai_providers', label: 'AI Providers', icon: Bot },
  { id: 'ai_knowledge', label: 'AI Knowledge', icon: Database },
  { id: 'messages', label: 'Recruiter Inbox', icon: Inbox },
  { id: 'smtp', label: 'Email / SMTP', icon: Mail },
  { id: 'theme', label: 'Theme & Video BG', icon: Palette },
  { id: 'security', label: 'Security & Audit', icon: Shield },
];

export function AdminApp({ onExitAdmin, onPortfolioChanged }: AdminAppProps) {
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<{ needsBootstrap: boolean; hasEnvOverride: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [toast, setToast] = useState<string>('');
  const [syncingKb, setSyncingKb] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [experience, setExperience] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [cvRequests, setCvRequests] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [smtpData, setSmtpData] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => parseJsonSafe<{ needsBootstrap: boolean; hasEnvOverride: boolean }>(r))
      .then(setAuthStatus)
      .catch(() => setAuthStatus({ needsBootstrap: false, hasEnvOverride: false }));
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const fetchJson = (url: string) =>
      fetch(url, { headers })
        .then((r) => (r.ok ? parseJsonSafe(r) : null))
        .catch(() => null);

    const [
      ov,
      prof,
      exp,
      edu,
      sk,
      certs,
      projs,
      gh,
      provs,
      kb,
      msgs,
      cvReqs,
      rvList,
      smtp,
      th,
      sess,
      logs,
      me,
    ] = await Promise.all([
      fetchJson('/api/admin/overview'),
      fetchJson('/api/admin/profile'),
      fetchJson('/api/admin/experience'),
      fetchJson('/api/admin/education'),
      fetchJson('/api/admin/skills'),
      fetchJson('/api/admin/certificates'),
      fetchJson('/api/admin/projects'),
      fetchJson('/api/admin/github/repos'),
      fetchJson('/api/admin/ai/providers'),
      fetchJson('/api/admin/ai/knowledge'),
      fetchJson('/api/admin/messages'),
      fetchJson('/api/admin/cv-requests'),
      fetchJson('/api/admin/resumes'),
      fetchJson('/api/admin/smtp'),
      fetchJson('/api/admin/theme'),
      fetchJson('/api/admin/auth/sessions'),
      fetchJson('/api/admin/audit-logs'),
      fetchJson('/api/admin/auth/me'),
    ]);

    if (ov) setOverview(ov);
    if (prof) setProfile(prof);
    if (exp) setExperience(exp);
    if (edu) setEducation(edu);
    if (sk) setSkills(sk);
    if (certs) setCertificates(certs);
    if (projs) setProjects(projs);
    if (gh) setRepos(gh);
    if (provs) setProviders(provs);
    if (kb) setKnowledgeDocs(kb);
    if (msgs) setMessages(msgs);
    if (cvReqs) setCvRequests(cvReqs);
    if (rvList) setResumes(rvList);
    if (smtp) setSmtpData(smtp);
    if (th) setTheme(th);
    if (sess) setSessions(sess);
    if (logs) setAuditLogs(logs);
    if (me) setUser(me);
    await onPortfolioChanged();
  }, [token, onPortfolioChanged]);

  useEffect(() => {
    if (token) loadAdminData();
  }, [token, loadAdminData]);

  if (!token) {
    if (!authStatus) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#07080B] text-sm text-slate-400">
          Checking administrative security state...
        </div>
      );
    }
    return (
      <AdminAuthGate
        needsBootstrap={authStatus.needsBootstrap}
        hasEnvOverride={authStatus.hasEnvOverride}
        onAuthenticated={(newToken, loggedUser) => {
          setToken(newToken);
          setUser(loggedUser);
        }}
        onExitAdmin={onExitAdmin}
      />
    );
  }

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab);

  return (
    <div className="flex min-h-screen bg-[#07080B] text-slate-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800/90 bg-[#0A0C11] md:flex">
        <div className="border-b border-zinc-800/80 px-5 py-4">
          <p className="font-display text-sm font-bold tracking-tight text-white">
            Abdullah Naveed CMS
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const unreadMsgs =
              item.id === 'messages' ? messages.filter((m) => m.status === 'New').length : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {unreadMsgs > 0 ? (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      active ? 'bg-black/30 text-white' : 'bg-red-600/20 text-red-400'
                    }`}
                  >
                    {unreadMsgs}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-zinc-800/80 p-3">
          <button
            type="button"
            onClick={onExitAdmin}
            className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-slate-300 hover:border-zinc-600 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Public Portfolio</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/admin/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              setToken('');
              setUser(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-950/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/90 bg-[#0A0C11] px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Admin</span>
            <span className="text-xs text-slate-600">/</span>
            <h1 className="font-display text-base font-semibold text-white">
              {activeNav?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as AdminTab)}
              aria-label="Select admin section"
              className="h-9 rounded-lg border border-zinc-800 bg-[#07080B] px-2.5 text-xs text-white md:hidden"
            >
              {NAV_ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onExitAdmin}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-slate-300 hover:border-zinc-600 hover:text-white md:hidden"
            >
              Exit
            </button>
          </div>
        </header>

        {toast ? (
          <div className="mx-6 mt-4 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200">
            {toast}
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' ? (
            <AdminOverviewTab
              data={overview}
              onRefresh={loadAdminData}
              syncingKb={syncingKb}
              onSyncKnowledge={async () => {
                setSyncingKb(true);
                try {
                  const res = await fetch('/api/admin/ai/knowledge/sync', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const d = await parseJsonSafe<any>(res);
                  if (!res.ok) throw new Error(d.error || 'Sync failed.');
                  await loadAdminData();
                  notify(`Synced ${d.indexedCount} knowledge documents (${d.chunkCount || 0} chunks).`);
                } catch (err: any) {
                  notify(err?.message || 'Knowledge sync failed.');
                } finally {
                  setSyncingKb(false);
                }
              }}
            />
          ) : null}

          {activeTab === 'cv_requests' ? (
            <AdminCvRequestsTab
              token={token}
              cvRequests={cvRequests}
              resumes={resumes}
              onReload={loadAdminData}
              notify={notify}
            />
          ) : null}

          {activeTab === 'profile' ||
          activeTab === 'experience' ||
          activeTab === 'skills' ||
          activeTab === 'certificates' ? (
            <AdminContentTabs
              tab={activeTab}
              token={token}
              profile={profile}
              experience={experience}
              education={education}
              skills={skills}
              projects={projects}
              certificates={certificates}
              onReload={loadAdminData}
              notify={notify}
            />
          ) : null}

          {activeTab === 'projects' || activeTab === 'github' ? (
            <AdminProjectsGithubTab
              mode={activeTab}
              token={token}
              projects={projects}
              repos={repos}
              onReload={loadAdminData}
              notify={notify}
            />
          ) : null}

          {activeTab === 'ai_providers' ||
          activeTab === 'ai_knowledge' ||
          activeTab === 'messages' ||
          activeTab === 'smtp' ? (
            <AdminAiSmtpTabs
              mode={activeTab}
              token={token}
              providers={providers}
              knowledgeDocs={knowledgeDocs}
              kbChunksCount={overview?.stats?.kbChunks || 0}
              messages={messages}
              smtpData={smtpData}
              onReload={loadAdminData}
              notify={notify}
            />
          ) : null}

          {activeTab === 'theme' || activeTab === 'security' ? (
            <AdminSecurityThemeTabs
              mode={activeTab}
              token={token}
              adminEmail={user?.email || ''}
              theme={theme}
              projects={projects}
              sessions={sessions}
              auditLogs={auditLogs}
              mfaEnabled={Boolean(user?.mfa_enabled)}
              onReload={loadAdminData}
              notify={notify}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
