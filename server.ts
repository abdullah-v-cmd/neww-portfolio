import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { db, initializeDatabase, PUBLIC_UPLOADS_DIR } from './server/db.ts';
import { rebuildPublicKnowledgeBase } from './server/ai.ts';
import { decryptSecret } from './server/crypto.ts';
import { publicRouter } from './server/routes/public.ts';
import { adminRouter } from './server/routes/admin.ts';

async function startServer() {
  initializeDatabase();
  const kbCount = (db.prepare('SELECT COUNT(*) as c FROM knowledge_documents').get() as { c: number }).c;
  if (kbCount === 0) {
    rebuildPublicKnowledgeBase();
  }

  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false, // Required inside AI Studio preview iframe
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Serve public uploaded assets safely (prevent inline HTML/SVG execution)
  app.use(
    '/uploads/public',
    express.static(PUBLIC_UPLOADS_DIR, {
      setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (filePath.endsWith('.html') || filePath.endsWith('.svg')) {
          res.setHeader('Content-Disposition', 'attachment');
        }
      },
    })
  );

  // Health Check
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch {
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });

  // SEO robots.txt and sitemap.xml
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /secure-admin\nDisallow: /api/admin\n');
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const projects = db
      .prepare('SELECT slug, updated_at FROM projects WHERE is_published = 1 AND is_archived = 0')
      .all() as Array<{ slug: string; updated_at: string }>;
    const urls = [
      `${baseUrl}/`,
      ...projects.map((p) => `${baseUrl}/projects/${p.slug}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  // Authenticated Inbound Email Webhook (for SendGrid/Mailgun/Postmark/Resend)
  app.post('/api/webhooks/inbound-email', (req, res) => {
    const smtp = db.prepare('SELECT inbound_webhook_secret_enc FROM smtp_settings WHERE id = 1').get() as any;
    const expectedSecret = decryptSecret(smtp?.inbound_webhook_secret_enc || '');
    const providedSecret = String(req.headers['x-webhook-secret'] || req.query.secret || '');
    if (
      !expectedSecret ||
      providedSecret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret))
    ) {
      return res.status(401).json({ error: 'Unauthorized inbound webhook.' });
    }

    const { from, subject, text, threadToken } = req.body || {};
    if (!text || (!threadToken && !from)) {
      return res.status(400).json({ error: 'Missing required inbound payload fields.' });
    }

    let conv: any = null;
    if (threadToken) {
      conv = db.prepare('SELECT * FROM recruiter_conversations WHERE thread_token = ?').get(String(threadToken).trim());
    }
    if (!conv && subject) {
      const match = String(subject).match(/\[Ref:\s*([a-f0-9]{8})\]/i);
      if (match) {
        conv = db.prepare('SELECT * FROM recruiter_conversations WHERE thread_token LIKE ?').get(`${match[1]}%`);
      }
    }
    if (!conv && from) {
      conv = db
        .prepare('SELECT * FROM recruiter_conversations WHERE lower(recruiter_email) = ? ORDER BY updated_at DESC LIMIT 1')
        .get(String(from).trim().toLowerCase());
    }

    if (!conv) {
      return res.status(404).json({ error: 'Matching conversation thread not found.' });
    }

    db.transaction(() => {
      db.prepare(
        `INSERT INTO recruiter_messages (conversation_id, sender_type, sender_name, body) VALUES (?, 'recruiter', ?, ?)`
      ).run(conv.id, conv.recruiter_name, String(text).trim().slice(0, 5000));
      db.prepare(`UPDATE recruiter_conversations SET status = 'In Progress', updated_at = datetime('now') WHERE id = ?`).run(
        conv.id
      );
    })();

    return res.json({ ok: true, conversationId: conv.id });
  });

  // Mount API routers
  app.use('/api/public', publicRouter);
  app.use('/api/admin', adminRouter);

  // Global API error handler
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status || 400;
    res.status(status).json({ error: err?.message || 'Request failed.' });
  });

  // Vite integration in development vs dist static serving in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
