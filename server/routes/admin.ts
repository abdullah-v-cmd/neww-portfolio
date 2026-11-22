import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { db, getGroqEnvKey, PRIVATE_UPLOADS_DIR, PUBLIC_UPLOADS_DIR } from '../db.ts';
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
  extractTextFromDocumentBuffer,
  queryAbdullahAI,
  rebuildPublicKnowledgeBase,
  resolveProviderApiKey,
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
      'text/markdown',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file format. Allowed: PDF, DOCX, TXT, MD, PNG, JPG, WEBP.'));
    }
    cb(null, true);
  },
});

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'video/mp4',
      'video/webm',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported media format. Allowed: MP4, WebM, PNG, JPG, WEBP.'));
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
  const pendingCvRequests = (db.prepare(`SELECT COUNT(*) as c FROM cv_requests WHERE status IN ('New Request', 'Under Review')`).get() as any).c;
  const totalCvRequests = (db.prepare('SELECT COUNT(*) as c FROM cv_requests').get() as any).c;
  const aiConversations = (db.prepare('SELECT COUNT(*) as c FROM ai_conversations').get() as any).c;
  const kbDocs = (db.prepare(`SELECT COUNT(*) as c FROM knowledge_documents WHERE status = 'indexed'`).get() as any).c;
  const kbChunks = (db.prepare(`SELECT COUNT(*) as c FROM knowledge_chunks`).get() as any).c;
  const lastSync = db.prepare('SELECT MAX(last_indexed_at) as ts FROM knowledge_documents').get() as { ts: string | null };
  const activeProvider = db.prepare('SELECT name, model_name, last_status FROM ai_providers WHERE is_active = 1 LIMIT 1').get();
  const smtp = db.prepare('SELECT host, is_enabled FROM smtp_settings WHERE id = 1').get() as any;
  const ghSynced = (db.prepare('SELECT COUNT(*) as c FROM github_repos').get() as any).c;
  const ghPending = (db.prepare(`SELECT COUNT(*) as c FROM github_repos WHERE approval_status = 'discovered'`).get() as any).c;
  const pendingSkills = (db.prepare(`SELECT COUNT(*) as c FROM skills WHERE status = 'Admin Review Required'`).get() as any).c;
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
      pendingCvRequests,
      totalCvRequests,
      aiConversations,
      kbDocs,
      kbChunks,
      lastKbSync: lastSync?.ts || null,
      ghSynced,
      ghPending,
      pendingSkills,
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
// 3. PROFILE, ABOUT & RESUME VERSIONS
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

  db.transaction(() => {
    db.prepare(`UPDATE profile_settings SET resume_url = ?, resume_filename = ?, updated_at = datetime('now') WHERE id = 1`).run(
      publicUrl,
      req.file!.originalname.slice(0, 120)
    );
    db.prepare(`UPDATE resume_versions SET is_default = 0 WHERE scope = 'public'`).run();
    db.prepare(
      `INSERT INTO resume_versions (version_name, description, filename, file_url, storage_path, file_size, scope, is_active, is_default)
       VALUES (?, 'Uploaded via Profile & Resume panel', ?, ?, ?, ?, 'public', 1, 1)`
    ).run(req.file!.originalname.replace(/\.pdf$/i, '').slice(0, 80), req.file!.originalname.slice(0, 120), publicUrl, targetPath, req.file!.size);
  })();

  logAudit(req.adminUser!.email, 'UPLOAD_RESUME', 'resume', filename, req.file.originalname, req.ip || '');
  res.json({ resume_url: publicUrl, resume_filename: req.file.originalname });
});

adminRouter.get('/resumes', (_req, res) => {
  res.json(db.prepare(`SELECT * FROM resume_versions ORDER BY is_archived ASC, is_default DESC, id DESC`).all());
});

