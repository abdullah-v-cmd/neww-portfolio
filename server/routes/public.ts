import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { db, PRIVATE_UPLOADS_DIR } from '../db.ts';
import { queryAbdullahAI, queryAbdullahAIStream } from '../ai.ts';
import { generateSecureToken, validateFileMagicBytes } from '../crypto.ts';
import { notifyAdminOfCvRequest, notifyAdminOfRecruiterMessage } from '../mailer.ts';
import { rateLimit } from '../auth.ts';

export const publicRouter = Router();

const contactUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported attachment file type. Allowed: PDF, DOCX, TXT, PNG, JPG.'));
    }
    cb(null, true);
  },
});

publicRouter.get('/portfolio', (_req, res) => {
  const profile = db.prepare('SELECT * FROM profile_settings WHERE id = 1').get() as Record<string, any> | undefined;
  const theme = db.prepare('SELECT * FROM theme_settings WHERE id = 1').get() as Record<string, any> | undefined;

  const companies = db
    .prepare('SELECT * FROM companies WHERE is_public = 1 AND is_archived = 0 ORDER BY sort_order ASC, id ASC')
    .all() as Array<Record<string, any>>;

  const rolesStmt = db.prepare(
    'SELECT * FROM experience_roles WHERE company_id = ? AND is_public = 1 ORDER BY sort_order ASC, id ASC'
  );
  const experience = companies.map((c) => ({
    ...c,
    roles: (rolesStmt.all(c.id) as Array<Record<string, any>>).map((r) => ({
      ...r,
      responsibilities: safeJson(r.responsibilities_json, []),
      skills: safeJson(r.skills_json, []),
    })),
  }));

  const education = db
    .prepare('SELECT * FROM education WHERE is_public = 1 ORDER BY sort_order ASC')
    .all();

  const projLinkRows = db.prepare('SELECT skill_id, project_id FROM skill_project_links').all() as Array<{
    skill_id: number;
    project_id: number;
  }>;
  const roleLinkRows = db.prepare('SELECT skill_id, role_id FROM skill_experience_links').all() as Array<{
    skill_id: number;
    role_id: number;
  }>;
  const projLinksMap = new Map<number, number[]>();
  for (const r of projLinkRows) {
    const arr = projLinksMap.get(r.skill_id) || [];
    arr.push(r.project_id);
    projLinksMap.set(r.skill_id, arr);
  }
  const roleLinksMap = new Map<number, number[]>();
  for (const r of roleLinkRows) {
    const arr = roleLinksMap.get(r.skill_id) || [];
    arr.push(r.role_id);
    roleLinksMap.set(r.skill_id, arr);
  }

  const categories = db
    .prepare('SELECT * FROM skill_categories ORDER BY sort_order ASC, id ASC')
    .all() as Array<Record<string, any>>;
  const skillsStmt = db.prepare(
    'SELECT * FROM skills WHERE category_id = ? AND is_published = 1 ORDER BY sort_order ASC, id ASC'
  );
  const skillUniverse = categories.map((cat) => ({
    ...cat,
    skills: (skillsStmt.all(cat.id) as Array<Record<string, any>>).map((s) => ({
      ...s,
      linked_project_ids: projLinksMap.get(s.id) || [],
      linked_role_ids: roleLinksMap.get(s.id) || [],
    })),
  }));

  const projects = (
    db
      .prepare('SELECT * FROM projects WHERE is_published = 1 AND is_archived = 0 ORDER BY sort_order ASC, id DESC')
      .all() as Array<Record<string, any>>
  ).map(formatProject);

  const certificates = (
    db
      .prepare('SELECT * FROM certificates WHERE is_public = 1 AND is_archived = 0 ORDER BY sort_order ASC, id DESC')
      .all() as Array<Record<string, any>>
  ).map((cert) => ({
    ...cert,
    skills: safeJson(cert.skills_json, []),
  }));

  res.json({
    profile: profile || null,
    theme: theme
      ? {
          ...theme,
          section_order: safeJson(theme.section_order_json, []),
          hidden_sections: safeJson(theme.hidden_sections_json, []),
          profile_backgrounds: safeJson(theme.profile_backgrounds_json, {}),
        }
      : null,
    experience,
    education,
    skillUniverse,
    projects,
    certificates,
  });
});

