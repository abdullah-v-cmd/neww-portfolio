import { FormEvent, useState } from 'react';
import { RefreshCw, Plus, Check, EyeOff, Star, Globe, Trash2 } from 'lucide-react';

interface AdminProjectsGithubTabProps {
  mode: 'projects' | 'github';
  token: string;
  projects: any[];
  repos: any[];
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
}

export function AdminProjectsGithubTab({
  mode,
  token,
  projects,
  repos,
  onReload,
  notify,
}: AdminProjectsGithubTabProps) {
  const [syncing, setSyncing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Generative AI & RAG');
  const [tagline, setTagline] = useState('');
  const [overview, setOverview] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [techs, setTechs] = useState('');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title,
        category,
        tagline,
        overview,
        github_url: githubUrl,
        technologies: techs.split(',').map((s) => s.trim()).filter(Boolean),
        is_published: true,
        is_featured: false,
      }),
    });
    if (res.ok) {
      setTitle('');
      setTagline('');
      setOverview('');
      setGithubUrl('');
      setTechs('');
      await onReload();
      notify('Project created and published.');
    }
  };

  const toggleProjectFlag = async (proj: any, field: 'is_published' | 'is_featured') => {
    const updated = { ...proj, [field]: proj[field] ? 0 : 1 };
    await fetch(`/api/admin/projects/${proj.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updated),
    });
    await onReload();
    notify(`Updated ${proj.title}.`);
  };

  const archiveProject = async (id: number) => {
    await fetch(`/api/admin/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await onReload();
    notify('Project archived.');
  };

  const handleSyncGithub = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/github/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      await onReload();
      notify(`Synced ${data.synced} public repositories from abdullah-v-cmd.`);
    } catch (err: any) {
      notify(err?.message || 'GitHub sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleApproveRepo = async (repoId: number) => {
    const res = await fetch(`/api/admin/github/repos/${repoId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await onReload();
      notify('Repository inspected and imported as draft project (review before publishing).');
    }
  };

  const handleHideRepo = async (repoId: number) => {
    await fetch(`/api/admin/github/repos/${repoId}/hide`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await onReload();
    notify('Repository hidden from discovery queue.');
  };

  if (mode === 'github') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              GitHub Repository Discovery (abdullah-v-cmd)
            </h2>
            <p className="text-xs text-slate-400">
              Newly discovered repositories never auto-publish. Inspect and approve to create a draft project.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncGithub}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Public Repos'}</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0D0F14]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-slate-400">
                <th className="px-4 py-3 font-medium">Repository</th>
                <th className="px-4 py-3 font-medium">Language</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {repos.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-white hover:text-red-400"
                    >
                      {r.name}
                    </a>
                    <p className="mt-0.5 max-w-md truncate text-slate-400">{r.description || 'No description'}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">{r.language || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{r.approval_status}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {r.approval_status !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => handleApproveRepo(r.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-700/60 bg-emerald-950/30 px-2.5 py-1 text-emerald-300 hover:bg-emerald-900/40"
                        >
                          <Check className="h-3 w-3" />
                          <span>Import Draft</span>
                        </button>
                      ) : null}
                      {r.approval_status !== 'hidden' ? (
                        <button
                          type="button"
                          onClick={() => handleHideRepo(r.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-slate-300 hover:border-zinc-500"
                        >
                          <EyeOff className="h-3 w-3" />
                          <span>Hide</span>
                        </button>
                      ) : null}
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

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateProject} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
        <h3 className="font-display text-base font-semibold text-white">Add Manual Project Entry</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            placeholder="Project Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          >
            <option>Generative AI & RAG</option>
            <option>Computer Vision</option>
            <option>AI & Machine Learning</option>
            <option>Automation & MLOps</option>
            <option>Full-Stack Development</option>
          </select>
          <input
            type="text"
            required
            placeholder="One-line Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white sm:col-span-2"
          />
          <input
            type="url"
            placeholder="GitHub URL"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Technologies (comma-separated)"
            value={techs}
            onChange={(e) => setTechs(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
        </div>
        <textarea
          rows={3}
          required
          placeholder="Verified technical overview..."
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Publish Project</span>
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0D0F14]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-slate-400">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium">Featured</th>
              <th className="px-4 py-3 font-medium text-right">Archive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {projects.filter((p) => !p.is_archived).map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-medium text-white">{p.title}</td>
                <td className="px-4 py-3 text-slate-400">{p.category}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleProjectFlag(p, 'is_published')}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
                      p.is_published
                        ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300'
                        : 'border-zinc-700 text-slate-400'
                    }`}
                  >
                    <Globe className="h-3 w-3" />
                    <span>{p.is_published ? 'Live' : 'Draft'}</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleProjectFlag(p, 'is_featured')}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
                      p.is_featured
                        ? 'border-amber-700/60 bg-amber-950/30 text-amber-300'
                        : 'border-zinc-700 text-slate-400'
                    }`}
                  >
                    <Star className="h-3 w-3" />
                    <span>{p.is_featured ? 'Featured' : 'Standard'}</span>
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => archiveProject(p.id)}
                    className="text-slate-500 hover:text-red-400"
                    title="Archive project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
