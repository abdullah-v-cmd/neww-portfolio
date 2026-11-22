import { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';
import { generateSecureToken, hashPassword, hashToken, verifyPassword } from './crypto.ts';

export interface AdminUserRecord {
  id: number;
  email: string;
  display_name: string;
  password_hash: string;
  role: string;
  mfa_enabled: number;
  mfa_secret_enc: string;
  failed_attempts: number;
  locked_until: string | null;
}

export interface AuthedRequest extends Request {
  adminUser?: AdminUserRecord;
  sessionId?: number;
}

// Simple in-memory sliding window rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(keyPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }

    bucket.count += 1;
    return next();
  };
}

export function logAudit(
  actorEmail: string,
  action: string,
  resourceType: string,
  resourceId = '',
  details = '',
  ip = ''
): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (actor_email, action, resource_type, resource_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(actorEmail, action, resourceType, String(resourceId), details, ip);
  } catch {
    // Do not break primary operation if audit insert fails
  }
}

export function getAuthStatus(): { needsBootstrap: boolean; hasEnvOverride: boolean } {
  const countRow = db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number };
  const hasEnvOverride = Boolean(process.env.ADMIN_BOOTSTRAP_PASSCODE && process.env.ADMIN_BOOTSTRAP_PASSCODE.trim().length > 0);
  return {
    needsBootstrap: countRow.c === 0 && !hasEnvOverride,
    hasEnvOverride,
  };
}

export function createAdminSession(userId: number, ip: string, userAgent: string): { token: string; expiresAt: string } {
  const token = generateSecureToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(); // 12h session
  db.prepare(
    `INSERT INTO admin_sessions (user_id, token_hash, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, tokenHash, ip, userAgent.slice(0, 240), expiresAt);
  return { token, expiresAt };
}

export function authenticateAdminCredentials(email: string, password: string): {
  ok: boolean;
  user?: AdminUserRecord;
  error?: string;
} {
  const normalizedEmail = email.trim().toLowerCase();
  const envPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim();
  const envEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'abdullah2w1w@gmail.com').trim().toLowerCase();

  let user = db.prepare('SELECT * FROM admin_users WHERE lower(email) = ?').get(normalizedEmail) as
    | AdminUserRecord
    | undefined;

  // If ADMIN_BOOTSTRAP_PASSCODE is configured, allow bootstrapping or verifying owner login
  if (envPasscode && normalizedEmail === envEmail && password === envPasscode) {
    if (!user) {
      const info = db
        .prepare(
          `INSERT INTO admin_users (email, display_name, password_hash, role) VALUES (?, 'Abdullah Naveed', ?, 'owner')`
        )
        .run(envEmail, hashPassword(envPasscode));
      user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(info.lastInsertRowid) as AdminUserRecord;
    }
    return { ok: true, user };
  }

  if (!user) {
    return { ok: false, error: 'Invalid credentials.' };
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return { ok: false, error: 'Account temporarily throttled due to repeated failed attempts. Try again later.' };
  }

  if (!verifyPassword(password, user.password_hash)) {
    const attempts = user.failed_attempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
    db.prepare(`UPDATE admin_users SET failed_attempts = ?, locked_until = ? WHERE id = ?`).run(
      attempts,
      lockedUntil,
      user.id
    );
    return { ok: false, error: 'Invalid credentials.' };
  }

  db.prepare(`UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ?`).run(user.id);
  return { ok: true, user };
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = extractCookie(req.headers.cookie || '', 'an_admin_session');
  const rawToken = bearer || cookieToken;

  if (!rawToken) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // CSRF check for cookie-authenticated mutations
  if (!bearer && cookieToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const requestedWith = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const originHost = origin ? (() => { try { return new URL(origin).host; } catch { return ''; } })() : '';
    if (requestedWith !== 'XMLHttpRequest' && (!originHost || originHost !== host)) {
      return res.status(403).json({ error: 'CSRF check failed.' });
    }
  }

  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.expires_at, s.revoked, u.*
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as (AdminUserRecord & { session_id: number; expires_at: string; revoked: number }) | undefined;

  if (!row || row.revoked || new Date(row.expires_at).getTime() <= Date.now()) {
    return res.status(401).json({ error: 'Session expired or revoked.' });
  }

  req.adminUser = row;
  req.sessionId = row.session_id;
  return next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser || !allowedRoles.includes(req.adminUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    return next();
  };
}

function extractCookie(cookieHeader: string, name: string): string {
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