publicRouter.get('/projects/:slug', (req, res) => {
  const row = db
    .prepare('SELECT * FROM projects WHERE slug = ? AND is_published = 1 AND is_archived = 0')
    .get(req.params.slug) as Record<string, any> | undefined;

  if (!row) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  return res.json(formatProject(row));
});

publicRouter.post('/resume/track', (_req, res) => {
  db.prepare('UPDATE profile_settings SET resume_downloads = resume_downloads + 1 WHERE id = 1').run();
  const row = db
    .prepare('SELECT resume_url, resume_filename, resume_downloads FROM profile_settings WHERE id = 1')
    .get() as Record<string, any> | undefined;
  res.json(row || { resume_url: '', resume_downloads: 0 });
});

// Recruiter CV Request submission (public -> saved in DB, rate limited, duplicate protected)
publicRouter.post('/cv-requests', rateLimit('cv_request', 5, 300_000), async (req, res) => {
  const { fullName, company, email, jobTitle, message } = req.body || {};

  if (
    typeof fullName !== 'string' ||
    fullName.trim().length < 2 ||
    typeof company !== 'string' ||
    company.trim().length < 2 ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      error: 'Full name, company / organization, and a valid professional email address are required.',
    });
  }

  const cleanName = fullName.trim().slice(0, 120);
  const cleanCompany = company.trim().slice(0, 120);
  const cleanEmail = email.trim().toLowerCase().slice(0, 160);
  const cleanJobTitle = typeof jobTitle === 'string' ? jobTitle.trim().slice(0, 120) : '';
  const cleanMessage = typeof message === 'string' ? message.trim().slice(0, 2000) : '';

  const duplicateHash = crypto
    .createHash('sha256')
    .update(`${cleanEmail}|${cleanCompany.toLowerCase()}|${cleanJobTitle.toLowerCase()}`)
    .digest('hex')
    .slice(0, 24);

  // Prevent accidental double submissions from the same recruiter within 15 minutes
  const recentDup = db
    .prepare(
      `SELECT request_uid FROM cv_requests
       WHERE duplicate_hash = ? AND created_at >= datetime('now', '-15 minutes')
       ORDER BY id DESC LIMIT 1`
    )
    .get(duplicateHash) as { request_uid: string } | undefined;

  if (recentDup) {
    return res.status(409).json({
      error: `A CV request (${recentDup.request_uid}) from your email for ${cleanCompany} was already received recently.`,
      requestUid: recentDup.request_uid,
    });
  }

  const requestUid = `CVR-${generateSecureToken(3).toUpperCase()}`;

  const info = db
    .prepare(
      `INSERT INTO cv_requests (request_uid, full_name, company, email, job_title, message, status, delivery_status, duplicate_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'New Request', 'Pending', ?)`
    )
    .run(requestUid, cleanName, cleanCompany, cleanEmail, cleanJobTitle, cleanMessage, duplicateHash);

  // Fire-and-forget SMTP alert to admin if SMTP enabled
  notifyAdminOfCvRequest({
    requestUid,
    fullName: cleanName,
    company: cleanCompany,
    email: cleanEmail,
    jobTitle: cleanJobTitle,
    message: cleanMessage,
  }).catch(() => undefined);

  return res.status(201).json({
    ok: true,
    id: Number(info.lastInsertRowid),
    requestUid,
    message:
      'Your CV request has been received. Thank you for your interest. I will review your request and respond as soon as possible.',
  });
});

