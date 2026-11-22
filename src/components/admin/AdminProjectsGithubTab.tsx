import { FormEvent, useState } from 'react';
import { RefreshCw, Plus, Check, EyeOff, Star, Globe, Trash2, Edit3, RotateCcw, X, Upload, Image as ImageIcon } from 'lucide-react';
import { parseJsonSafe } from '../../utils/safeFetch';

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
  const [showArchived, setShowArchived] = useState(false);

  // Quick Create form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Generative AI & RAG');
  const [status, setStatus] = useState('Completed');
  const [tagline, setTagline] = useState('');
  const [overview, setOverview] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [techs, setTechs] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [uploadingProjImg, setUploadingProjImg] = useState(false);

  // Full Edit Modal
  const [editingProj, setEditingProj] = useState<any>(null);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const handleUploadProjectImage = async (file: File, target: 'create' | 'edit') => {
    setUploadingProjImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/projects/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await parseJsonSafe<any>(res);
      if (!res.ok) throw new Error(data.error || 'Image upload failed.');
      if (target === 'create') {
        setCoverImage(data.url);
      } else {
        setEditingProj((prev: any) => (prev ? { ...prev, cover_image: data.url } : prev));
      }
      notify('Project image uploaded.');
    } catch (err: any) {
      notify(err?.message || 'Project image upload failed.');
    } finally {
      setUploadingProjImg(false);
    }
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title,
        category,
        status,
        tagline,
        overview,
        cover_image: coverImage,
        github_url: githubUrl,
        live_url: liveUrl,
        live_demo_verified: Boolean(liveUrl),
        technologies: techs.split(',').map((s) => s.trim()).filter(Boolean),
        is_published: true,
        is_featured: false,
      }),
    });
    if (res.ok) {
      setTitle('');
      setTagline('');
      setOverview('');
      setCoverImage('');
      setGithubUrl('');
      setLiveUrl('');
      setTechs('');
      await onReload();
      notify('Project created and published.');
    }
  };

  const openEditor = (p: any) => {
    setEditingProj({
      ...p,
      techText: (p.technologies || []).join(', '),
      featText: (p.features || []).join('\n'),
      chalText: (p.challenges || []).join('\n'),
      resText: (p.verified_results || []).join('\n'),
    });
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProj) return;
    const payload = {
      ...editingProj,
      technologies: String(editingProj.techText || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      features: String(editingProj.featText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      challenges: String(editingProj.chalText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      verified_results: String(editingProj.resText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const res = await fetch(`/api/admin/projects/${editingProj.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditingProj(null);
      await onReload();
      notify(`Updated ${payload.title}.`);
    } else {
      notify('Failed to save project updates.');
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

  const restoreProject = async (id: number) => {
    await fetch(`/api/admin/projects/${id}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await onReload();
    notify('Project restored from archive.');
  };

  const handleSyncGithub = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/github/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafe<any>(res);
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
              All {repos.length} discovered repositories are classified transparently. Newly discovered repositories never auto-publish.
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
                <th className="px-4 py-3 font-medium">Audit Status</th>
                <th className="px-4 py-3 font-medium">Queue</th>
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
                  <td className="px-4 py-3 font-mono text-amber-300">{r.repo_status || 'Verified'}</td>
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

  const displayedProjects = projects.filter((p) => (showArchived ? p.is_archived : !p.is_archived));

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateProject} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
        <h3 className="font-display text-base font-semibold text-white">Add Manual Project Entry</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          >
            <option>Completed</option>
            <option>In Progress</option>
            <option>Experimental</option>
            <option>Incomplete</option>
          </select>
          <input
            type="text"
            required
            placeholder="One-line Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white sm:col-span-3"
          />
          <input
            type="url"
            placeholder="GitHub URL"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="url"
            placeholder="Live Demo URL (optional)"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
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
        <div className="grid grid-cols-1 items-center gap-3 rounded-lg border border-zinc-800 bg-[#07080B] p-3 sm:grid-cols-12">
          <div className="sm:col-span-2">
            {coverImage ? (
              <img
                src={coverImage}
                alt="Project preview"
                className="h-14 w-full rounded object-cover border border-zinc-800"
              />
            ) : (
              <div className="flex h-14 w-full items-center justify-center rounded border border-dashed border-zinc-800 text-slate-600">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="sm:col-span-7">
            <input
              type="text"
              placeholder="Project Cover Image URL (or upload on the right)"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-[#0D0F14] px-3 font-mono text-xs text-white"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-[#0D0F14] px-3 text-xs font-medium text-slate-200 hover:border-zinc-500">
              <Upload className="h-3.5 w-3.5" />
              <span>{uploadingProjImg ? 'Uploading…' : 'Upload Image'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleUploadProjectImage(e.target.files[0], 'create')}
              />
            </label>
          </div>
        </div>
        <textarea
          rows={2}
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Showing {displayedProjects.length} {showArchived ? 'archived' : 'active'} projects
        </p>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="rounded-lg border border-zinc-800 bg-[#0D0F14] px-3 py-1.5 text-xs text-slate-300 hover:border-zinc-600"
        >
          {showArchived ? 'View Active Projects' : 'View Archived Projects'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0D0F14]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-slate-400">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium">Featured</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {displayedProjects.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.cover_image ? (
                      <img
                        src={p.cover_image}
                        alt=""
                        className="h-9 w-14 shrink-0 rounded object-cover border border-zinc-800"
                      />
                    ) : null}
                    <div>
                      <p className="font-medium text-white">{p.title}</p>
                      <p className="text-[11px] text-slate-500">{p.category}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">{p.status || 'Completed'}</td>
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
                  <div className="inline-flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditor(p)}
                      className="text-slate-300 hover:text-white"
                      title="Edit full project details"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    {p.is_archived ? (
                      <button
                        type="button"
                        onClick={() => restoreProject(p.id)}
                        className="text-emerald-400 hover:text-emerald-300"
                        title="Restore archived project"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => archiveProject(p.id)}
                        className="text-slate-500 hover:text-red-400"
                        title="Archive project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Full Project Edit Modal */}
      {editingProj ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0B0D12] p-6"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-display text-xl font-bold text-white">Edit Project</h3>
              <button type="button" onClick={() => setEditingProj(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Title</label>
                <input
                  type="text"
                  required
                  value={editingProj.title || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, title: e.target.value })}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Honest Status</label>
                <select
                  value={editingProj.status || 'Completed'}
                  onChange={(e) => setEditingProj({ ...editingProj, status: e.target.value })}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                >
                  <option>Completed</option>
                  <option>In Progress</option>
                  <option>Experimental</option>
                  <option>Incomplete</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">GitHub URL</label>
                <input
                  type="url"
                  value={editingProj.github_url || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, github_url: e.target.value })}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Live Public Link (optional)</label>
                <input
                  type="url"
                  value={editingProj.live_url || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, live_url: e.target.value })}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-800 bg-[#07080B] p-3">
              <label className="block text-xs text-slate-400">Project Cover Image</label>
              <div className="flex flex-wrap items-center gap-3">
                {editingProj.cover_image ? (
                  <img
                    src={editingProj.cover_image}
                    alt="Project cover"
                    className="h-14 w-24 shrink-0 rounded object-cover border border-zinc-800"
                  />
                ) : null}
                <input
                  type="text"
                  value={editingProj.cover_image || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, cover_image: e.target.value })}
                  placeholder="/uploads/public/proj_...jpg"
                  className="h-9 min-w-[200px] flex-1 rounded-lg border border-zinc-800 bg-[#0D0F14] px-3 font-mono text-xs text-white"
                />
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#0D0F14] px-3 text-xs font-medium text-slate-200 hover:border-zinc-500">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{uploadingProjImg ? 'Uploading…' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handleUploadProjectImage(e.target.files[0], 'edit')}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Tagline</label>
              <input
                type="text"
                value={editingProj.tagline || ''}
                onChange={(e) => setEditingProj({ ...editingProj, tagline: e.target.value })}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Overview</label>
              <textarea
                rows={3}
                value={editingProj.overview || ''}
                onChange={(e) => setEditingProj({ ...editingProj, overview: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Limitations / Honest Scope Notes</label>
              <textarea
                rows={2}
                value={editingProj.limitations || ''}
                onChange={(e) => setEditingProj({ ...editingProj, limitations: e.target.value })}
                placeholder="Note any unfinished areas, mock boundaries, or companion-repo status..."
                className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-2.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Technologies (comma-separated)</label>
                <input
                  type="text"
                  value={editingProj.techText || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, techText: e.target.value })}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-xs text-white"
                />
              </div>
              <div className="flex items-end gap-4 pb-1.5 text-xs text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editingProj.live_demo_verified)}
                    onChange={(e) => setEditingProj({ ...editingProj, live_demo_verified: e.target.checked ? 1 : 0 })}
                  />
                  <span>Verified Live Demo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editingProj.is_published)}
                    onChange={(e) => setEditingProj({ ...editingProj, is_published: e.target.checked ? 1 : 0 })}
                  />
                  <span>Published</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setEditingProj(null)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
