import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { db, PRIVATE_UPLOADS_DIR, PUBLIC_UPLOADS_DIR } from '../db.ts';
import {
  authenticateAdminCredentials,
  AuthedRequest,
  createAdminSession,
  getAuthStatus,
  logAudit,
  rateLimit,
  requireAdmin,
  requireRole,
} from '../auth.ts';
import {
  decryptSecret,
  encryptSecret,
  generateSecureToken,
  hashPassword,
  maskSecret,
  validateExternalProviderUrl,
  validateFileMagicBytes,
  verifyPassword,
} from '../crypto.ts';
import {
  queryAbdullahAI,
  rebuildPublicKnowledgeBase,
  retrieveKnowledgeChunks,
  testAiProviderConnection,
} from '../ai.ts';
import { sendEmailViaSmtp, testSmtpConnection } from '../mailer.ts';

export const adminRouter = Router();

const adminUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file format. Allowed: PDF, PNG, JPG, WEBP, TXT.'));
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// 1. AUTHENTICATION, BOOTSTRAP & MFA
// ---------------------------------------------------------------------------

adminRouter.get('/auth/status', (_req, res) => {
  res.json(getAuthStatus());
});

adminRouter.post('/auth/bootstrap', rateLimit('admin_bootstrap', 5, 300_000), (req, res) => {
  const status = getAuthStatus();
  if (!status.needsBootstrap) {
    return res.status(403).json({ error: 'Owner account is already provisioned.' });
  }

  const { email, displayName, password } = req.body || {};
  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' ||
    password.length < 10
  ) {
    return res.status(400).json({ error: 'Valid email and password (minimum 10 characters) are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);

  const info = db
    .prepare(
      `INSERT INTO admin_users (email, display_name, password_hash, role) VALUES (?, ?, ?, 'owner')`
    )
    .run(normalizedEmail, String(displayName || 'Abdullah Naveed').trim().slice(0, 80), passwordHash);

  const userId = Number(info.lastInsertRowid);
  const ip = req.ip || '';
  const session = createAdminSession(userId, ip, req.headers['user-agent'] || '');
  logAudit(normalizedEmail, 'ADMIN_BOOTSTRAP', 'admin_user', String(userId), 'Initial owner provisioned', ip);

  return res.status(201).json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: userId,
      email: normalizedEmail,
      display_name: String(displayName || 'Abdullah Naveed').trim(),
      role: 'owner',
      mfa_enabled: false,
    },
  });
});

adminRouter.post('/auth/login', rateLimit('admin_login', 10, 300_000), (req, res) => {
  const { email, password, totpCode } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const ip = req.ip || '';
  const auth = authenticateAdminCredentials(email, password);
  if (!auth.ok || !auth.user) {
    logAudit(email.slice(0, 120), 'LOGIN_FAILED', 'auth', '', auth.error || 'Invalid credentials', ip);
    return res.status(401).json({ error: auth.error || 'Invalid credentials.' });
  }

  if (auth.user.mfa_enabled) {
    if (!totpCode || typeof totpCode !== 'string') {
      return res.status(200).json({ mfaRequired: true });
    }
    const secret = decryptSecret(auth.user.mfa_secret_enc);
    const verification = verifySync({ token: totpCode.trim(), secret });
    if (!verification.valid) {
      logAudit(auth.user.email, 'MFA_FAILED', 'auth', String(auth.user.id), 'Invalid TOTP code', ip);
      return res.status(401).json({ error: 'Invalid authentication code.' });
    }
  }

  const session = createAdminSession(auth.user.id, ip, req.headers['user-agent'] || '');
  logAudit(auth.user.email, 'LOGIN_SUCCESS', 'auth', String(auth.user.id), 'Admin session started', ip);

  return res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: auth.user.id,
      email: auth.user.email,
      display_name: auth.user.display_name,
      role: auth.user.role,
      mfa_enabled: Boolean(auth.user.mfa_enabled),
    },
  });
});

// Protect all routes below
adminRouter.use(requireAdmin);

adminRouter.get('/auth/me', (req: AuthedRequest, res) => {
  const u = req.adminUser!;
  res.json({
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    mfa_enabled: Boolean(u.mfa_enabled),
  });
});

adminRouter.post('/auth/logout', (req: AuthedRequest, res) => {
  if (req.sessionId) {
    db.prepare('UPDATE admin_sessions SET revoked = 1 WHERE id = ?').run(req.sessionId);
  }
  logAudit(req.adminUser!.email, 'LOGOUT', 'auth', String(req.sessionId || ''), '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/auth/logout-all', (req: AuthedRequest, res) => {
  db.prepare('UPDATE admin_sessions SET revoked = 1 WHERE user_id = ?').run(req.adminUser!.id);
  logAudit(req.adminUser!.email, 'LOGOUT_ALL', 'auth', String(req.adminUser!.id), 'All sessions revoked', req.ip || '');
  res.json({ ok: true });
});

adminRouter.get('/auth/sessions', (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT id, ip, user_agent, expires_at, revoked, created_at, (id = ?) as is_current
       FROM admin_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 25`
    )
    .all(req.sessionId, req.adminUser!.id);
  res.json(rows);
});

adminRouter.delete('/auth/sessions/:id', (req: AuthedRequest, res) => {
  db.prepare('UPDATE admin_sessions SET revoked = 1 WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.adminUser!.id
  );
  logAudit(req.adminUser!.email, 'REVOKE_SESSION', 'session', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/auth/change-password', (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 10) {
    return res.status(400).json({ error: 'Current password and new password (min 10 chars) are required.' });
  }
  if (!verifyPassword(currentPassword, req.adminUser!.password_hash)) {
    return res.status(401).json({ error: 'Current password verification failed.' });
  }

  db.transaction(() => {
    db.prepare(`UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
      hashPassword(newPassword),
      req.adminUser!.id
    );
    // Invalidate all other active sessions on password rotation
    db.prepare('UPDATE admin_sessions SET revoked = 1 WHERE user_id = ? AND id != ?').run(
      req.adminUser!.id,
      req.sessionId
    );
  })();

  logAudit(req.adminUser!.email, 'CHANGE_PASSWORD', 'admin_user', String(req.adminUser!.id), 'Password rotated and other sessions invalidated', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/auth/change-email', (req: AuthedRequest, res) => {
  const { currentPassword, newEmail } = req.body || {};
  if (
    typeof currentPassword !== 'string' ||
    typeof newEmail !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())
  ) {
    return res.status(400).json({ error: 'Current password and valid new email are required.' });
  }
  if (!verifyPassword(currentPassword, req.adminUser!.password_hash)) {
    return res.status(401).json({ error: 'Password verification failed.' });
  }
  const normalized = newEmail.trim().toLowerCase();
  db.prepare(`UPDATE admin_users SET email = ?, updated_at = datetime('now') WHERE id = ?`).run(
    normalized,
    req.adminUser!.id
  );
  logAudit(normalized, 'CHANGE_EMAIL', 'admin_user', String(req.adminUser!.id), `Changed from ${req.adminUser!.email}`, req.ip || '');
  res.json({ ok: true, email: normalized });
});