// Secure expiring token CV download link (fallback if attachment exceeds size limits or link delivery chosen)
publicRouter.get('/cv-download/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  if (token.length < 24) return res.status(400).json({ error: 'Invalid download token.' });

  const logRow = db
    .prepare(
      `SELECT dl.*, rv.storage_path, rv.filename as version_filename
       FROM cv_delivery_logs dl
       LEFT JOIN resume_versions rv ON rv.id = dl.resume_version_id
       WHERE dl.download_token = ? AND dl.created_at >= datetime('now', '-7 days')
       ORDER BY dl.id DESC LIMIT 1`
    )
    .get(token) as any;

  if (!logRow || !logRow.storage_path || !fs.existsSync(logRow.storage_path)) {
    return res.status(404).json({ error: 'This CV download link has expired or is no longer available.' });
  }

  const resolved = path.resolve(logRow.storage_path);
  if (!resolved.startsWith(PRIVATE_UPLOADS_DIR + path.sep) && !resolved.startsWith(path.resolve(process.cwd(), 'uploads') + path.sep)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${logRow.version_filename || 'Abdullah_Naveed_CV.pdf'}"`);
  return res.sendFile(resolved);
});

publicRouter.post('/ai/chat', rateLimit('ai_chat', 25, 60_000), async (req, res) => {
  const { message, sessionId, profileMode, stream } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > 1500) {
    return res.status(400).json({ error: 'Please provide a valid question under 1500 characters.' });
  }

  const sid = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim().slice(0, 80) : generateSecureToken(12);
  let conv = db.prepare('SELECT * FROM ai_conversations WHERE session_id = ?').get(sid) as { id: number } | undefined;
  if (!conv) {
    const info = db
      .prepare('INSERT INTO ai_conversations (session_id, recruiter_profile, title) VALUES (?, ?, ?)')
      .run(sid, String(profileMode || 'explore').slice(0, 32), message.trim().slice(0, 80));
    conv = { id: Number(info.lastInsertRowid) };
  }

  const historyRows = db
    .prepare('SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 14')
    .all(conv.id) as Array<{ role: 'user' | 'assistant'; content: string }>;

  db.prepare('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
    conv.id,
    'user',
    message.trim()
  );

  let clientClosed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    req.on('close', () => {
      clientClosed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    });
    heartbeat = setInterval(() => {
      if (!clientClosed && !res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 4000);
  }

  try {
    const result = stream
      ? await queryAbdullahAIStream(
          {
            message: message.trim(),
            history: historyRows,
            profileMode: String(profileMode || 'explore'),
            includePrivate: false,
          },
          (tok) => {
            if (!clientClosed && !res.writableEnded) {
              res.write(`data: ${JSON.stringify({ type: 'chunk', text: tok })}\n\n`);
            }
          }
        )
      : await queryAbdullahAI({
          message: message.trim(),
          history: historyRows,
          profileMode: String(profileMode || 'explore'),
          includePrivate: false,
        });

    db.prepare(
      'INSERT INTO ai_messages (conversation_id, role, content, citations_json, provider_used) VALUES (?, ?, ?, ?, ?)'
    ).run(conv.id, 'assistant', result.answer, JSON.stringify(result.citations), result.providerUsed);

    db.prepare(`UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ?`).run(conv.id);

    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }

    if (stream) {
      if (clientClosed || res.writableEnded) return;
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          sessionId: sid,
          citations: result.citations,
          providerUsed: result.providerUsed,
        })}\n\n`
      );
      return res.end();
    }

    return res.json({
      sessionId: sid,
      answer: result.answer,
      citations: result.citations,
      providerUsed: result.providerUsed,
    });
  } catch (err: any) {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    const msg = err?.message || 'Unable to reach AI provider.';
    if (stream) {
      if (!clientClosed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
        res.end();
      }
      return;
    }
    return res.status(503).json({ error: msg });
  }
});

publicRouter.post('/contact', rateLimit('contact', 6, 300_000), contactUpload.single('attachment'), async (req, res) => {
  const { name, email, company, subject, message } = req.body || {};
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof subject !== 'string' ||
    !subject.trim() ||
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return res.status(400).json({ error: 'Name, valid email, subject, and message are required.' });
  }

  let attachmentUrl = '';
  let attachmentName = '';

  if (req.file) {
    if (!validateFileMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ error: 'Attachment file signature failed validation.' });
    }
    const safeExt = path.extname(req.file.originalname).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.bin';
    const storedName = `recruiter_${Date.now()}_${generateSecureToken(6)}${safeExt}`;
    const targetPath = path.resolve(PRIVATE_UPLOADS_DIR, storedName);
    if (!targetPath.startsWith(PRIVATE_UPLOADS_DIR + path.sep)) {
      return res.status(400).json({ error: 'Invalid file destination.' });
    }
    fs.writeFileSync(targetPath, req.file.buffer);
    attachmentUrl = `/api/admin/files/private/${storedName}`;
    attachmentName = req.file.originalname.slice(0, 120);
    db.prepare(
      `INSERT INTO uploaded_files (filename, original_name, mime_type, size_bytes, scope, path_key, uploaded_by) VALUES (?, ?, ?, ?, 'private', ?, ?)`
    ).run(storedName, attachmentName, req.file.mimetype, req.file.size, targetPath, email.trim());
  }

  const threadToken = generateSecureToken(16);
  const convId = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO recruiter_conversations (thread_token, recruiter_name, recruiter_email, company, subject, status) VALUES (?, ?, ?, ?, ?, 'New')`
      )
      .run(
        threadToken,
        name.trim().slice(0, 120),
        email.trim().slice(0, 160),
        String(company || '').trim().slice(0, 120),
        subject.trim().slice(0, 200)
      );
    const id = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO recruiter_messages (conversation_id, sender_type, sender_name, body, attachment_url, attachment_name) VALUES (?, 'recruiter', ?, ?, ?, ?)`
    ).run(id, name.trim().slice(0, 120), message.trim().slice(0, 5000), attachmentUrl, attachmentName);
    return id;
  })();

  notifyAdminOfRecruiterMessage({
    recruiterName: name.trim(),
    recruiterEmail: email.trim(),
    company: String(company || '').trim(),
    subject: subject.trim(),
    body: message.trim(),
    threadToken,
  }).catch(() => undefined);

  return res.status(201).json({
    ok: true,
    conversationId: convId,
    threadToken,
    message: 'Your message has been delivered. Keep this private thread reference to view replies or continue the conversation.',
  });
});

publicRouter.get('/conversations/:threadToken', (req, res) => {
  const token = String(req.params.threadToken || '').trim();
  if (token.length < 16) return res.status(400).json({ error: 'Invalid thread token.' });

  const conv = db
    .prepare('SELECT id, thread_token, recruiter_name, company, subject, status, created_at, updated_at FROM recruiter_conversations WHERE thread_token = ?')
    .get(token) as Record<string, any> | undefined;

  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  const messages = db
    .prepare('SELECT id, sender_type, sender_name, body, attachment_name, created_at FROM recruiter_messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(conv.id);

  return res.json({ conversation: conv, messages });
});

publicRouter.post('/conversations/:threadToken/reply', rateLimit('recruiter_reply', 12, 300_000), (req, res) => {
  const token = String(req.params.threadToken || '').trim();
  const { body } = req.body || {};
  if (typeof body !== 'string' || !body.trim() || body.length > 5000) {
    return res.status(400).json({ error: 'Reply body is required.' });
  }

  const conv = db
    .prepare('SELECT * FROM recruiter_conversations WHERE thread_token = ?')
    .get(token) as Record<string, any> | undefined;
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  db.transaction(() => {
    db.prepare(
      `INSERT INTO recruiter_messages (conversation_id, sender_type, sender_name, body) VALUES (?, 'recruiter', ?, ?)`
    ).run(conv.id, conv.recruiter_name, body.trim());
    db.prepare(`UPDATE recruiter_conversations SET status = 'In Progress', updated_at = datetime('now') WHERE id = ?`).run(
      conv.id
    );
  })();

  notifyAdminOfRecruiterMessage({
    recruiterName: conv.recruiter_name,
    recruiterEmail: conv.recruiter_email,
    company: conv.company,
    subject: `Re: ${conv.subject}`,
    body: body.trim(),
    threadToken: conv.thread_token,
  }).catch(() => undefined);

  return res.json({ ok: true });
});

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatProject(p: Record<string, any>) {
  return {
    ...p,
    technologies: safeJson(p.technologies_json, []),
    features: safeJson(p.features_json, []),
    challenges: safeJson(p.challenges_json, []),
    verified_results: safeJson(p.verified_results_json, []),
    screenshots: safeJson(p.screenshots_json, []),
  };
}