adminRouter.post('/resumes', adminUpload.single('file'), (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file is required.' });
  if (req.file.mimetype !== 'application/pdf' || !validateFileMagicBytes(req.file.buffer, 'application/pdf')) {
    return res.status(400).json({ error: 'Valid PDF file required.' });
  }

  const versionName = String(req.body?.versionName || req.file.originalname.replace(/\.pdf$/i, '')).trim().slice(0, 100);
  const description = String(req.body?.description || '').trim().slice(0, 300);
  const scope = req.body?.scope === 'public' ? 'public' : 'recruiter';
  const isDefault = req.body?.isDefault === 'true' || req.body?.isDefault === true ? 1 : 0;

  const storedName = `cv_${Date.now()}_${generateSecureToken(4)}.pdf`;
  const dir = scope === 'public' ? PUBLIC_UPLOADS_DIR : PRIVATE_UPLOADS_DIR;
  const targetPath = path.resolve(dir, storedName);
  fs.writeFileSync(targetPath, req.file.buffer);
  const fileUrl = scope === 'public' ? `/uploads/public/${storedName}` : `/api/admin/resumes/file/${storedName}`;

  const info = db.transaction(() => {
    if (isDefault) {
      db.prepare(`UPDATE resume_versions SET is_default = 0`).run();
    }
    const inserted = db
      .prepare(
        `INSERT INTO resume_versions (version_name, description, filename, file_url, storage_path, file_size, scope, is_active, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(versionName, description, req.file!.originalname.slice(0, 120), fileUrl, targetPath, req.file!.size, scope, isDefault);

    if (scope === 'public' && isDefault) {
      db.prepare(`UPDATE profile_settings SET resume_url = ?, resume_filename = ?, updated_at = datetime('now') WHERE id = 1`).run(
        fileUrl,
        req.file!.originalname.slice(0, 120)
      );
    }
    return inserted;
  })();

  logAudit(req.adminUser!.email, 'CREATE_RESUME_VERSION', 'resume_version', String(info.lastInsertRowid), `${versionName} (${scope})`, req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/resumes/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const existing = db.prepare(`SELECT * FROM resume_versions WHERE id = ?`).get(Number(req.params.id)) as any;
  if (!existing) return res.status(404).json({ error: 'Resume version not found.' });

  const nextDefault = b.is_default ? 1 : 0;
  db.transaction(() => {
    if (nextDefault) {
      db.prepare(`UPDATE resume_versions SET is_default = 0`).run();
    }
    db.prepare(
      `UPDATE resume_versions SET version_name = ?, description = ?, is_active = ?, is_default = ?, is_archived = ? WHERE id = ?`
    ).run(
      String(b.version_name || existing.version_name).slice(0, 100),
      String(b.description ?? existing.description).slice(0, 300),
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      nextDefault,
      b.is_archived ? 1 : 0,
      existing.id
    );
    if (nextDefault && existing.scope === 'public') {
      db.prepare(`UPDATE profile_settings SET resume_url = ?, resume_filename = ?, updated_at = datetime('now') WHERE id = 1`).run(
        existing.file_url,
        existing.filename
      );
    }
  })();

  logAudit(req.adminUser!.email, 'UPDATE_RESUME_VERSION', 'resume_version', req.params.id, String(b.version_name || existing.version_name), req.ip || '');
  res.json({ ok: true });
});

adminRouter.get('/resumes/:id/download', (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM resume_versions WHERE id = ?`).get(Number(req.params.id)) as any;
  if (!row || !row.storage_path || !fs.existsSync(row.storage_path)) {
    return res.status(404).json({ error: 'Resume PDF file not found on disk.' });
  }
  const resolved = path.resolve(row.storage_path);
  if (!resolved.startsWith(PRIVATE_UPLOADS_DIR + path.sep) && !resolved.startsWith(PUBLIC_UPLOADS_DIR + path.sep)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  res.setHeader('Content-Disposition', `inline; filename="${row.filename}"`);
  return res.sendFile(resolved);
});

adminRouter.delete('/resumes/:id', (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM resume_versions WHERE id = ?`).get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: 'Not found.' });
  db.prepare(`DELETE FROM resume_versions WHERE id = ?`).run(row.id);
  logAudit(req.adminUser!.email, 'DELETE_RESUME_VERSION', 'resume_version', req.params.id, row.version_name, req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 3B. RECRUITER CV REQUESTS & EMAIL ATTACHMENT DELIVERY
// ---------------------------------------------------------------------------

adminRouter.get('/cv-requests', (_req, res) => {
  const requests = db.prepare(`SELECT * FROM cv_requests ORDER BY id DESC`).all() as any[];
  const logStmt = db.prepare(`SELECT * FROM cv_delivery_logs WHERE request_id = ? ORDER BY id DESC`);
  res.json(requests.map((r) => ({ ...r, delivery_logs: logStmt.all(r.id) })));
});

adminRouter.patch('/cv-requests/:id', (req: AuthedRequest, res) => {
  const { status, internal_notes } = req.body || {};
  const allowed = ['New Request', 'Under Review', 'Approved', 'CV Sent', 'Rejected', 'Closed'];
  const existing = db.prepare(`SELECT * FROM cv_requests WHERE id = ?`).get(Number(req.params.id)) as any;
  if (!existing) return res.status(404).json({ error: 'CV request not found.' });

  const nextStatus = status && allowed.includes(status) ? status : existing.status;
  const nextNotes = internal_notes !== undefined ? String(internal_notes).slice(0, 2000) : existing.internal_notes;

  db.prepare(`UPDATE cv_requests SET status = ?, internal_notes = ?, updated_at = datetime('now') WHERE id = ?`).run(
    nextStatus,
    nextNotes,
    existing.id
  );
  logAudit(req.adminUser!.email, 'UPDATE_CV_REQUEST', 'cv_request', String(existing.id), `Status: ${nextStatus}`, req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/cv-requests/:id/send-cv', adminUpload.single('file'), async (req: AuthedRequest, res) => {
  const requestRow = db.prepare(`SELECT * FROM cv_requests WHERE id = ?`).get(Number(req.params.id)) as any;
  if (!requestRow) return res.status(404).json({ error: 'CV request not found.' });

  const recipientEmail = String(req.body?.recipientEmail || requestRow.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return res.status(400).json({ error: 'Valid recipient email is required.' });
  }

  const subject = String(req.body?.subject || 'Abdullah Naveed — Requested CV').trim().slice(0, 200);
  const emailBody = String(
    req.body?.emailBody ||
      `Hello ${requestRow.full_name},\n\nThank you for your interest and for reaching out regarding opportunities at ${requestRow.company}. Please find my CV attached as requested.\n\nBest regards,\nAbdullah Naveed`
  ).trim();
  const deliveryMethod = req.body?.deliveryMethod === 'link' ? 'link' : 'attachment';
  const idempotencyKey = String(req.body?.idempotencyKey || '').trim().slice(0, 80);

  // Double-click / duplicate send guard
  if (idempotencyKey) {
    const dup = db
      .prepare(
        `SELECT id, delivery_status FROM cv_delivery_logs WHERE request_id = ? AND idempotency_key = ? AND created_at >= datetime('now', '-60 seconds')`
      )
      .get(requestRow.id, idempotencyKey) as any;
    if (dup) {
      return res.status(409).json({ error: 'This CV send action was already submitted. Please refresh.' });
    }
  }

  let versionId: number | null = req.body?.resumeVersionId ? Number(req.body.resumeVersionId) : null;
  let attachmentPath = '';
  let attachmentName = 'Abdullah_Naveed_CV.pdf';
  let attachmentBuffer: Buffer | undefined;

  if (req.file) {
    if (req.file.mimetype !== 'application/pdf' || !validateFileMagicBytes(req.file.buffer, 'application/pdf')) {
      return res.status(400).json({ error: 'Uploaded custom CV must be a valid PDF.' });
    }
    attachmentBuffer = req.file.buffer;
    attachmentName = req.file.originalname.slice(0, 120);

    const saveAsVersion = req.body?.saveAsVersion === 'true' || req.body?.saveAsVersion === true;
    const storedName = `cv_custom_${Date.now()}_${generateSecureToken(4)}.pdf`;
    const targetPath = path.resolve(PRIVATE_UPLOADS_DIR, storedName);
    fs.writeFileSync(targetPath, req.file.buffer);
    attachmentPath = targetPath;

    if (saveAsVersion || deliveryMethod === 'link') {
      const customTitle = String(req.body?.newVersionName || attachmentName.replace(/\.pdf$/i, '')).slice(0, 100);
      const info = db
        .prepare(
          `INSERT INTO resume_versions (version_name, description, filename, file_url, storage_path, file_size, scope, is_active, is_default)
           VALUES (?, ?, ?, ?, ?, ?, 'recruiter', 1, 0)`
        )
        .run(
          customTitle,
          saveAsVersion ? `Saved during CV delivery to ${requestRow.company}` : 'Temporary custom attachment for link delivery',
          attachmentName,
          `/api/admin/resumes/file/${storedName}`,
          targetPath,
          req.file.size
        );
      versionId = Number(info.lastInsertRowid);
    }
  } else if (versionId) {
    const ver = db.prepare(`SELECT * FROM resume_versions WHERE id = ?`).get(versionId) as any;
    if (!ver || !ver.storage_path || !fs.existsSync(ver.storage_path)) {
      return res.status(404).json({ error: 'Selected CV version PDF was not found on disk.' });
    }
    attachmentPath = ver.storage_path;
    attachmentName = ver.filename;
  } else {
    return res.status(400).json({ error: 'Select an existing CV version OR upload a PDF attachment.' });
  }

  const attempts = (
    db.prepare(`SELECT COUNT(*) as c FROM cv_delivery_logs WHERE request_id = ?`).get(requestRow.id) as { c: number }
  ).c;
  const attemptNumber = attempts + 1;

  // Determine whether to attach directly or send secure 7-day expiring download link
  const fileSize = attachmentBuffer ? attachmentBuffer.length : fs.statSync(attachmentPath).size;
  const useLinkFallback = deliveryMethod === 'link' || fileSize > 14 * 1024 * 1024;
  const downloadToken = useLinkFallback ? generateSecureToken(20) : '';
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const finalBody = useLinkFallback
    ? `${emailBody}\n\nSecure CV Download Link (valid for 7 days):\n${baseUrl}/api/public/cv-download/${downloadToken}`
    : emailBody;

  const smtpResult = await sendEmailViaSmtp({
    to: recipientEmail,
    subject,
    text: finalBody,
    attachments: useLinkFallback
      ? undefined
      : [
          attachmentBuffer
            ? { filename: attachmentName, content: attachmentBuffer, contentType: 'application/pdf' }
            : { filename: attachmentName, path: attachmentPath, contentType: 'application/pdf' },
        ],
  });

  const deliveryStatus = smtpResult.ok ? 'Accepted by SMTP provider' : 'Failed';

  db.transaction(() => {
    db.prepare(
      `INSERT INTO cv_delivery_logs (
        request_id, resume_version_id, custom_attachment_name, recipient_email, subject, email_body,
        sent_by_admin, attempt_number, delivery_status, error_message, message_id, idempotency_key, download_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      requestRow.id,
      versionId,
      req.file ? attachmentName : '',
      recipientEmail,
      subject,
      finalBody,
      req.adminUser!.email,
      attemptNumber,
      deliveryStatus,
      smtpResult.ok ? '' : smtpResult.message,
      smtpResult.messageId || '',
      idempotencyKey,
      downloadToken
    );

    if (smtpResult.ok) {
      db.prepare(
        `UPDATE cv_requests SET status = 'CV Sent', delivery_status = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(deliveryStatus, requestRow.id);
    } else {
      // NEVER fabricate "CV Sent" when SMTP failed or is unconfigured
      db.prepare(
        `UPDATE cv_requests SET delivery_status = 'Failed', updated_at = datetime('now') WHERE id = ?`
      ).run(requestRow.id);
    }
  })();

  logAudit(
    req.adminUser!.email,
    smtpResult.ok ? 'SEND_CV_SUCCESS' : 'SEND_CV_FAILED',
    'cv_request',
    String(requestRow.id),
    `${recipientEmail}: ${smtpResult.message}`,
    req.ip || ''
  );

  if (!smtpResult.ok) {
    return res.status(502).json({
      ok: false,
      deliveryStatus: 'Failed',
      error: smtpResult.message,
    });
  }

  return res.json({
    ok: true,
    deliveryStatus,
    message: `CV delivered (${deliveryStatus}) to ${recipientEmail}.`,
  });
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

adminRouter.delete('/companies/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM companies WHERE id = ?').run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'DELETE_COMPANY', 'company', req.params.id, '', req.ip || '');
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
    b.is_public === false || b.is_public === 0 ? 0 : 1,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_EDUCATION', 'education', req.params.id, String(b.institution || ''), req.ip || '');
  res.json({ ok: true });
});

adminRouter.delete('/education/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM education WHERE id = ?').run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'DELETE_EDUCATION', 'education', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 5. SKILLS MANAGEMENT + RELATIONSHIPS + INDUSTRY REVIEW QUEUE
// ---------------------------------------------------------------------------

adminRouter.get('/skills', (_req, res) => {
  const cats = db.prepare('SELECT * FROM skill_categories ORDER BY sort_order ASC').all() as any[];
  const stmt = db.prepare('SELECT * FROM skills WHERE category_id = ? ORDER BY is_published DESC, sort_order ASC, id ASC');
  const projLinks = db.prepare('SELECT skill_id, project_id FROM skill_project_links').all() as Array<{ skill_id: number; project_id: number }>;
  const roleLinks = db.prepare('SELECT skill_id, role_id FROM skill_experience_links').all() as Array<{ skill_id: number; role_id: number }>;

  const projMap = new Map<number, number[]>();
  for (const l of projLinks) {
    const arr = projMap.get(l.skill_id) || [];
    arr.push(l.project_id);
    projMap.set(l.skill_id, arr);
  }
  const roleMap = new Map<number, number[]>();
  for (const l of roleLinks) {
    const arr = roleMap.get(l.skill_id) || [];
    arr.push(l.role_id);
    roleMap.set(l.skill_id, arr);
  }

  res.json(
    cats.map((c) => ({
      ...c,
      skills: (stmt.all(c.id) as any[]).map((s) => ({
        ...s,
        linked_project_ids: projMap.get(s.id) || [],
        linked_role_ids: roleMap.get(s.id) || [],
      })),
    }))
  );
});

adminRouter.post('/skills', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const info = db
    .prepare(
      `INSERT INTO skills (category_id, name, proficiency_label, description, what_it_does, how_abdullah_uses, status, is_published, is_verified, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(b.category_id),
      String(b.name || '').trim(),
      String(b.proficiency_label || '').trim(),
      String(b.description || '').trim(),
      String(b.what_it_does || '').trim(),
      String(b.how_abdullah_uses || '').trim(),
      String(b.status || 'Used in Projects'),
      b.is_published === false ? 0 : 1,
      b.is_verified === false ? 0 : 1,
      Number(b.sort_order) || 0
    );
  logAudit(req.adminUser!.email, 'CREATE_SKILL', 'skill', String(info.lastInsertRowid), String(b.name || ''), req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

adminRouter.put('/skills/:id', (req: AuthedRequest, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) return res.status(404).json({ error: 'Skill not found.' });

  db.prepare(
    `UPDATE skills SET category_id = ?, name = ?, proficiency_label = ?, description = ?, what_it_does = ?, how_abdullah_uses = ?, status = ?, is_published = ?, is_verified = ?, sort_order = ? WHERE id = ?`
  ).run(
    Number(b.category_id || existing.category_id),
    String(b.name || existing.name).trim(),
    String(b.proficiency_label ?? existing.proficiency_label).trim(),
    String(b.description ?? existing.description).trim(),
    String(b.what_it_does ?? existing.what_it_does).trim(),
    String(b.how_abdullah_uses ?? existing.how_abdullah_uses).trim(),
    String(b.status ?? existing.status),
    b.is_published !== undefined ? (b.is_published ? 1 : 0) : existing.is_published,
    b.is_verified !== undefined ? (b.is_verified ? 1 : 0) : existing.is_verified,
    Number(b.sort_order ?? existing.sort_order),
    existing.id
  );
  logAudit(req.adminUser!.email, 'UPDATE_SKILL', 'skill', req.params.id, String(b.name || existing.name), req.ip || '');
  res.json({ ok: true });
});

adminRouter.put('/skills/:id/links', (req: AuthedRequest, res) => {
  const skillId = Number(req.params.id);
  const projectIds = Array.isArray(req.body?.project_ids) ? req.body.project_ids.map(Number).filter(Boolean) : [];
  const roleIds = Array.isArray(req.body?.role_ids) ? req.body.role_ids.map(Number).filter(Boolean) : [];

  db.transaction(() => {
    db.prepare('DELETE FROM skill_project_links WHERE skill_id = ?').run(skillId);
    db.prepare('DELETE FROM skill_experience_links WHERE skill_id = ?').run(skillId);
    const insP = db.prepare('INSERT OR IGNORE INTO skill_project_links (skill_id, project_id) VALUES (?, ?)');
    const insR = db.prepare('INSERT OR IGNORE INTO skill_experience_links (skill_id, role_id) VALUES (?, ?)');
    for (const pid of projectIds) insP.run(skillId, pid);
    for (const rid of roleIds) insR.run(skillId, rid);
  })();

  logAudit(req.adminUser!.email, 'UPDATE_SKILL_LINKS', 'skill', String(skillId), `${projectIds.length} projects, ${roleIds.length} roles`, req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/skills/:id/approve', (req: AuthedRequest, res) => {
  const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(Number(req.params.id)) as any;
  if (!skill) return res.status(404).json({ error: 'Skill not found.' });
  const nextStatus = String(req.body?.status || 'Used in Projects');
  db.prepare(`UPDATE skills SET is_verified = 1, is_published = 1, proficiency_label = 'Verified', status = ? WHERE id = ?`).run(
    nextStatus,
    skill.id
  );
  logAudit(req.adminUser!.email, 'APPROVE_SKILL', 'skill', String(skill.id), `${skill.name} (${nextStatus})`, req.ip || '');
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
  const rows = db.prepare('SELECT * FROM projects ORDER BY is_archived ASC, sort_order ASC, id DESC').all() as any[];
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
  const baseSlug = String(b.slug || b.title || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slugExists = db.prepare('SELECT id FROM projects WHERE slug = ?').get(baseSlug);
  const slug = slugExists ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

  const info = db
    .prepare(`
      INSERT INTO projects (
        slug, title, category, tagline, overview, problem_statement, solution_summary,
        architecture_notes, frontend_stack, backend_stack, database_stack, ai_models_stack,
        rag_pipeline_notes, technologies_json, features_json, challenges_json, verified_results_json,
        cover_image, github_url, live_url, github_repo_name, company_id, is_featured, is_published, sort_order,
        status, limitations, companion_group, live_demo_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      Number(b.sort_order) || 0,
      String(b.status || 'Completed'),
      String(b.limitations || ''),
      String(b.companion_group || ''),
      b.live_demo_verified ? 1 : 0
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
      status = ?, limitations = ?, companion_group = ?, live_demo_verified = ?, updated_at = datetime('now')
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
    String(b.status || 'Completed'),
    String(b.limitations || ''),
    String(b.companion_group || ''),
    b.live_demo_verified ? 1 : 0,
    Number(req.params.id)
  );
  logAudit(req.adminUser!.email, 'UPDATE_PROJECT', 'project', req.params.id, String(b.title || ''), req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/projects/:id/restore', (req: AuthedRequest, res) => {
  db.prepare(`UPDATE projects SET is_archived = 0, updated_at = datetime('now') WHERE id = ?`).run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'RESTORE_PROJECT', 'project', req.params.id, '', req.ip || '');
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
      INSERT INTO github_repos (name, full_name, description, language, html_url, homepage, stars, forks, updated_at_gh, topics_json, approval_status, repo_status, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?, datetime('now'))
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
        const inferredStatus = r.archived ? 'Archived' : r.size === 0 ? 'Incomplete' : 'Verified';
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
          JSON.stringify(r.topics || []),
          inferredStatus
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
          cover_image, github_url, live_url, github_repo_name, is_featured, is_published, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
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
        repo.name,
        repo.repo_status || 'In Progress'
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
  const rows = db.prepare('SELECT * FROM certificates ORDER BY is_archived ASC, sort_order ASC, id DESC').all() as any[];
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

adminRouter.delete('/certificates/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM certificates WHERE id = ?').run(Number(req.params.id));
  logAudit(req.adminUser!.email, 'DELETE_CERTIFICATE', 'certificate', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 8. AI PROVIDERS & KNOWLEDGE BASE MANAGEMENT
// ---------------------------------------------------------------------------

adminRouter.get('/ai/providers', (_req, res) => {
  const rows = db.prepare('SELECT * FROM ai_providers ORDER BY is_active DESC, id ASC').all() as any[];
  const hasGroqSecret = Boolean(getGroqEnvKey());
  res.json(
    rows.map((p) => {
      const dec = decryptSecret(p.api_key_enc);
      const resolved = resolveProviderApiKey(p);
      const isGroq = p.base_url?.toLowerCase().includes('groq.com') || p.name?.toLowerCase().includes('groq');
      return {
        id: p.id,
        name: p.name,
        provider_type: p.provider_type,
        base_url: p.base_url,
        model_name: p.model_name,
        embedding_model: p.embedding_model,
        has_api_key: Boolean(resolved),
        masked_api_key: dec
          ? maskSecret(dec)
          : p.provider_type === 'gemini' && process.env.GEMINI_API_KEY
          ? 'Server Env Key Active (GEMINI_API_KEY)'
          : isGroq && hasGroqSecret
          ? 'Server Secret Active (groq-api)'
          : '',
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
      Number(b.max_tokens) || 1400,
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

adminRouter.post('/ai/knowledge/upload', adminUpload.single('file'), (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Document file required (PDF, DOCX, TXT, MD).' });

  const safeMime = req.file.mimetype;
  if (safeMime === 'application/pdf' || safeMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (!validateFileMagicBytes(req.file.buffer, safeMime)) {
      return res.status(400).json({ error: 'Document file signature verification failed.' });
    }
  }

  const extracted = extractTextFromDocumentBuffer(req.file.buffer, safeMime, req.file.originalname);
  const manualNotes = String(req.body?.content || '').trim();
  const combinedContent = [manualNotes, extracted.text].filter(Boolean).join('\n\n').trim();
  if (!combinedContent) {
    return res.status(400).json({
      error: extracted.note || 'No readable text could be extracted from this file. Add a summary in the content box.',
    });
  }

  const title = String(req.body?.title || req.file.originalname).trim().slice(0, 140);
  const safeScope = req.body?.scope === 'public' ? 'public' : 'private';

  const info = db
    .prepare(`INSERT INTO knowledge_documents (source_type, source_id, title, content, scope, status) VALUES ('custom', ?, ?, ?, ?, 'pending')`)
    .run(generateSecureToken(4), title, combinedContent, safeScope);
  const summary = rebuildPublicKnowledgeBase();
  logAudit(req.adminUser!.email, 'UPLOAD_KNOWLEDGE_FILE', 'knowledge', String(info.lastInsertRowid), `${safeScope}: ${title}`, req.ip || '');
  res.status(201).json({ id: info.lastInsertRowid, extractedChars: extracted.text.length, note: extracted.note, ...summary });
});

adminRouter.delete('/ai/knowledge/:id', (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(Number(req.params.id));
  rebuildPublicKnowledgeBase();
  logAudit(req.adminUser!.email, 'DELETE_KNOWLEDGE_DOC', 'knowledge', req.params.id, '', req.ip || '');
  res.json({ ok: true });
});

adminRouter.post('/ai/knowledge/sync', (req: AuthedRequest, res) => {
  const result = rebuildPublicKnowledgeBase();
  logAudit(req.adminUser!.email, 'SYNC_AI_KNOWLEDGE', 'knowledge', 'all', `Indexed ${result.indexedCount} docs / ${result.chunkCount} chunks`, req.ip || '');
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
// 10. THEME / VIDEO BACKGROUND SETTINGS, AUDIT LOGS, PRIVATE FILES & BACKUP
// ---------------------------------------------------------------------------

adminRouter.get('/theme', (_req, res) => {
  const row = db.prepare('SELECT * FROM theme_settings WHERE id = 1').get() as any;
  res.json({
    ...row,
    section_order: JSON.parse(row.section_order_json || '[]'),
    hidden_sections: JSON.parse(row.hidden_sections_json || '[]'),
    profile_backgrounds: JSON.parse(row.profile_backgrounds_json || '{}'),
  });
});

adminRouter.post('/theme/upload-media', mediaUpload.single('file'), (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Media file required (MP4, WebM, PNG, JPG, WEBP).' });
  if (!validateFileMagicBytes(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ error: 'Uploaded media file signature failed validation.' });
  }
  const extMap: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
  };
  const ext = extMap[req.file.mimetype] || '.bin';
  const storedName = `bg_${Date.now()}_${generateSecureToken(4)}${ext}`;
  const targetPath = path.resolve(PUBLIC_UPLOADS_DIR, storedName);
  fs.writeFileSync(targetPath, req.file.buffer);
  const url = `/uploads/public/${storedName}`;

  db.prepare(
    `INSERT INTO uploaded_files (filename, original_name, mime_type, size_bytes, scope, path_key, uploaded_by) VALUES (?, ?, ?, ?, 'public', ?, ?)`
  ).run(storedName, req.file.originalname.slice(0, 120), req.file.mimetype, req.file.size, targetPath, req.adminUser!.email);

  logAudit(req.adminUser!.email, 'UPLOAD_THEME_MEDIA', 'theme_media', storedName, `${req.file.mimetype} (${Math.round(req.file.size / 1024)} KB)`, req.ip || '');
  res.json({ url, mimeType: req.file.mimetype, sizeBytes: req.file.size });
});

adminRouter.put('/theme', (req: AuthedRequest, res) => {
  const b = req.body || {};
  db.prepare(`
    UPDATE theme_settings SET
      accent_color = ?, secondary_accent = ?, intro_enabled = ?, profile_selector_enabled = ?,
      three_d_enabled = ?, animation_intensity = ?, hero_cta_primary = ?, hero_cta_secondary = ?,
      section_order_json = ?, hidden_sections_json = ?, seo_title = ?, seo_description = ?,
      bg_mode = ?, bg_video_url = ?, bg_mobile_video_url = ?, bg_poster_url = ?,
      bg_image_url = ?, bg_gradient_css = ?, bg_overlay_opacity = ?, profile_backgrounds_json = ?,
      rag_top_k = ?, rag_chunk_size = ?, rag_hybrid_weight = ?,
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
    String(b.seo_description || ''),
    ['default', 'gradient', 'image', 'video'].includes(b.bg_mode) ? b.bg_mode : 'default',
    String(b.bg_video_url || ''),
    String(b.bg_mobile_video_url || ''),
    String(b.bg_poster_url || ''),
    String(b.bg_image_url || ''),
    String(b.bg_gradient_css || ''),
    Math.min(0.95, Math.max(0.1, Number(b.bg_overlay_opacity ?? 0.68))),
    JSON.stringify(b.profile_backgrounds && typeof b.profile_backgrounds === 'object' ? b.profile_backgrounds : {}),
    Math.min(12, Math.max(3, Number(b.rag_top_k || 6))),
    Math.min(2000, Math.max(350, Number(b.rag_chunk_size || 800))),
    Math.min(0.95, Math.max(0.2, Number(b.rag_hybrid_weight ?? 0.65)))
  );
  logAudit(req.adminUser!.email, 'UPDATE_THEME', 'theme', '1', `Mode: ${b.bg_mode || 'default'}`, req.ip || '');
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
    skill_project_links: db.prepare('SELECT * FROM skill_project_links').all(),
    skill_experience_links: db.prepare('SELECT * FROM skill_experience_links').all(),
    projects: db.prepare('SELECT * FROM projects').all(),
    certificates: db.prepare('SELECT * FROM certificates').all(),
    knowledge_documents: db.prepare(`SELECT id, source_type, source_id, title, content, scope FROM knowledge_documents WHERE source_type = 'custom'`).all(),
  };
  logAudit(req.adminUser!.email, 'EXPORT_BACKUP', 'database', 'full', 'Exported non-secret portfolio JSON backup', req.ip || '');
  res.setHeader('Content-Disposition', `attachment; filename="abdullah-portfolio-backup-${Date.now()}.json"`);
  res.json(backup);
});

adminRouter.post('/backup/restore', requireRole(['owner']), (req: AuthedRequest, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object' || !Array.isArray(data.profile) || !Array.isArray(data.projects)) {
    return res.status(400).json({ error: 'Invalid backup JSON structure.' });
  }
  // Safe profile & theme restore without wiping authentication/sessions
  db.transaction(() => {
    const p = data.profile[0];
    if (p) {
      db.prepare(`
        UPDATE profile_settings SET
          full_name = ?, headline = ?, subheadline = ?, bio_short = ?, bio_long = ?,
          about_what_i_build = ?, about_problem_solving = ?, about_career_goals = ?,
          location = ?, email = ?, github_url = ?, linkedin_url = ?,
          availability_enabled = ?, availability_label = ?
        WHERE id = 1
      `).run(
        p.full_name, p.headline, p.subheadline, p.bio_short, p.bio_long,
        p.about_what_i_build || '', p.about_problem_solving || '', p.about_career_goals || '',
        p.location, p.email, p.github_url, p.linkedin_url,
        p.availability_enabled ? 1 : 0, p.availability_label || ''
      );
    }
    const th = Array.isArray(data.theme) ? data.theme[0] : null;
    if (th) {
      db.prepare(`
        UPDATE theme_settings SET
          accent_color = ?, secondary_accent = ?, intro_enabled = ?, profile_selector_enabled = ?,
          three_d_enabled = ?, seo_title = ?, seo_description = ?
        WHERE id = 1
      `).run(
        th.accent_color || '#dc2626', th.secondary_accent || '#3b82f6',
        th.intro_enabled ? 1 : 0, th.profile_selector_enabled ? 1 : 0, th.three_d_enabled ? 1 : 0,
        th.seo_title || '', th.seo_description || ''
      );
    }
  })();

  rebuildPublicKnowledgeBase();
  logAudit(req.adminUser!.email, 'RESTORE_BACKUP', 'database', 'partial', 'Restored profile & theme configuration from backup', req.ip || '');
  res.json({ ok: true });
});