adminRouter.post('/auth/mfa/setup', async (req: AuthedRequest, res) => {
  const secret = generateSecret();
  const uri = generateURI({
    issuer: 'AbdullahNaveedAdmin',
    label: req.adminUser!.email,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(uri);
  db.prepare(`UPDATE admin_users SET mfa_secret_enc = ?, updated_at = datetime('now') WHERE id = ?`).run(
    encryptSecret(secret),
    req.adminUser!.id
  );
  res.json({ secret, qrDataUrl });
});

adminRouter.post('/auth/mfa/enable', (req: AuthedRequest, res) => {
  const { code } = req.body || {};
  if (typeof code !== 'string') return res.status(400).json({ error: 'Verification code required.' });
  const user = db.prepare('SELECT mfa_secret_enc FROM admin_users WHERE id = ?').get(req.adminUser!.id) as { mfa_secret_enc: string };
  const secret = decryptSecret(user.mfa_secret_enc);
  if (!secret || !verifySync({ token: code.trim(), secret }).valid) {
    return res.status(400).json({ error: 'Invalid 6-digit TOTP code.' });
  }
  db.prepare(`UPDATE admin_users SET mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?`).run(req.adminUser!.id);
  logAudit(req.adminUser!.email, 'ENABLE_MFA', 'admin_user', String(req.adminUser!.id), '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/auth/mfa/disable', (req: AuthedRequest, res) => {
  const { currentPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, req.adminUser!.password_hash)) {
    return res.status(401).json({ error: 'Password verification required to disable MFA.' });
  }
  db.prepare(`UPDATE admin_users SET mfa_enabled = 0, mfa_secret_enc = '', updated_at = datetime('now') WHERE id = ?`).run(
    req.adminUser!.id
  );
  logAudit(req.adminUser!.email, 'DISABLE_MFA', 'admin_user', String(req.adminUser!.id), '', req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 2. DASHBOARD OVERVIEW & SYSTEM HEALTH
// ---------------------------------------------------------------------------

adminRouter.get('/overview', (_req, res) => {
  const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects WHERE is_archived = 0').get() as any).c;
  const publishedProjects = (db.prepare('SELECT COUNT(*) as c FROM projects WHERE is_published = 1 AND is_archived = 0').get() as any).c;
  const totalCertificates = (db.prepare('SELECT COUNT(*) as c FROM certificates WHERE is_archived = 0').get() as any).c;
  const companiesCount = (db.prepare('SELECT COUNT(*) as c FROM companies WHERE is_archived = 0').get() as any).c;
  const rolesCount = (db.prepare('SELECT COUNT(*) as c FROM experience_roles').get() as any).c;
  const unreadMessages = (db.prepare(`SELECT COUNT(*) as c FROM recruiter_conversations WHERE status = 'New'`).get() as any).c;
  const totalConversations = (db.prepare('SELECT COUNT(*) as c FROM recruiter_conversations').get() as any).c;
  const aiConversations = (db.prepare('SELECT COUNT(*) as c FROM ai_conversations').get() as any).c;
  const kbDocs = (db.prepare(`SELECT COUNT(*) as c FROM knowledge_documents WHERE status = 'indexed'`).get() as any).c;
  const lastSync = db.prepare('SELECT MAX(last_indexed_at) as ts FROM knowledge_documents').get() as { ts: string | null };
  const activeProvider = db.prepare('SELECT name, model_name, last_status FROM ai_providers WHERE is_active = 1 LIMIT 1').get();
  const smtp = db.prepare('SELECT host, is_enabled FROM smtp_settings WHERE id = 1').get() as any;
  const ghSynced = (db.prepare('SELECT COUNT(*) as c FROM github_repos').get() as any).c;
  const ghPending = (db.prepare(`SELECT COUNT(*) as c FROM github_repos WHERE approval_status = 'discovered'`).get() as any).c;
  const recentAudit = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 12').all();
  const projectsByCategory = db
    .prepare('SELECT category, COUNT(*) as count FROM projects WHERE is_archived = 0 GROUP BY category')
    .all();

  res.json({
    stats: {
      totalProjects,
      publishedProjects,
      totalCertificates,
      companiesCount,
      rolesCount,
      unreadMessages,
      totalConversations,
      aiConversations,
      kbDocs,
      lastKbSync: lastSync?.ts || null,
      ghSynced,
      ghPending,
    },
    activeProvider,
    smtpStatus: {
      configured: Boolean(smtp?.host),
      enabled: Boolean(smtp?.is_enabled),
    },
    projectsByCategory,
    recentAudit,
  });
});

// ---------------------------------------------------------------------------
// 3. PROFILE, ABOUT & RESUME MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get('/profile', (_req, res) => {
  res.json(db.prepare('SELECT * FROM profile_settings WHERE id = 1').get());
});

adminRouter.put('/profile', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE profile_settings SET
      full_name = ?, headline = ?, subheadline = ?, bio_short = ?, bio_long = ?,
      about_what_i_build = ?, about_problem_solving = ?, about_career_goals = ?,
      location = ?, email = ?, github_url = ?, linkedin_url = ?,
      availability_enabled = ?, availability_label = ?,
      avatar_url = ?, cover_url = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(
    String(b.full_name || 'Abdullah Naveed'),
    String(b.headline || ''),
    String(b.subheadline || ''),
    String(b.bio_short || ''),
    String(b.bio_long || ''),
    String(b.about_what_i_build || ''),
    String(b.about_problem_solving || ''),
    String(b.about_career_goals || ''),
    String(b.location || ''),
    String(b.email || ''),
    String(b.github_url || ''),
    String(b.linkedin_url || ''),
    b.availability_enabled ? 1 : 0,
    String(b.availability_label || ''),
    String(b.avatar_url || ''),
    String(b.cover_url || '')
  );
  logAudit(req.adminUser!.email, 'UPDATE_PROFILE', 'profile', '1', 'Updated profile/about', req.ip || '');
  res.json(db.prepare('SELECT * FROM profile_settings WHERE id = 1').get());
});

adminRouter.post('/resume/upload', adminUpload.single('file'), (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file required.' });
  if (req.file.mimetype !== 'application/pdf' || !validateFileMagicBytes(req.file.buffer, 'application/pdf')) {
    return res.status(400).json({ error: 'Valid PDF file required for resume.' });
  }
  const filename = `resume_${Date.now()}.pdf`;
  const targetPath = path.resolve(PUBLIC_UPLOADS_DIR, filename);
  fs.writeFileSync(targetPath, req.file.buffer);
  const publicUrl = `/uploads/public/${filename}`;

  db.prepare(`UPDATE profile_settings SET resume_url = ?, resume_filename = ?, updated_at = datetime('now') WHERE id = 1`).run(
    publicUrl,
    req.file.originalname.slice(0, 120)
  );
  logAudit(req.adminUser!.email, 'UPLOAD_RESUME', 'resume', filename, req.file.originalname, req.ip || '');
  res.json({ resume_url: publicUrl, resume_filename: req.file.originalname });
});

// ---------------------------------------------------------------------------
// 4. EXPERIENCE (COMPANIES + ROLES) & EDUCATION
// ---------------------------------------------------------------------------

adminRouter.get('/experience', (_req, res) => {
  const companies = db.prepare('SELECT * FROM companies ORDER BY sort_order ASC, id ASC').all() as any[];
  const rolesStmt = db.prepare('SELECT * FROM experience_roles WHERE company_id = ? ORDER BY sort_order ASC, id ASC');
  res.json(
    companies.map((c) => ({
      ...c,
      roles: (rolesStmt.all(c.id) as any[]).map((r) => ({
        ...r,
        responsibilities: JSON.parse(r.responsibilities_json || '[]'),
        skills: JSON.parse(r.skills_json || '[]'),
      })),
    }))
  );
});

adminRouter.post('/companies', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const info = db
    .prepare(
      `INSERT INTO companies (name, location, arrangement, overall_dates, description, website_url, sort_order, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.name || '').trim(),
      String(b.location || '').trim(),
      String(b.arrangement || 'Remote'),
      String(b.overall_dates || '').trim(),
      String(b.description || ''),
      String(b.website_url || ''),
      Number(b.sort_order) || 0,
      b.is_public === false ? 0 : 1
    );
  logAudit(req.adminUser!.email, 'CREATE_COMPANY', 'company', String(info.lastInsertRowid), String(b.name || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/companies/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE companies SET name = ?, location = ?, arrangement = ?, overall_dates = ?, description = ?, website_url = ?, sort_order = ?, is_public = ?, is_archived = ? WHERE id = ?`
  ).run(
    String(b.name || ''),
    String(b.location || ''),
    String(b.arrangement || 'Remote'),
    String(b.overall_dates || ''),
    String(b.description || ''),
    String(b.website_url || ''),
    Number(b.sort_order) || 0,
    b.is_public ? 1 : 0,
    b.is_archived ? 1 : 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_COMPANY', 'company', req.params.id, String(b.name || ''), req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/companies/:id/roles', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const info = db
    .prepare(
      `INSERT INTO experience_roles (company_id, title, employment_type, start_date, end_date, is_current, description, responsibilities_json, skills_json, evidence_note, is_public, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(req.params.id),
      String(b.title || '').trim(),
      String(b.employment_type || 'Full-time'),
      String(b.start_date || ''),
      String(b.end_date || 'Present'),
      b.is_current ? 1 : 0,
      String(b.description || ''),
      JSON.stringify(Array.isArray(b.responsibilities) ? b.responsibilities : []),
      JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
      String(b.evidence_note || ''),
      b.is_public === false ? 0 : 1,
      Number(b.sort_order) || 0
    );
  logAudit(req.adminUser!.email, 'CREATE_ROLE', 'experience_role', String(info.lastInsertRowid), String(b.title || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/roles/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE experience_roles SET title = ?, employment_type = ?, start_date = ?, end_date = ?, is_current = ?, description = ?, responsibilities_json = ?, skills_json = ?, evidence_note = ?, is_public = ?, sort_order = ? WHERE id = ?`
  ).run(
    String(b.title || ''),
    String(b.employment_type || 'Full-time'),
    String(b.start_date || ''),
    String(b.end_date || 'Present'),
    b.is_current ? 1 : 0,
    String(b.description || ''),
    JSON.stringify(Array.isArray(b.responsibilities) ? b.responsibilities : []),
    JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
    String(b.evidence_note || ''),
    b.is_public ? 1 : 0,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_ROLE', 'experience_role', req.params.id, String(b.title || ''), req.ip || '');
  res.json({ ok: true });
});

adminRouter.delete('/roles/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM experience_roles WHERE id = ?').run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'DELETE_ROLE', 'experience_role', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.get('/education', (_req, res) => {
  res.json(db.prepare('SELECT * FROM education ORDER BY sort_order ASC, id ASC').all());
});

adminRouter.post('/education', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const info = db
    .prepare(
      `INSERT INTO education (institution, degree, field, student_name, start_date, end_date, details, is_public, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.institution || ''),
      String(b.degree || ''),
      String(b.field || ''),
      String(b.student_name || 'Abdullah Naveed'),
      String(b.start_date || ''),
      String(b.end_date || ''),
      String(b.details || ''),
      b.is_public === false ? 0 : 1,
      Number(b.sort_order) || 0
    );
  logAudit(req.adminUser!.email, 'CREATE_EDUCATION', 'education', String(info.lastInsertRowid), String(b.institution || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/education/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(
    `UPDATE education SET institution = ?, degree = ?, field = ?, student_name = ?, start_date = ?, end_date = ?, details = ?, is_public = ?, sort_order = ? WHERE id = ?`
  ).run(
    String(b.institution || ''),
    String(b.degree || ''),
    String(b.field || ''),
    String(b.student_name || 'Abdullah Naveed'),
    String(b.start_date || ''),
    String(b.end_date || ''),
    String(b.details || ''),
    b.is_public ? 1 : 0,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_EDUCATION', 'education', req.params.id, String(b.institution || ''), req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 5. SKILLS MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get('/skills', (_req, res) => {
  const cats = db.prepare('SELECT * FROM skill_categories ORDER BY sort_order ASC').all() as any[];
  const stmt = db.prepare('SELECT * FROM skills WHERE category_id = ? ORDER BY sort_order ASC');
  res.json(cats.map((c) => ({ ...c, skills: stmt.all(c.id) })));
});

adminRouter.post('/skills', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const info = db
    .prepare(`INSERT INTO skills (category_id, name, proficiency_label, is_published, sort_order) VALUES (?, ?, ?, ?, ?)`)
    .run(
      Number(b.category_id),
      String(b.name || '').trim(),
      String(b.proficiency_label || '').trim(),
      b.is_published === false ? 0 : 1,
      Number(b.sort_order) || 0
    );
  logAudit(req.adminUser!.email, 'CREATE_SKILL', 'skill', String(info.lastInsertRowid), String(b.name || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/skills/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(`UPDATE skills SET category_id = ?, name = ?, proficiency_label = ?, is_published = ?, sort_order = ? WHERE id = ?`).run(
    Number(b.category_id),
    String(b.name || '').trim(),
    String(b.proficiency_label || '').trim(),
    b.is_published ? 1 : 0,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_SKILL', 'skill', req.params.id, String(b.name || ''), req.ip || '');
  res.json({ ok: true });
});

adminRouter.delete('/skills/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM skills WHERE id = ?').run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'DELETE_SKILL', 'skill', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 6. PROJECTS & GITHUB INTEGRATION
// ---------------------------------------------------------------------------

adminRouter.get('/projects', (_req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, id DESC').all() as any[];
  res.json(
    rows.map((p) => ({
      ...p,
      technologies: JSON.parse(p.technologies_json || '[]'),
      features: JSON.parse(p.features_json || '[]'),
      challenges: JSON.parse(p.challenges_json || '[]'),
      verified_results: JSON.parse(p.verified_results_json || '[]'),
    }))
  );
});

adminRouter.post('/projects', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const slug = String(b.slug || b.title || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const info = db
    .prepare(`
      INSERT INTO projects (
        slug, title, category, tagline, overview, problem_statement, solution_summary,
        architecture_notes, frontend_stack, backend_stack, database_stack, ai_models_stack,
        rag_pipeline_notes, technologies_json, features_json, challenges_json, verified_results_json,
        cover_image, github_url, live_url, github_repo_name, company_id, is_featured, is_published, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      slug,
      String(b.title || ''),
      String(b.category || 'AI & Machine Learning'),
      String(b.tagline || ''),
      String(b.overview || ''),
      String(b.problem_statement || ''),
      String(b.solution_summary || ''),
      String(b.architecture_notes || ''),
      String(b.frontend_stack || ''),
      String(b.backend_stack || ''),
      String(b.database_stack || ''),
      String(b.ai_models_stack || ''),
      String(b.rag_pipeline_notes || ''),
      JSON.stringify(Array.isArray(b.technologies) ? b.technologies : []),
      JSON.stringify(Array.isArray(b.features) ? b.features : []),
      JSON.stringify(Array.isArray(b.challenges) ? b.challenges : []),
      JSON.stringify(Array.isArray(b.verified_results) ? b.verified_results : []),
      String(b.cover_image || '/src/assets/images/project_omnisynth_cover_1795329338795.jpg'),
      String(b.github_url || ''),
      String(b.live_url || ''),
      String(b.github_repo_name || ''),
      b.company_id ? Number(b.company_id) : null,
      b.is_featured ? 1 : 0,
      b.is_published ? 1 : 0,
      Number(b.sort_order) || 0
    );

  logAudit(req.adminUser!.email, 'CREATE_PROJECT', 'project', String(info.lastInsertRowid), String(b.title || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid, slug });
});

adminRouter.put('/projects/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE projects SET
      title = ?, category = ?, tagline = ?, overview = ?, problem_statement = ?, solution_summary = ?,
      architecture_notes = ?, frontend_stack = ?, backend_stack = ?, database_stack = ?, ai_models_stack = ?,
      rag_pipeline_notes = ?, technologies_json = ?, features_json = ?, challenges_json = ?, verified_results_json = ?,
      cover_image = ?, github_url = ?, live_url = ?, is_featured = ?, is_published = ?, is_archived = ?, sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(b.title || ''),
    String(b.category || 'AI & Machine Learning'),
    String(b.tagline || ''),
    String(b.overview || ''),
    String(b.problem_statement || ''),
    String(b.solution_summary || ''),
    String(b.architecture_notes || ''),
    String(b.frontend_stack || ''),
    String(b.backend_stack || ''),
    String(b.database_stack || ''),
    String(b.ai_models_stack || ''),
    String(b.rag_pipeline_notes || ''),
    JSON.stringify(Array.isArray(b.technologies) ? b.technologies : []),
    JSON.stringify(Array.isArray(b.features) ? b.features : []),
    JSON.stringify(Array.isArray(b.challenges) ? b.challenges : []),
    JSON.stringify(Array.isArray(b.verified_results) ? b.verified_results : []),
    String(b.cover_image || ''),
    String(b.github_url || ''),
    String(b.live_url || ''),
    b.is_featured ? 1 : 0,
    b.is_published ? 1 : 0,
    b.is_archived ? 1 : 0,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_PROJECT', 'project', req.params.id, String(b.title || ''), req.ip || '');
  res.json({ ok: true });
});

adminRouter.delete('/projects/:id', (req: AuthedRequest, res) => {
  db.prepare(`UPDATE projects SET is_archived = 1, is_published = 0 WHERE id = ?`).run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'ARCHIVE_PROJECT', 'project', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.get('/github/repos', (_req, res) => {
  res.json(db.prepare('SELECT * FROM github_repos ORDER BY synced_at DESC, id ASC').all());
});

adminRouter.post('/github/sync', async (req: AuthedRequest, res) => {
  const username = 'abdullah-v-cmd';
  const headers: Record<string, string> = { 'User-Agent': 'abdullah-portfolio-cms' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const ghRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!ghRes.ok) {
      return res.status(502).json({ error: `GitHub API returned HTTP ${ghRes.status}` });
    }
    const repos = (await ghRes.json()) as any[];
    const upsert = db.prepare(`
      INSERT INTO github_repos (name, full_name, description, language, html_url, homepage, stars, forks, updated_at_gh, topics_json, approval_status, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', datetime('now'))
      ON CONFLICT(name) DO UPDATE SET
        description = COALESCE(NULLIF(excluded.description, ''), github_repos.description),
        language = COALESCE(excluded.language, github_repos.language),
        homepage = COALESCE(excluded.homepage, github_repos.homepage),
        stars = excluded.stars,
        forks = excluded.forks,
        updated_at_gh = excluded.updated_at_gh,
        topics_json = excluded.topics_json,
        synced_at = datetime('now')
    `);

    db.transaction(() => {
      for (const r of repos) {
        upsert.run(
          r.name,
          r.full_name,
          r.description || '',
          r.language || '',
          r.html_url,
          r.homepage || '',
          r.stargazers_count || 0,
          r.forks_count || 0,
          r.updated_at || '',
          JSON.stringify(r.topics || [])
        );
      }
    })();

    logAudit(req.adminUser!.email, 'GITHUB_SYNC', 'github', username, `Synced ${repos.length} repositories`, req.ip || '');
    return res.json({ synced: repos.length, repos: db.prepare('SELECT * FROM github_repos ORDER BY id ASC').all() });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'GitHub sync failed.' });
  }
});

adminRouter.post('/github/repos/:id/approve', async (req: AuthedRequest, res) => {
  const repo = db.prepare('SELECT * FROM github_repos WHERE id = ?').get(Number(req.params.id)) as any;
  if (!repo) return res.status(404).json({ error: 'Repository not found.' });

  // Fetch README excerpt for honest inspection before draft creation
  let readmeExcerpt = repo.readme_excerpt || '';
  try {
    const readmeRes = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/main/README.md`, {
      signal: AbortSignal.timeout(8000),
    });
    if (readmeRes.ok) {
      readmeExcerpt = (await readmeRes.text()).slice(0, 1200);
    }
  } catch {
    // Optional README fetch
  }

  const slug = repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug) as { id: number } | undefined;

  let projectId = existing?.id;
  if (!projectId) {
    const info = db
      .prepare(`
        INSERT INTO projects (
          slug, title, category, tagline, overview, technologies_json,
          cover_image, github_url, live_url, github_repo_name, is_featured, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      `)
      .run(
        slug,
        repo.name.replace(/[-_]/g, ' '),
        repo.language === 'Python' ? 'AI & Machine Learning' : 'Full-Stack Development',
        repo.description || `Repository imported from ${repo.full_name}.`,
        readmeExcerpt || repo.description || `Imported from GitHub repository ${repo.full_name}. Edit before publishing.`,
        JSON.stringify(repo.language ? [repo.language] : []),
        '/src/assets/images/project_mlops_cover_1795329338117.jpg',
        repo.html_url,
        repo.homepage || '',
        repo.name
      );
    projectId = Number(info.lastInsertRowid);
  }

  db.prepare(`UPDATE github_repos SET approval_status = 'approved', readme_excerpt = ?, linked_project_id = ? WHERE id = ?`).run(
    readmeExcerpt,
    projectId,
    repo.id
  );
  logAudit(req.adminUser!.email, 'GITHUB_APPROVE', 'github_repo', String(repo.id), `Draft project #${projectId} created`, req.ip || '');
  res.json({ ok: true, projectId });
});

adminRouter.post('/github/repos/:id/hide', (req: AuthedRequest, res) => {
  db.prepare(`UPDATE github_repos SET approval_status = 'hidden' WHERE id = ?`).run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'GITHUB_HIDE', 'github_repo', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 7. CERTIFICATES MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get('/certificates', (_req, res) => {
  const rows = db.prepare('SELECT * FROM certificates ORDER BY sort_order ASC, id DESC').all() as any[];
  res.json(rows.map((c) => ({ ...c, skills: JSON.parse(c.skills_json || '[]') })));
});

adminRouter.post('/certificates/upload', adminUpload.single('file'), (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required.' });
  if (!validateFileMagicBytes(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ error: 'File signature failed validation.' });
  }
  const ext = path.extname(req.file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.pdf';
  const filename = `cert_${Date.now()}_${generateSecureToken(4)}${ext}`;
  const targetPath = path.resolve(PUBLIC_UPLOADS_DIR, filename);
  fs.writeFileSync(targetPath, req.file.buffer);
  res.json({
    file_url: `/uploads/public/${filename}`,
    file_type: req.file.mimetype === 'application/pdf' ? 'pdf' : 'image',
  });
});

adminRouter.post('/certificates', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const info = db
    .prepare(`
      INSERT INTO certificates (title, issuer, issue_date, expiry_date, credential_id, verify_url, file_url, file_type, description, skills_json, is_featured, is_public, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      String(b.title || ''),
      String(b.issuer || ''),
      String(b.issue_date || ''),
      String(b.expiry_date || ''),
      String(b.credential_id || ''),
      String(b.verify_url || ''),
      String(b.file_url || ''),
      String(b.file_type || 'pdf'),
      String(b.description || ''),
      JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
      b.is_featured ? 1 : 0,
      b.is_public === false ? 0 : 1,
      Number(b.sort_order) || 0
    );
  logAudit(req.adminUser!.email, 'CREATE_CERTIFICATE', 'certificate', String(info.lastInsertRowid), String(b.title || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/certificates/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE certificates SET title = ?, issuer = ?, issue_date = ?, expiry_date = ?, credential_id = ?, verify_url = ?, file_url = ?, file_type = ?, description = ?, skills_json = ?, is_featured = ?, is_public = ?, is_archived = ?
    WHERE id = ?
  `).run(
    String(b.title || ''),
    String(b.issuer || ''),
    String(b.issue_date || ''),
    String(b.expiry_date || ''),
    String(b.credential_id || ''),
    String(b.verify_url || ''),
    String(b.file_url || ''),
    String(b.file_type || 'pdf'),
    String(b.description || ''),
    JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
    b.is_featured ? 1 : 0,
    b.is_public ? 1 : 0,
    b.is_archived ? 1 : 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_CERTIFICATE', 'certificate', req.params.id, String(b.title || ''), req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 8. AI PROVIDERS & KNOWLEDGE BASE MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get('/ai/providers', (_req, res) => {
  const rows = db.prepare('SELECT * FROM ai_providers ORDER BY is_active DESC, id ASC').all() as any[];
  res.json(
    rows.map((p) => {
      const dec = decryptSecret(p.api_key_enc);
      return {
        id: p.id,
        name: p.name,
        provider_type: p.provider_type,
        base_url: p.base_url,
        model_name: p.model_name,
        embedding_model: p.embedding_model,
        has_api_key: Boolean(dec) || (p.provider_type === 'gemini' && Boolean(process.env.GEMINI_API_KEY)),
        masked_api_key: dec ? maskSecret(dec) : p.provider_type === 'gemini' && process.env.GEMINI_API_KEY ? 'Server Env Key Active' : '',
        is_active: Boolean(p.is_active),
        is_fallback: Boolean(p.is_fallback),
        max_tokens: p.max_tokens,
        rate_limit_rpm: p.rate_limit_rpm,
        last_status: p.last_status,
        last_error: p.last_error,
        updated_at: p.updated_at,
      };
    })
  );
});

adminRouter.post('/ai/providers', requireRole(['owner', 'admin']), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (b.provider_type === 'openai_compatible') {
    const check = validateExternalProviderUrl(String(b.base_url || ''));
    if (!check.ok) return res.status(400).json({ error: check.error });
  }
  const keyEnc = b.api_key ? encryptSecret(String(b.api_key).trim()) : '';
  const info = db
    .prepare(`
      INSERT INTO ai_providers (name, provider_type, base_url, model_name, embedding_model, api_key_enc, max_tokens, rate_limit_rpm, last_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      String(b.name || 'Custom Provider'),
      String(b.provider_type || 'openai_compatible'),
      String(b.base_url || ''),
      String(b.model_name || ''),
      String(b.embedding_model || 'local-semantic-v1'),
      keyEnc,
      Number(b.max_tokens) || 1024,
      Number(b.rate_limit_rpm) || 30,
      keyEnc ? 'configured' : 'awaiting_api_key'
    );
  logAudit(req.adminUser!.email, 'CREATE_AI_PROVIDER', 'ai_provider', String(info.lastInsertRowid), String(b.name || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/ai/providers/:id', requireRole(['owner', 'admin']), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) return res.status(404).json({ error: 'Provider not found.' });

  if ((b.provider_type || existing.provider_type) === 'openai_compatible') {
    const check = validateExternalProviderUrl(String(b.base_url || existing.base_url || ''));
    if (!check.ok) return res.status(400).json({ error: check.error });
  }

  const nextKeyEnc = b.api_key && String(b.api_key).trim() ? encryptSecret(String(b.api_key).trim()) : existing.api_key_enc;
  db.prepare(`
    UPDATE ai_providers SET name = ?, base_url = ?, model_name = ?, embedding_model = ?, api_key_enc = ?, max_tokens = ?, rate_limit_rpm = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(b.name || existing.name),
    String(b.base_url || existing.base_url),
    String(b.model_name || existing.model_name),
    String(b.embedding_model || existing.embedding_model),
    nextKeyEnc,
    Number(b.max_tokens) || existing.max_tokens,
    Number(b.rate_limit_rpm) || existing.rate_limit_rpm,
    existing.id
  );
  logAudit(req.adminUser!.email, 'UPDATE_AI_PROVIDER', 'ai_provider', req.params.id, String(b.name || existing.name), req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/ai/providers/:id/activate', (req: AuthedRequest, res) => {
  db.transaction(() => {
    db.prepare('UPDATE ai_providers SET is_active = 0').run();
    db.prepare('UPDATE ai_providers SET is_active = 1 WHERE id = ?').run(Number(req.params.id));
  })();
  logAudit(req.adminUser!.email, 'ACTIVATE_AI_PROVIDER', 'ai_provider', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/ai/providers/:id/test', async (req: AuthedRequest, res) => {
  const result = await testAiProviderConnection(Number(req.params.id));
  logAudit(req.adminUser!.email, 'TEST_AI_PROVIDER', 'ai_provider', req.params.id, result.message, req.ip || '');
  res.json(result);
});

adminRouter.get('/ai/knowledge', (_req, res) => {
  const docs = db
    .prepare('SELECT id, source_type, source_id, title, content, scope, token_estimate, status, error_message, last_indexed_at FROM knowledge_documents ORDER BY id DESC')
    .all();
  res.json(docs);
});

adminRouter.post('/ai/knowledge', (req: AuthedRequest, res) => {
  const { title, content, scope } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content required.' });
  const safeScope = scope === 'public' ? 'public' : 'private';
  const info = db
    .prepare(`INSERT INTO knowledge_documents (source_type, source_id, title, content, scope, status) VALUES ('custom', ?, ?, ?, ?, 'pending')`)
    .run(generateSecureToken(4), String(title).trim(), String(content).trim(), safeScope);
  const summary = rebuildPublicKnowledgeBase();
  logAudit(req.adminUser!.email, 'ADD_KNOWLEDGE_DOC', 'knowledge', String(info.lastInsertRowid), `${safeScope}: ${title}`, req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid, ...summary });
});

adminRouter.delete('/ai/knowledge/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'DELETE_KNOWLEDGE_DOC', 'knowledge', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/ai/knowledge/sync', (req: AuthedRequest, res) => {
  const result = rebuildPublicKnowledgeBase();
  logAudit(req.adminUser!.email, 'SYNC_AI_KNOWLEDGE', 'knowledge', 'all', `Indexed ${result.indexedCount} docs`, req.ip || '');
  res.json(result);
});

adminRouter.post('/ai/knowledge/test-query', async (req: AuthedRequest, res) => {
  const { query, includePrivate } = req.body || {};
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Query required.' });
  const chunks = retrieveKnowledgeChunks(query, 5, Boolean(includePrivate));
  try {
    const aiRes = await queryAbdullahAI({
      message: query,
      history: [],
      includePrivate: Boolean(includePrivate),
    });
    res.json({ chunks, aiResult: aiRes });
  } catch (err: any) {
    res.json({ chunks, aiError: err?.message || 'AI error' });
  }
});

// ---------------------------------------------------------------------------
// 9. SMTP EMAIL SETTINGS & RECRUITER TWO-WAY MESSAGING
// ---------------------------------------------------------------------------

adminRouter.get('/smtp', (_req, res) => {
  const row = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get() as any;
  const logs = db.prepare('SELECT * FROM email_delivery_logs ORDER BY id DESC LIMIT 30').all();
  res.json({
    settings: row
      ? {
          host: row.host,
          port: row.port,
          username: row.username,
          has_password: Boolean(row.password_enc),
          from_email: row.from_email,
          from_name: row.from_name,
          reply_to: row.reply_to,
          notification_email: row.notification_email,
          encryption_mode: row.encryption_mode,
          is_enabled: Boolean(row.is_enabled),
          has_inbound_secret: Boolean(row.inbound_webhook_secret_enc),
          updated_at: row.updated_at,
        }
      : null,
    logs,
  });
});

adminRouter.put('/smtp', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT password_enc, inbound_webhook_secret_enc FROM smtp_settings WHERE id = 1').get() as any;
  const passEnc = b.password && String(b.password).trim() ? encryptSecret(String(b.password).trim()) : existing?.password_enc || '';
  const webhookEnc =
    b.inbound_webhook_secret && String(b.inbound_webhook_secret).trim()
      ? encryptSecret(String(b.inbound_webhook_secret).trim())
      : existing?.inbound_webhook_secret_enc || '';

  db.prepare(`
    UPDATE smtp_settings SET
      host = ?, port = ?, username = ?, password_enc = ?, from_email = ?, from_name = ?,
      reply_to = ?, notification_email = ?, encryption_mode = ?, is_enabled = ?,
      inbound_webhook_secret_enc = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(
    String(b.host || '').trim(),
    Number(b.port) || 587,
    String(b.username || '').trim(),
    passEnc,
    String(b.from_email || '').trim(),
    String(b.from_name || 'Abdullah Naveed').trim(),
    String(b.reply_to || '').trim(),
    String(b.notification_email || '').trim(),
    String(b.encryption_mode || 'starttls'),
    b.is_enabled ? 1 : 0,
    webhookEnc
  );

  logAudit(req.adminUser!.email, 'UPDATE_SMTP', 'smtp', '1', `Host: ${b.host || 'unset'}`, req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/smtp/test-connection', async (req: AuthedRequest, res) => {
  const result = await testSmtpConnection();
  logAudit(req.adminUser!.email, 'TEST_SMTP_CONNECTION', 'smtp', '1', result.message, req.ip || '');
  res.json(result);
});

adminRouter.post('/smtp/test-email', async (req: AuthedRequest, res) => {
  const { to } = req.body || {};
  if (!to || typeof to !== 'string') return res.status(400).json({ error: 'Recipient email required.' });
  const result = await sendEmailViaSmtp({
    to: to.trim(),
    subject: 'Portfolio SMTP Verification Test',
    text: 'This is a verification email from Abdullah Naveed Portfolio Admin CMS.',
    forceEvenIfDisabled: true,
  });
  logAudit(req.adminUser!.email, 'SEND_TEST_EMAIL', 'smtp', to.trim(), result.message, req.ip || '');
  res.json(result);
});

adminRouter.get('/messages', (_req, res) => {
  const convs = db.prepare('SELECT * FROM recruiter_conversations ORDER BY updated_at DESC, id DESC').all() as any[];
  const msgStmt = db.prepare('SELECT * FROM recruiter_messages WHERE conversation_id = ? ORDER BY id ASC');
  res.json(convs.map((c) => ({ ...c, messages: msgStmt.all(c.id) })));
});

adminRouter.patch('/messages/:id/status', (req: AuthedRequest, res) => {
  const { status } = req.body || {};
  const allowed = ['New', 'Read', 'In Progress', 'Replied', 'Closed', 'Spam'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare(`UPDATE recruiter_conversations SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    status,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_MESSAGE_STATUS', 'recruiter_conversation', req.params.id, status, req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/messages/:id/reply', async (req: AuthedRequest, res) => {
  const { body, sendEmail } = req.body || {};
  if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'Reply text is required.' });
  const conv = db.prepare('SELECT * FROM recruiter_conversations WHERE id = ?').get(Number(req.params.id)) as any;
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  db.transaction(() => {
    db.prepare(
      `INSERT INTO recruiter_messages (conversation_id, sender_type, sender_name, body) VALUES (?, 'admin', ?, ?)`
    ).run(conv.id, req.adminUser!.display_name, body.trim());
    db.prepare(`UPDATE recruiter_conversations SET status = 'Replied', updated_at = datetime('now') WHERE id = ?`).run(
      conv.id
    );
  })();

  let emailResult: any = { ok: false, message: 'Saved in portal thread (email sending not requested).' };
  if (sendEmail) {
    emailResult = await sendEmailViaSmtp({
      to: conv.recruiter_email,
      subject: `Re: ${conv.subject} [Ref: ${conv.thread_token.slice(0, 8)}]`,
      text: `${body.trim()}\n\n---\nThread Reference: ${conv.thread_token}`,
    });
  }

  logAudit(req.adminUser!.email, 'REPLY_RECRUITER', 'recruiter_conversation', String(conv.id), emailResult.message, req.ip || '');
  res.json({ ok: true, emailResult });
});

// ---------------------------------------------------------------------------
// 10. THEME / VISUAL SETTINGS, AUDIT LOGS, PRIVATE FILES & BACKUP
// ---------------------------------------------------------------------------

adminRouter.get('/theme', (_req, res) => {
  const row = db.prepare('SELECT * FROM theme_settings WHERE id = 1').get() as any;
  res.json({
    ...row,
    section_order: JSON.parse(row.section_order_json || '[]'),
    hidden_sections: JSON.parse(row.hidden_sections_json || '[]'),
  });
});

adminRouter.put('/theme', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE theme_settings SET
      accent_color = ?, secondary_accent = ?, intro_enabled = ?, profile_selector_enabled = ?,
      three_d_enabled = ?, animation_intensity = ?, hero_cta_primary = ?, hero_cta_secondary = ?,
      section_order_json = ?, hidden_sections_json = ?, seo_title = ?, seo_description = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(
    String(b.accent_color || '#dc2626'),
    String(b.secondary_accent || '#3b82f6'),
    b.intro_enabled ? 1 : 0,
    b.profile_selector_enabled ? 1 : 0,
    b.three_d_enabled ? 1 : 0,
    String(b.animation_intensity || 'cinematic'),
    String(b.hero_cta_primary || 'Explore My Work'),
    String(b.hero_cta_secondary || 'Meet Abdullah AI'),
    JSON.stringify(Array.isArray(b.section_order) ? b.section_order : ['projects', 'skills', 'experience', 'credentials', 'about', 'contact']),
    JSON.stringify(Array.isArray(b.hidden_sections) ? b.hidden_sections : []),
    String(b.seo_title || ''),
    String(b.seo_description || '')
  );
  logAudit(req.adminUser!.email, 'UPDATE_THEME', 'theme', '1', 'Updated visual/SEO configuration', req.ip || '');
  res.json({ ok: true });
});

adminRouter.get('/audit-logs', (_req, res) => {
  res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all());
});

adminRouter.get('/ai-conversations', (_req, res) => {
  const convs = db.prepare('SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT 50').all() as any[];
  const msgStmt = db.prepare('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC');
  res.json(convs.map((c) => ({ ...c, messages: msgStmt.all(c.id) })));
});

adminRouter.get('/files/private/:filename', (req: AuthedRequest, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.resolve(PRIVATE_UPLOADS_DIR, safeName);
  if (!fullPath.startsWith(PRIVATE_UPLOADS_DIR + path.sep) || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  return res.sendFile(fullPath);
});

adminRouter.get('/backup/export', requireRole(['owner']), (req: AuthedRequest, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    profile: db.prepare('SELECT * FROM profile_settings').all(),
    theme: db.prepare('SELECT * FROM theme_settings').all(),
    companies: db.prepare('SELECT * FROM companies').all(),
    experience_roles: db.prepare('SELECT * FROM experience_roles').all(),
    education: db.prepare('SELECT * FROM education').all(),
    skill_categories: db.prepare('SELECT * FROM skill_categories').all(),
    skills: db.prepare('SELECT * FROM skills').all(),
    projects: db.prepare('SELECT * FROM projects').all(),
    certificates: db.prepare('SELECT * FROM certificates').all(),
    knowledge_documents: db.prepare('SELECT id, source_type, source_id, title, content, scope FROM knowledge_documents').all(),
  };
  logAudit(req.adminUser!.email, 'EXPORT_BACKUP', 'database', 'full', 'Exported non-secret portfolio JSON backup', req.ip || '');
  res.setHeader('Content-Disposition', `attachment; filename="abdullah-portfolio-backup-${Date.now()}.json"`);
  res.json(backup);
});
