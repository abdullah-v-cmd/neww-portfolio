import { FormEvent, useState } from 'react';
import { Save, Upload, Plus, Trash2 } from 'lucide-react';

interface AdminContentTabsProps {
  tab: 'profile' | 'experience' | 'skills' | 'certificates';
  token: string;
  profile: any;
  experience: any[];
  education: any[];
  skills: any[];
  certificates: any[];
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
}

export function AdminContentTabs({
  tab,
  token,
  profile,
  experience,
  education,
  skills,
  certificates,
  onReload,
  notify,
}: AdminContentTabsProps) {
  const [profileForm, setProfileForm] = useState<any>(profile || {});
  const [saving, setSaving] = useState(false);

  // New Role form state
  const [roleCompanyId, setRoleCompanyId] = useState<number>(experience[0]?.id || 1);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleType, setNewRoleType] = useState('Full-time');
  const [newRoleStart, setNewRoleStart] = useState('');
  const [newRoleEnd, setNewRoleEnd] = useState('Present');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // New Skill form state
  const [skillCatId, setSkillCatId] = useState<number>(skills[0]?.id || 1);
  const [skillName, setSkillName] = useState('');
  const [skillProf, setSkillProf] = useState('');

  // New Certificate form state
  const [certTitle, setCertTitle] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certDate, setCertDate] = useState('');
  const [certCredId, setCertCredId] = useState('');
  const [certVerifyUrl, setCertVerifyUrl] = useState('');
  const [certFileUrl, setCertFileUrl] = useState('');
  const [certFileType, setCertFileType] = useState<'pdf' | 'image'>('pdf');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) throw new Error('Save failed');
      await onReload();
      notify('Profile & About settings saved.');
    } catch {
      notify('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/resume/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (res.ok) {
      setProfileForm((p: any) => ({ ...p, resume_url: data.resume_url, resume_filename: data.resume_filename }));
      await onReload();
      notify('Resume PDF uploaded and published.');
    } else {
      notify(data.error || 'Resume upload failed.');
    }
  };

  const handleAddRole = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/companies/${roleCompanyId}/roles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: newRoleTitle,
        employment_type: newRoleType,
        start_date: newRoleStart,
        end_date: newRoleEnd,
        is_current: newRoleEnd.toLowerCase() === 'present',
        description: newRoleDesc,
        responsibilities: [],
        skills: [],
      }),
    });
    if (res.ok) {
      setNewRoleTitle('');
      setNewRoleStart('');
      setNewRoleDesc('');
      await onReload();
      notify('Role added.');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    await fetch(`/api/admin/roles/${roleId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await onReload();
    notify('Role removed.');
  };

  const handleAddSkill = async (e: FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;
    const res = await fetch('/api/admin/skills', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ category_id: skillCatId, name: skillName, proficiency_label: skillProf }),
    });
    if (res.ok) {
      setSkillName('');
      setSkillProf('');
      await onReload();
      notify('Skill added.');
    }
  };

  const handleDeleteSkill = async (id: number) => {
    await fetch(`/api/admin/skills/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await onReload();
    notify('Skill deleted.');
  };

  const handleCertFileUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/certificates/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (res.ok) {
      setCertFileUrl(data.file_url);
      setCertFileType(data.file_type);
      notify('Certificate document uploaded.');
    } else {
      notify(data.error || 'Upload failed.');
    }
  };

  const handleCreateCert = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/certificates', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: certTitle,
        issuer: certIssuer,
        issue_date: certDate,
        credential_id: certCredId,
        verify_url: certVerifyUrl,
        file_url: certFileUrl,
        file_type: certFileType,
        is_featured: true,
        is_public: true,
      }),
    });
    if (res.ok) {
      setCertTitle('');
      setCertIssuer('');
      setCertDate('');
      setCertCredId('');
      setCertVerifyUrl('');
      setCertFileUrl('');
      await onReload();
      notify('Certificate published.');
    }
  };

  if (tab === 'profile') {
    return (
      <form onSubmit={handleSaveProfile} className="space-y-6 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Profile, About &amp; Resume</h2>
            <p className="text-xs text-slate-400">Controls hero copy, availability indicator, biography, and downloadable CV.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Full Name</label>
            <input
              type="text"
              value={profileForm.full_name || ''}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Location</label>
            <input
              type="text"
              value={profileForm.location || ''}
              onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">Hero Headline</label>
            <input
              type="text"
              value={profileForm.headline || ''}
              onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">Professional Title Bar</label>
            <input
              type="text"
              value={profileForm.subheadline || ''}
              onChange={(e) => setProfileForm({ ...profileForm, subheadline: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">Hero Summary</label>
            <textarea
              rows={2}
              value={profileForm.bio_short || ''}
              onChange={(e) => setProfileForm({ ...profileForm, bio_short: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">About Biography</label>
            <textarea
              rows={3}
              value={profileForm.bio_long || ''}
              onChange={(e) => setProfileForm({ ...profileForm, bio_long: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">What I Build</label>
            <textarea
              rows={3}
              value={profileForm.about_what_i_build || ''}
              onChange={(e) => setProfileForm({ ...profileForm, about_what_i_build: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Problem-Solving Approach</label>
            <textarea
              rows={3}
              value={profileForm.about_problem_solving || ''}
              onChange={(e) => setProfileForm({ ...profileForm, about_problem_solving: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Public Contact Email</label>
            <input
              type="email"
              value={profileForm.email || ''}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">LinkedIn URL</label>
            <input
              type="url"
              value={profileForm.linkedin_url || ''}
              onChange={(e) => setProfileForm({ ...profileForm, linkedin_url: e.target.value })}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
          <label className="flex items-center gap-2.5 text-sm text-white">
            <input
              type="checkbox"
              checked={Boolean(profileForm.availability_enabled)}
              onChange={(e) => setProfileForm({ ...profileForm, availability_enabled: e.target.checked ? 1 : 0 })}
            />
            <span>Display Availability Banner on Public Hero</span>
          </label>
          <input
            type="text"
            value={profileForm.availability_label || ''}
            onChange={(e) => setProfileForm({ ...profileForm, availability_label: e.target.value })}
            placeholder="Availability label"
            className="h-9 w-72 rounded-lg border border-zinc-800 bg-[#0D0F14] px-3 text-xs text-white"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-[#07080B] p-4">
          <div>
            <p className="text-sm font-medium text-white">Resume PDF</p>
            <p className="text-xs text-slate-400">
              {profileForm.resume_url
                ? `Active: ${profileForm.resume_filename} (${profileForm.resume_downloads || 0} downloads)`
                : 'No PDF uploaded yet.'}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-white hover:border-zinc-500">
            <Upload className="h-3.5 w-3.5" />
            <span>Upload / Replace Resume PDF</span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleResumeUpload(e.target.files[0])}
            />
          </label>
        </div>
      </form>
    );
  }

  if (tab === 'experience') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {experience.map((comp) => (
            <div key={comp.id} className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="font-display text-lg font-semibold text-white">{comp.name}</h3>
                <p className="text-xs text-slate-400">
                  {comp.location} · {comp.arrangement} · {comp.overall_dates}
                </p>
              </div>
              <div className="space-y-3">
                {comp.roles.map((r: any) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/80 bg-[#07080B] p-3">
                    <div>
                      <p className="text-sm font-medium text-white">{r.title}</p>
                      <p className="text-xs text-slate-400">
                        {r.start_date} – {r.end_date} · {r.employment_type}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(r.id)}
                      className="text-slate-500 hover:text-red-400"
                      title="Delete role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddRole} className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">Add Position to Employer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={roleCompanyId}
              onChange={(e) => setRoleCompanyId(Number(e.target.value))}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            >
              {experience.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Role Title"
              value={newRoleTitle}
              onChange={(e) => setNewRoleTitle(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Employment Type (e.g. Full-time)"
              value={newRoleType}
              onChange={(e) => setNewRoleType(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <input
              type="text"
              required
              placeholder="Start Date (e.g. Jan 2026)"
              value={newRoleStart}
              onChange={(e) => setNewRoleStart(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
            <input
              type="text"
              placeholder="End Date (or Present)"
              value={newRoleEnd}
              onChange={(e) => setNewRoleEnd(e.target.value)}
              className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Role summary"
            value={newRoleDesc}
            onChange={(e) => setNewRoleDesc(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-white"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Role</span>
          </button>
        </form>

        <div className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
          <h3 className="font-display text-base font-semibold text-white">Education Records</h3>
          <div className="mt-3 space-y-2">
            {education.map((edu) => (
              <div key={edu.id} className="rounded-lg border border-zinc-800 bg-[#07080B] p-3 text-sm text-slate-200">
                {edu.degree} — {edu.institution} ({edu.student_name})
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'skills') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleAddSkill} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
          <select
            value={skillCatId}
            onChange={(e) => setSkillCatId(Number(e.target.value))}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          >
            {skills.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="Skill name (e.g. LangGraph)"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Optional verified note"
            value={skillProf}
            onChange={(e) => setSkillProf(e.target.value)}
            className="h-10 w-48 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Skill</span>
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {skills.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5">
              <h3 className="font-display text-base font-semibold text-white">{cat.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {cat.skills.map((s: any) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#07080B] px-3 py-1.5 text-xs text-slate-200"
                  >
                    <span>{s.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(s.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateCert} className="space-y-4 rounded-xl border border-zinc-800 bg-[#0D0F14] p-6">
        <h3 className="font-display text-base font-semibold text-white">Add Verified Certificate</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            placeholder="Certificate Title"
            value={certTitle}
            onChange={(e) => setCertTitle(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="text"
            required
            placeholder="Issuing Organization"
            value={certIssuer}
            onChange={(e) => setCertIssuer(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="text"
            required
            placeholder="Issue Date (e.g. Aug 20, 2026)"
            value={certDate}
            onChange={(e) => setCertDate(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Credential ID"
            value={certCredId}
            onChange={(e) => setCertCredId(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <input
            type="url"
            placeholder="Official Verification URL"
            value={certVerifyUrl}
            onChange={(e) => setCertVerifyUrl(e.target.value)}
            className="h-10 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white"
          />
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-[#07080B] px-3 text-xs text-slate-200 hover:border-zinc-500">
            <Upload className="h-3.5 w-3.5" />
            <span>{certFileUrl ? 'Document Ready' : 'Upload PDF / Image'}</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleCertFileUpload(e.target.files[0])}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!certFileUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Publish Certificate</span>
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {certificates.map((cert) => (
          <div key={cert.id} className="rounded-xl border border-zinc-800 bg-[#0D0F14] p-5 space-y-2">
            <p className="text-xs text-red-400">{cert.issuer}</p>
            <h4 className="font-display text-base font-semibold text-white">{cert.title}</h4>
            <p className="font-mono text-xs text-slate-400">
              {cert.issue_date} · ID {cert.credential_id || 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
