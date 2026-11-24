import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const PUBLIC_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'public');
export const PRIVATE_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'private');

for (const dir of [DATA_DIR, PUBLIC_UPLOADS_DIR, PRIVATE_UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const DB_PATH = path.join(DATA_DIR, 'portfolio.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function getGroqEnvKey(): string {
  return (
    process.env['groq-api'] ||
    process.env['GROQ-API'] ||
    process.env.GROQ_API_KEY ||
    process.env.GROQ_API ||
    ''
  ).trim();
}

function ensureColumn(tableName: string, columnName: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret_enc TEXT DEFAULT '',
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT DEFAULT '',
      details TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      full_name TEXT NOT NULL,
      headline TEXT NOT NULL,
      subheadline TEXT NOT NULL,
      bio_short TEXT NOT NULL,
      bio_long TEXT NOT NULL,
      about_what_i_build TEXT NOT NULL DEFAULT '',
      about_problem_solving TEXT NOT NULL DEFAULT '',
      about_career_goals TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      email TEXT NOT NULL,
      github_url TEXT NOT NULL,
      linkedin_url TEXT NOT NULL,
      availability_enabled INTEGER NOT NULL DEFAULT 0,
      availability_label TEXT NOT NULL DEFAULT 'Open to AI & Software Engineering Roles',
      avatar_url TEXT NOT NULL,
      cover_url TEXT DEFAULT '',
      resume_url TEXT DEFAULT '',
      resume_filename TEXT DEFAULT '',
      resume_downloads INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS theme_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      accent_color TEXT NOT NULL DEFAULT '#dc2626',
      secondary_accent TEXT NOT NULL DEFAULT '#3b82f6',
      intro_enabled INTEGER NOT NULL DEFAULT 1,
      profile_selector_enabled INTEGER NOT NULL DEFAULT 1,
      three_d_enabled INTEGER NOT NULL DEFAULT 1,
      animation_intensity TEXT NOT NULL DEFAULT 'cinematic',
      hero_cta_primary TEXT NOT NULL DEFAULT 'Explore My Work',
      hero_cta_secondary TEXT NOT NULL DEFAULT 'Meet Abdullah AI',
      section_order_json TEXT NOT NULL DEFAULT '["projects","skills","experience","credentials","about","contact"]',
      hidden_sections_json TEXT NOT NULL DEFAULT '[]',
      seo_title TEXT NOT NULL DEFAULT 'Abdullah Naveed — AI Engineer & Full-Stack Systems Architect',
      seo_description TEXT NOT NULL DEFAULT 'Explore verified AI, RAG, Computer Vision, and Full-Stack systems engineered by Abdullah Naveed.',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      arrangement TEXT NOT NULL DEFAULT 'Remote',
      overall_dates TEXT NOT NULL,
      description TEXT DEFAULT '',
      website_url TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS experience_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      employment_type TEXT NOT NULL DEFAULT 'Full-time',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL DEFAULT 'Present',
      is_current INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      responsibilities_json TEXT NOT NULL DEFAULT '[]',
      skills_json TEXT NOT NULL DEFAULT '[]',
      evidence_note TEXT DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution TEXT NOT NULL,
      degree TEXT NOT NULL,
      field TEXT DEFAULT '',
      student_name TEXT NOT NULL DEFAULT 'Abdullah Naveed',
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      details TEXT DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS skill_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      proficiency_label TEXT DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      tagline TEXT NOT NULL,
      overview TEXT NOT NULL,
      problem_statement TEXT DEFAULT '',
      solution_summary TEXT DEFAULT '',
      architecture_notes TEXT DEFAULT '',
      frontend_stack TEXT DEFAULT '',
      backend_stack TEXT DEFAULT '',
      database_stack TEXT DEFAULT '',
      ai_models_stack TEXT DEFAULT '',
      rag_pipeline_notes TEXT DEFAULT '',
      technologies_json TEXT NOT NULL DEFAULT '[]',
      features_json TEXT NOT NULL DEFAULT '[]',
      challenges_json TEXT NOT NULL DEFAULT '[]',
      verified_results_json TEXT NOT NULL DEFAULT '[]',
      cover_image TEXT DEFAULT '',
      screenshots_json TEXT NOT NULL DEFAULT '[]',
      github_url TEXT DEFAULT '',
      live_url TEXT DEFAULT '',
      github_repo_name TEXT DEFAULT '',
      company_id INTEGER DEFAULT NULL REFERENCES companies(id) ON DELETE SET NULL,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      issuer TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      expiry_date TEXT DEFAULT '',
      credential_id TEXT DEFAULT '',
      verify_url TEXT DEFAULT '',
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'pdf',
      description TEXT DEFAULT '',
      skills_json TEXT NOT NULL DEFAULT '[]',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS github_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      language TEXT DEFAULT '',
      html_url TEXT NOT NULL,
      homepage TEXT DEFAULT '',
      stars INTEGER NOT NULL DEFAULT 0,
      forks INTEGER NOT NULL DEFAULT 0,
      updated_at_gh TEXT DEFAULT '',
      readme_excerpt TEXT DEFAULT '',
      topics_json TEXT NOT NULL DEFAULT '[]',
      approval_status TEXT NOT NULL DEFAULT 'discovered',
      linked_project_id INTEGER DEFAULT NULL REFERENCES projects(id) ON DELETE SET NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      base_url TEXT DEFAULT '',
      model_name TEXT NOT NULL,
      embedding_model TEXT DEFAULT '',
      api_key_enc TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      is_fallback INTEGER NOT NULL DEFAULT 0,
      max_tokens INTEGER NOT NULL DEFAULT 1024,
      rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
      last_status TEXT DEFAULT 'ready',
      last_error TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'public',
      token_estimate INTEGER NOT NULL DEFAULT 0,
      vector_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'indexed',
      error_message TEXT DEFAULT '',
      last_indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      recruiter_profile TEXT DEFAULT 'explore',
      title TEXT DEFAULT 'Recruiter Conversation',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]',
      provider_used TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      host TEXT DEFAULT '',
      port INTEGER NOT NULL DEFAULT 587,
      username TEXT DEFAULT '',
      password_enc TEXT DEFAULT '',
      from_email TEXT DEFAULT '',
      from_name TEXT DEFAULT 'Abdullah Naveed Portfolio',
      reply_to TEXT DEFAULT '',
      notification_email TEXT DEFAULT '',
      encryption_mode TEXT NOT NULL DEFAULT 'starttls',
      is_enabled INTEGER NOT NULL DEFAULT 0,
      inbound_webhook_secret_enc TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_delivery_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT DEFAULT '',
      message_id TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recruiter_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_token TEXT NOT NULL UNIQUE,
      recruiter_name TEXT NOT NULL,
      recruiter_email TEXT NOT NULL,
      company TEXT DEFAULT '',
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recruiter_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES recruiter_conversations(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      body TEXT NOT NULL,
      attachment_url TEXT DEFAULT '',
      attachment_name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      scope TEXT NOT NULL DEFAULT 'private',
      path_key TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skill_project_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(skill_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS skill_experience_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES experience_roles(id) ON DELETE CASCADE,
      UNIQUE(skill_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT 'public',
      content TEXT NOT NULL,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      vector_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resume_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      filename TEXT NOT NULL,
      file_url TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      scope TEXT NOT NULL DEFAULT 'recruiter',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cv_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_uid TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      job_title TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'New Request',
      delivery_status TEXT NOT NULL DEFAULT 'Pending',
      internal_notes TEXT DEFAULT '',
      duplicate_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cv_delivery_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES cv_requests(id) ON DELETE CASCADE,
      resume_version_id INTEGER DEFAULT NULL REFERENCES resume_versions(id) ON DELETE SET NULL,
      custom_attachment_name TEXT DEFAULT '',
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      email_body TEXT NOT NULL,
      sent_by_admin TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      delivery_status TEXT NOT NULL,
      error_message TEXT DEFAULT '',
      message_id TEXT DEFAULT '',
      idempotency_key TEXT DEFAULT '',
      download_token TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe idempotent column additions for existing databases
  ensureColumn('projects', 'status', `TEXT NOT NULL DEFAULT 'Completed'`);
  ensureColumn('projects', 'limitations', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('projects', 'companion_group', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('projects', 'live_demo_verified', `INTEGER NOT NULL DEFAULT 0`);
  ensureColumn('projects', 'preview_video_url', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('projects', 'video_description', `TEXT NOT NULL DEFAULT ''`);

  ensureColumn('skills', 'description', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('skills', 'what_it_does', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('skills', 'how_abdullah_uses', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('skills', 'status', `TEXT NOT NULL DEFAULT 'Used in Projects'`);
  ensureColumn('skills', 'icon_key', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('skills', 'is_verified', `INTEGER NOT NULL DEFAULT 1`);

  ensureColumn('theme_settings', 'bg_mode', `TEXT NOT NULL DEFAULT 'default'`);
  ensureColumn('theme_settings', 'bg_video_url', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('theme_settings', 'bg_mobile_video_url', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('theme_settings', 'bg_poster_url', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('theme_settings', 'bg_image_url', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('theme_settings', 'bg_gradient_css', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('theme_settings', 'bg_overlay_opacity', `REAL NOT NULL DEFAULT 0.68`);
  ensureColumn('theme_settings', 'profile_backgrounds_json', `TEXT NOT NULL DEFAULT '{}'`);
  ensureColumn('theme_settings', 'rag_top_k', `INTEGER NOT NULL DEFAULT 6`);
  ensureColumn('theme_settings', 'rag_chunk_size', `INTEGER NOT NULL DEFAULT 800`);
  ensureColumn('theme_settings', 'rag_hybrid_weight', `REAL NOT NULL DEFAULT 0.65`);
  ensureColumn('theme_settings', 'dvd_transition_enabled', `INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('theme_settings', 'video_autoplay_preview', `INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('theme_settings', 'hero_montage_enabled', `INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('theme_settings', 'hero_montage_json', `TEXT NOT NULL DEFAULT '[]'`);

  ensureColumn('github_repos', 'repo_status', `TEXT NOT NULL DEFAULT 'Verified'`);
  ensureColumn('github_repos', 'companion_group', `TEXT NOT NULL DEFAULT ''`);

  seedInitialData();
  runPostSeedMigrations();
}

function seedInitialData(): void {
  const existingProfile = db.prepare('SELECT id FROM profile_settings WHERE id = 1').get();
  if (existingProfile) return;

  db.transaction(() => {
    // 1. Profile Settings
    db.prepare(`
      INSERT INTO profile_settings (
        id, full_name, headline, subheadline, bio_short, bio_long,
        about_what_i_build, about_problem_solving, about_career_goals,
        location, email, github_url, linkedin_url, availability_enabled,
        availability_label, avatar_url, cover_url, resume_url, resume_filename
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      1,
      'Abdullah Naveed',
      'Building Intelligent Systems. Engineering the Future.',
      'AI Engineer | Machine Learning | Generative AI | Software Development',
      'I build intelligent applications, AI-powered solutions, retrieval systems and scalable software products that solve real-world problems.',
      'I am Abdullah Naveed, an Artificial Intelligence Engineer and Computer Science student at Superior University. Across my engineering roles and open-source systems, I focus on taking machine learning, deep learning, Retrieval-Augmented Generation (RAG), and computer vision beyond isolated notebooks into structured, containerized full-stack software.',
      'I design and build RAG document intelligence pipelines, multi-agent research workflows, real-time computer vision surveillance systems (YOLOv8 + edge watchdogs), MLOps experiment & serving pipelines, and full-stack web applications using FastAPI, Next.js, TypeScript, PostgreSQL, pgvector, Redis, and Docker.',
      'I prioritize explicit, inspectable system architectures over black-box abstractions—whether implementing vanilla cosine retrieval without framework bloat, isolating RTSP video inference in dedicated watchdog containers, or enforcing strict grounding and authorization boundaries in production APIs.',
      'To architect reliable, verifiable AI systems and scalable full-stack products that bridge applied ML research and production software engineering.',
      'Pakistan',
      'abdullah2w1w@gmail.com',
      'https://github.com/abdullah-v-cmd',
      'https://www.linkedin.com/in/abdullah-naveed-8353492a1',
      0, // Must remain disabled unless admin explicitly enables it
      'Available for AI & Software Engineering Roles',
      '/assets/aistudio/WhatsApp_Image_2026-11-10_at_3.01.25_PM_a9079bdf.jpeg',
      '/src/assets/images/project_omnisynth_cover_1795329338795.jpg',
      '',
      ''
    );

    // 2. Theme Settings & SMTP Settings
    db.prepare('INSERT INTO theme_settings (id) VALUES (1)').run();
    db.prepare('INSERT INTO smtp_settings (id, from_name, reply_to, notification_email) VALUES (1, ?, ?, ?)').run(
      'Abdullah Naveed',
      'abdullah2w1w@gmail.com',
      'abdullah2w1w@gmail.com'
    );

    // 3. Companies & Experience Roles (Exact supplied records, no invented claims)
    const insertCompany = db.prepare(`
      INSERT INTO companies (name, location, arrangement, overall_dates, description, sort_order, is_public)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const insertRole = db.prepare(`
      INSERT INTO experience_roles (
        company_id, title, employment_type, start_date, end_date, is_current,
        description, responsibilities_json, skills_json, evidence_note, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dvId = insertCompany.run(
      'DeepVision.ai',
      'Pakistan',
      'Hybrid',
      'January 2024 – Present',
      'Multi-role AI engineering tenure covering model training, deep learning architectures, and data pipelines.',
      1
    ).lastInsertRowid;

    insertRole.run(
      dvId,
      'Artificial Intelligence Engineer',
      'Part-time',
      'November 2025',
      'Present',
      1,
      'Advancing applied AI engineering initiatives within DeepVision.ai.',
      JSON.stringify(['Applied AI Engineering', 'Model Development & Architecture']),
      JSON.stringify(['Python', 'Machine Learning', 'Deep Learning']),
      'Role progression within DeepVision.ai (dates admin-editable).',
      1
    );

    insertRole.run(
      dvId,
      'Junior Artificial Intelligence Programmer',
      'Part-time',
      'January 2024',
      'Present',
      1,
      'Trained multiple machine learning and deep learning models with end-to-end data preprocessing and feature engineering.',
      JSON.stringify([
        'Train multiple models',
        'Machine Learning',
        'Deep Learning',
        'ANN, RNN, DNN, and CNN architectures',
        'Data Cleaning',
        'Feature Engineering',
      ]),
      JSON.stringify(['Python', 'Machine Learning', 'Deep Learning', 'ANN', 'RNN', 'DNN', 'CNN', 'Data Preprocessing', 'Feature Engineering', 'Model Training']),
      'Original listing shows January 2024 – Present; transition date admin-editable.',
      2
    );

    const dhId = insertCompany.run(
      'Developers Hub (Pvt.) Ltd',
      'Lahore, Punjab, Pakistan',
      'Remote',
      'November 2025 – April 2026',
      'Built document retrieval and Retrieval-Augmented Generation (RAG) solutions containerized with Docker.',
      2
    ).lastInsertRowid;

    insertRole.run(
      dhId,
      'Artificial Intelligence Engineer',
      'Part-time',
      'November 2025',
      'April 2026',
      0,
      'Built document retrieval and Retrieval-Augmented Generation solutions that addressed business needs through semantic search and applied machine learning concepts. Containerized AI systems with Docker, applying containerization tools and engineering best practices to support consistent production-oriented deployment.',
      JSON.stringify([
        'Built document retrieval and Retrieval-Augmented Generation (RAG) solutions',
        'Implemented semantic search and applied machine learning concepts',
        'Containerized AI systems with Docker for consistent production-oriented deployment',
      ]),
      JSON.stringify(['RAG', 'Document Retrieval', 'Semantic Search', 'Machine Learning', 'Docker', 'Python']),
      '6 months · Remote · Lahore, Punjab, Pakistan.',
      1
    );

    const bmId = insertCompany.run(
      'Bravo Media',
      'United Kingdom',
      'Remote',
      'June 2026 – August 2026',
      'Full-time remote web development engagement.',
      3
    ).lastInsertRowid;

    insertRole.run(
      bmId,
      'Junior Web Developer',
      'Full-time',
      'June 2026',
      'August 2026',
      0,
      'Full-time remote Junior Web Developer engagement (3 months).',
      JSON.stringify([]),
      JSON.stringify(['Web Development']),
      'Offer letter supplied as evidence; additional responsibilities can be added via Admin.',
      1
    );

    // 4. Education (Exact supplied record, no invented dates or CGPA)
    db.prepare(`
      INSERT INTO education (institution, degree, field, student_name, details, is_public, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(
      'Superior University',
      'BSCS',
      'Bachelor of Science in Computer Science',
      'Abdullah Naveed',
      'Undergraduate studies in Computer Science.'
    );

    // 5. High-Demand Market Skill Categories & Skills
    const insertCat = db.prepare('INSERT INTO skill_categories (name, slug, sort_order) VALUES (?, ?, ?)');
    const insertSkill = db.prepare(
      'INSERT INTO skills (category_id, name, proficiency_label, is_published, is_verified, sort_order) VALUES (?, ?, ?, 1, 1, ?)'
    );
    HIGH_DEMAND_SKILL_CATEGORIES.forEach((cat, idx) => {
      const catId = insertCat.run(cat.name, cat.slug, idx + 1).lastInsertRowid;
      cat.skills.forEach((s, sIdx) => {
        insertSkill.run(catId, s, 'Verified', sIdx + 1);
      });
    });

    // 6. Verified Certificates (exact 3 Coursera PDFs provided by user)
    const insertCert = db.prepare(`
      INSERT INTO certificates (
        title, issuer, issue_date, credential_id, verify_url, file_url, file_type,
        description, skills_json, is_featured, is_public, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, 'pdf', ?, ?, 1, 1, ?)
    `);
    insertCert.run(
      'Introduction to Back-End Development',
      'Meta (offered through Coursera)',
      'Aug 20, 2026',
      'XUVF9G4QH86X',
      'https://coursera.org/verify/XUVF9G4QH86X',
      '/assets/aistudio/Coursera_XUVF9G4QH86X_1d5f76c4.pdf',
      'Authorized by Meta and offered through Coursera, covering core back-end web development fundamentals.',
      JSON.stringify(['REST APIs', 'HTML', 'CSS', 'Responsive Design']),
      1
    );
    insertCert.run(
      'Production AI Model Development and Ethics',
      'Coursera (Professionals from the Industry)',
      'Jul 11, 2026',
      'E64YM0IQLQJI',
      'https://coursera.org/verify/E64YM0IQLQJI',
      '/assets/aistudio/Coursera_E64YM0IQLQJI_Certificates_8d86927c.pdf',
      'Course certificate on production AI model development lifecycle and ethical deployment practices.',
      JSON.stringify(['Machine Learning', 'Model Training', 'Large Language Models']),
      2
    );
    insertCert.run(
      'Solution Architecture and Ethical AI Design',
      'Coursera (Professionals from the Industry)',
      'Jul 5, 2026',
      'SJSAJFHE620Q',
      'https://coursera.org/verify/SJSAJFHE620Q',
      '/assets/aistudio/Coursera_SJSAJFHE620Q_Abdullah_Naveed_certificate_1bb7572b.pdf',
      'Course certificate covering AI solution architecture patterns and ethical AI design.',
      JSON.stringify(['AI Agents', 'RAG', 'Docker']),
      3
    );

    // 7. Verified GitHub Projects (inspected directly from github.com/abdullah-v-cmd)
    const insertProject = db.prepare(`
      INSERT INTO projects (
        slug, title, category, tagline, overview, problem_statement, solution_summary,
        architecture_notes, frontend_stack, backend_stack, database_stack, ai_models_stack,
        rag_pipeline_notes, technologies_json, features_json, challenges_json, verified_results_json,
        cover_image, github_url, live_url, github_repo_name, company_id, is_featured, is_published, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertProject.run(
      'omnisynth',
      'OmniSynth — Enterprise AI Research & Productivity Platform',
      'Generative AI & RAG',
      'Multi-agent research orchestration with HyDE-enhanced RAG, multi-engine OCR, and real-time collaboration.',
      'An open-source enterprise AI research and productivity platform powered by Groq (Llama-3-70B, Mixtral-8x7B) and Hugging Face embeddings, featuring 9 specialized LangGraph agents and real-time WebSocket workspaces.',
      'Researchers and engineering teams struggle with fragmented PDF OCR, ungrounded LLM responses, manual citation formatting, and lack of persistent semantic memory across research workspaces.',
      'Combines Hypothetical Document Embeddings (HyDE) over FAISS with multi-engine OCR (PyMuPDF, EasyOCR, pytesseract, pdfplumber) and 9 specialized LangGraph agents inside a FastAPI + Next.js 14 Dockerized architecture.',
      'Next.js 14 frontend communicating with FastAPI REST & WebSocket services, Nginx reverse proxy, PostgreSQL + FAISS semantic memory, and an automated endpoint test suite (test_all_endpoints.py).',
      'Next.js 14, TypeScript, Tailwind CSS',
      'FastAPI, Python 3.11, LangGraph, WebSockets',
      'PostgreSQL, FAISS Vector Store',
      'Groq (Llama-3-70B, Mixtral-8x7B), sentence-transformers (all-MiniLM-L6-v2)',
      'Document Ingestion -> Multi-Engine OCR -> Chunking -> HyDE Query Expansion -> FAISS Vector Search + Reranking -> Grounded Multi-Agent Synthesis.',
      JSON.stringify(['Python', 'FastAPI', 'Next.js', 'TypeScript', 'RAG', 'AI Agents', 'Semantic Search', 'Embeddings', 'Groq API', 'Hugging Face', 'PostgreSQL', 'Docker', 'WebSockets']),
      JSON.stringify([
        '9 specialized LangGraph agents (research, OCR, citation, drafting, summarization, plagiarism, recommendation, productivity, general)',
        'HyDE-enhanced RAG retrieval with FAISS and reranking',
        'Multi-engine OCR pipeline supporting PDFs, images, and DOCX',
        'Citation generator across APA, MLA, IEEE, Chicago, Harvard, Vancouver, ACS, and BibTeX',
        'Real-time WebSocket collaborative workspaces',
      ]),
      JSON.stringify([
        'Coordinating multi-agent tool calls without exceeding free-tier rate limits',
        'Handling scanned PDFs via fallback OCR engines cleanly',
      ]),
      JSON.stringify([
        'Publicly deployed demo interface and open-source Docker Compose architecture verified in repository.',
      ]),
      '/src/assets/images/project_omnisynth_cover_1795329338795.jpg',
      'https://github.com/abdullah-v-cmd/Omni-Advanced-Version-of-Research-Bot',
      'https://omni-advanced-version-of-research-b.vercel.app',
      'Omni-Advanced-Version-of-Research-Bot',
      null,
      1,
      1
    );

    insertProject.run(
      'v-watch',
      'V-Watch — 24/7 CCTV AI Traffic Violation System',
      'Computer Vision',
      'Decoupled multi-container YOLOv8 traffic violation detection with persistent MJPEG relay and auto-recovery watchdog.',
      'Production-oriented traffic violation detection platform engineered with independent edge_ai, stream_relay, FastAPI backend, React frontend, PostgreSQL, and a 15-second health watchdog container.',
      'Monolithic CCTV AI scripts stall when camera streams disconnect, re-download YOLO weights on restart, or tie camera lifetimes to browser HTTP requests.',
      'Decoupled stream_relay container for persistent RTSP/demo MJPEG streams, pre-baked YOLOv8 model weights inside Docker images, exponential back-off reconnect (2s to 60s), and an external watchdog polling /health every 15s.',
      'Dedicated Docker network uniting React/Nginx frontend, FastAPI backend, PostgreSQL 16, stream_relay, edge_ai inference container, and watchdog monitor.',
      'React, Nginx',
      'FastAPI, Python 3.11, Watchdog Service',
      'PostgreSQL 16',
      'Ultralytics YOLOv8, OpenCV',
      '',
      JSON.stringify(['Python', 'FastAPI', 'YOLOv8', 'OpenCV', 'Computer Vision', 'Image Processing', 'PostgreSQL', 'Docker', 'Linux']),
      JSON.stringify([
        'Independent stream_relay container preventing stream drops on page navigation',
        'RTSP & fallback demo camera pipeline with exponential back-off reconnection',
        'Containerized edge_ai worker with pre-cached YOLOv8 weights',
        'Automated 15-second /health watchdog service for container auto-recovery',
      ]),
      JSON.stringify([
        'Decoupling OpenCV frame capture from FastAPI request handlers',
        'Recovering cleanly from intermittent RTSP network drops inside Docker',
      ]),
      JSON.stringify([
        'Multi-container Docker Compose architecture with dedicated watchdog and stream_relay verified in repository.',
      ]),
      '/src/assets/images/project_vwatch_cover_1795329338145.jpg',
      'https://github.com/abdullah-v-cmd/vwatch-ai-traffic-violation-system',
      '',
      'vwatch-ai-traffic-violation-system',
      null,
      1,
      2
    );

    insertProject.run(
      'scalable-rag-platform',
      'RAG Document Intelligence Platform',
      'Generative AI & RAG',
      'Scalable microservices RAG system with FastAPI, PostgreSQL pgvector, Redis, Celery workers, and React.',
      'A scalable document intelligence platform supporting PDF, TXT, DOC, and DOCX ingestion with asynchronous Celery processing, pgvector semantic similarity search, and React interface.',
      'Synchronous document parsing and embedding generation blocks API threads when processing large multi-page enterprise documents.',
      'Offloads document chunking and embedding pipelines to Celery background workers backed by Redis, storing vectors in PostgreSQL with pgvector.',
      'Microservices Docker Compose layout: React frontend -> FastAPI gateway -> Celery workers + Redis broker -> PostgreSQL/pgvector.',
      'React 18, TypeScript',
      'FastAPI, Python 3.11, Celery',
      'PostgreSQL (pgvector), Redis',
      'Sentence Embeddings, Semantic Vector Retrieval',
      'Async Upload -> Celery Worker Extraction -> Chunking -> Vector Embedding -> pgvector Cosine Similarity -> Context-Grounded Generation.',
      JSON.stringify(['Python', 'FastAPI', 'RAG', 'Semantic Search', 'Document Retrieval', 'Vector Databases', 'PostgreSQL', 'Redis', 'React.js', 'Docker']),
      JSON.stringify([
        'Multi-format ingestion (PDF, TXT, DOC, DOCX)',
        'Asynchronous background processing via Celery and Redis',
        'Semantic similarity search powered by pgvector',
      ]),
      JSON.stringify([
        'Coordinating asynchronous indexing status between Celery workers and frontend UI',
      ]),
      JSON.stringify([
        'Containerized microservices layout with deployment documentation verified in repository.',
      ]),
      '/src/assets/images/project_rag_cover_1795329338796.jpg',
      'https://github.com/abdullah-v-cmd/Rag-System-with-scalable-architecture',
      '',
      'Rag-System-with-scalable-architecture',
      dhId ? Number(dhId) : null,
      1,
      3
    );

    insertProject.run(
      '01-vanilla-rag',
      '01 — Vanilla RAG (From-Scratch Retrieval Pipeline)',
      'Generative AI & RAG',
      'Explicit, framework-free RAG implementation from document ingestion and cosine similarity to grounded citations.',
      'A transparent, production-oriented RAG baseline intentionally built without LangChain, LlamaIndex, or managed vector databases so every step—chunking, sentence embeddings, cosine vector search, and citation grounding—is inspectable and testable.',
      'Heavy orchestration frameworks often hide chunk boundaries, retrieval scores, and prompt construction bugs.',
      'Implements explicit Python modules for text chunking, sentence embeddings, normalized cosine similarity scoring, and citation-backed prompting with automated tests.',
      'FastAPI backend service with clean frontend, Docker Compose setup, and pytest suite.',
      'HTML, CSS, JavaScript',
      'FastAPI, Python',
      'In-process vector index',
      'Sentence Embeddings, Cosine Similarity, Grounded LLM Prompting',
      'Ingestion -> Explicit Sliding-Window Chunking -> Embedding Vectors -> Cosine Dot-Product Top-K -> Grounded Citation Prompt.',
      JSON.stringify(['Python', 'FastAPI', 'RAG', 'Embeddings', 'Semantic Search', 'Document Retrieval', 'Docker']),
      JSON.stringify([
        'Zero-framework RAG implementation for full pipeline transparency',
        'Explicit cosine similarity scoring and source citation tracking',
        'Dockerized with automated test coverage',
      ]),
      JSON.stringify([
        'Balancing chunk overlap and retrieval precision without external reranker abstractions',
      ]),
      JSON.stringify([]),
      '/src/assets/images/project_rag_cover_1795329338796.jpg',
      'https://github.com/abdullah-v-cmd/01-vanilla-rag',
      '',
      '01-vanilla-rag',
      dhId ? Number(dhId) : null,
      0,
      4
    );

    insertProject.run(
      'ai-ml-60-models',
      'AI-ML-60-Models Engineering Lab',
      'AI & Machine Learning',
      '60 self-contained machine learning, deep learning, NLP, and computer vision implementations from scratch to PyTorch/TensorFlow.',
      'Comprehensive engineering repository spanning Classical ML (15 models), Unsupervised Learning (5), Deep Learning (13: ANN, CNN, RNN, ResNet, GANs), NLP Sequence Models (11), Computer Vision (10), and Modern AI (6).',
      'Applied ML engineers need reproducible, runnable baselines across classical algorithms and deep neural architectures rather than fragmented notebooks.',
      'Structured every model into its own standalone folder with data preprocessing, training, evaluation, and prediction scripts using scikit-learn, PyTorch, and TensorFlow.',
      'Modular Python repository grouped into 6 engineering domains with unified dependency specifications.',
      '',
      'Python',
      '',
      'scikit-learn, PyTorch, TensorFlow, ANN, RNN, DNN, CNN',
      '',
      JSON.stringify(['Python', 'Machine Learning', 'Deep Learning', 'ANN', 'RNN', 'DNN', 'CNN', 'Data Preprocessing', 'Feature Engineering', 'Model Training', 'Computer Vision']),
      JSON.stringify([
        '15 Classical Machine Learning implementations (Regression, Trees, Ensembles, SVM)',
        '13 Deep Learning & 11 NLP sequence architectures',
        '10 Computer Vision & 6 Modern AI modules',
      ]),
      JSON.stringify([
        'Standardizing reproducible training and evaluation interfaces across 60 distinct model families',
      ]),
      JSON.stringify([]),
      '/src/assets/images/project_mlops_cover_1795329338117.jpg',
      'https://github.com/abdullah-v-cmd/AI-ML-Engineering-Lab',
      '',
      'AI-ML-Engineering-Lab',
      dvId ? Number(dvId) : null,
      1,
      5
    );

    insertProject.run(
      'legalai-assistant',
      'LegalAI — Document Intelligence & Q&A Assistant',
      'Generative AI & RAG',
      'Full-stack legal Q&A, document drafting, and image/document analysis platform with FastAPI and Hugging Face.',
      'A FastAPI and Hugging Face powered legal assistant offering legal Q&A, structured document/paper generation, image and document analysis, JWT authentication, and role-based administration.',
      'Legal research and structured academic/legal drafting require accessible AI assistance coupled with role-based access control and rate limiting.',
      'Implemented a modular FastAPI backend with Alembic migrations, JWT auth, rate limiting, Swagger API docs, CI/CD workflow, and Docker deployment.',
      'Web UI -> FastAPI REST API (Auth/RBAC, AI Services, Document Generator) -> SQLAlchemy + Alembic.',
      'HTML, CSS, JavaScript',
      'FastAPI, Python, SQLAlchemy, JWT, Authentication',
      'SQL Database (Alembic migrations)',
      'Hugging Face Inference Models, Document Analysis',
      '',
      JSON.stringify(['Python', 'FastAPI', 'Hugging Face', 'SQLAlchemy', 'JWT', 'Authentication', 'Docker', 'CI/CD']),
      JSON.stringify([
        'Legal Q&A and structured document generation',
        'JWT authentication with role-based admin controls and rate limiting',
        'Dockerized deployment with GitHub Actions CI/CD',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_omnisynth_cover_1795329338795.jpg',
      'https://github.com/abdullah-v-cmd/legalai-document-intelligence',
      '',
      'legalai-document-intelligence',
      null,
      0,
      6
    );

    insertProject.run(
      'mlops-engineering-lab',
      'MLOps Engineering Lab — Training & Serving Pipeline',
      'Automation & MLOps',
      'End-to-end MLOps workflow covering DVC data versioning, MLflow experiment tracking, API serving, and Docker monitoring.',
      'Practical MLOps engineering platform demonstrating reproducible dataset tracking (DVC), MLflow experiment logging, model packaging, API serving, and container monitoring.',
      'Transitioning ML models beyond Jupyter notebooks requires versioned datasets, tracked experiments, and reproducible serving containers.',
      'Assembled a complete pipeline from dataset ingestion and preprocessing through MLflow-tracked training, artifact packaging, API serving, and Docker deployment.',
      'Dataset -> Preprocessing -> Training (MLflow) -> Model Artifact -> API Service -> Containerization & Monitoring.',
      '',
      'Python, FastAPI, REST APIs',
      'MLflow SQLite tracking',
      'Scikit-learn / ML Pipelines',
      '',
      JSON.stringify(['Python', 'Machine Learning', 'Model Training', 'Docker', 'CI/CD', 'REST APIs']),
      JSON.stringify([
        'DVC pipeline definition (dvc.yaml) and artifact tracking',
        'MLflow experiment tracking and model registry patterns',
        'Containerized model serving and monitoring modules',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_mlops_cover_1795329338117.jpg',
      'https://github.com/abdullah-v-cmd/mlops-engineering-platform',
      '',
      'mlops-engineering-platform',
      null,
      1,
      7
    );

    insertProject.run(
      'zarafit-ai-tryon',
      'ZaraFit — AI Virtual Try-On System',
      'Computer Vision',
      'Virtual garment try-on application integrating IDM-VTON, OpenCV preprocessing, and FastAPI.',
      'Interactive virtual fitting application allowing users to capture live camera frames or upload photos, browse apparel items, and generate virtual try-on previews powered by IDM-VTON and OpenCV.',
      'Online apparel shoppers cannot easily preview how garments fit before purchasing.',
      'Built a FastAPI + OpenCV/rembg image preprocessing pipeline interfacing with the IDM-VTON model via Hugging Face Gradio.',
      'HTML/CSS/JS client -> FastAPI Python backend -> rembg & OpenCV preprocessing -> IDM-VTON inference.',
      'HTML, CSS, JavaScript',
      'FastAPI, Python',
      '',
      'IDM-VTON (Hugging Face), OpenCV, rembg',
      '',
      JSON.stringify(['Python', 'FastAPI', 'OpenCV', 'Image Processing', 'Computer Vision', 'Hugging Face']),
      JSON.stringify([
        'Live camera capture and drag-and-drop photo upload',
        'Background removal and garment masking via rembg and OpenCV',
        'Multi-garment virtual try-on slider',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_vwatch_cover_1795329338145.jpg',
      'https://github.com/abdullah-v-cmd/zarafit-ai-tryon',
      '',
      'zarafit-ai-tryon',
      null,
      0,
      8
    );

    insertProject.run(
      'luxewatch-ecommerce',
      'LuxeWatch — Full-Stack Luxury E-Commerce',
      'Full-Stack Development',
      'Full-stack watches and eyewear store built with FastAPI, Next.js 14, PostgreSQL, Redis, Stripe, and Nginx.',
      'A complete full-stack e-commerce platform featuring JWT access/refresh authentication, product catalog CRUD, Redis caching, Stripe checkout integration, and Docker Compose orchestration.',
      'Building a high-trust luxury storefront requires strict server-side auth, fast catalog responses, and reliable payment/database state.',
      'Paired a SQLAlchemy/Alembic FastAPI backend and PostgreSQL + Redis data layer with a Next.js 14 TypeScript storefront behind Nginx.',
      'Next.js 14 + Tailwind CSS -> Nginx Reverse Proxy -> FastAPI + SQLAlchemy + Redis + PostgreSQL + Stripe.',
      'Next.js, TypeScript, Tailwind CSS, React.js',
      'FastAPI, SQLAlchemy, JWT, REST APIs, Authentication',
      'PostgreSQL, Redis',
      '',
      '',
      JSON.stringify(['Next.js', 'TypeScript', 'Tailwind CSS', 'FastAPI', 'PostgreSQL', 'Redis', 'SQLAlchemy', 'JWT', 'Docker']),
      JSON.stringify([
        'JWT access and refresh token authentication with profile management',
        'Product catalog CRUD, filtering, and Redis caching',
        'Stripe payment workflow and Docker Compose Nginx deployment',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_omnisynth_cover_1795329338795.jpg',
      'https://github.com/abdullah-v-cmd/luxewatch-ecommerce',
      '',
      'luxewatch-ecommerce',
      null,
      0,
      9
    );

    insertProject.run(
      'scaleable-ai-api',
      'Scaleable AI API System — Unified Multi-Model Gateway',
      'Full-Stack Development',
      'Edge-ready unified TypeScript API gateway routing requests across OpenAI, Anthropic, Gemini, and Cohere.',
      'A multi-model AI gateway built with Hono and TypeScript designed for edge deployment, providing a unified interface, migrations, seed scripts, and load-testing harnesses.',
      'Integrating disparate LLM vendor SDKs across applications creates duplicated auth, retry, and schema logic.',
      'Implemented a unified TypeScript routing layer with Docker Compose, CI/CD GitHub Actions, database migrations, and loadtest scripts.',
      'TypeScript/Hono edge API -> Provider adapters -> SQL migrations + Docker.',
      'TypeScript, Vite',
      'Node.js, REST APIs, API Integration',
      'SQL Migrations',
      'Multi-provider LLM Routing',
      '',
      JSON.stringify(['TypeScript', 'Node.js', 'REST APIs', 'API Integration', 'Docker', 'CI/CD']),
      JSON.stringify([
        'Unified adapter layer for multiple LLM providers',
        'GitHub Actions CI/CD pipeline and load testing suite',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_mlops_cover_1795329338117.jpg',
      'https://github.com/abdullah-v-cmd/Scaleable-Ai-api-system',
      '',
      'Scaleable-Ai-api-system',
      null,
      0,
      10
    );

    insertProject.run(
      'gymbro-fullstack',
      'Muscle Bros — Full-Stack Membership & AI Support Platform',
      'Full-Stack Development',
      'Full-stack membership, subscription, email automation, and Groq AI assistant platform with FastAPI & Next.js 14.',
      'Built for a UK youth-empowerment gym and mentorship program, combining JWT user registration, subscription workflows, Groq-powered AI support, background email automation, and an admin dashboard.',
      'Community membership organizations need integrated subscription management, automated member emails, and an administrative portal in one cohesive stack.',
      'Engineered a FastAPI + PostgreSQL + Redis backend paired with a Next.js 14 TypeScript frontend and Docker Compose orchestration.',
      'Next.js 14 Frontend -> FastAPI Backend (JWT, RBAC, Rate Limiting, Email Automation) -> PostgreSQL + Redis.',
      'Next.js, TypeScript, React.js',
      'FastAPI, JWT, Authentication, REST APIs',
      'PostgreSQL, Redis',
      'Groq API AI Support Assistant',
      '',
      JSON.stringify(['Next.js', 'TypeScript', 'FastAPI', 'PostgreSQL', 'Redis', 'Groq API', 'JWT', 'Docker']),
      JSON.stringify([
        'Membership & subscription lifecycle workflows',
        'Groq-powered AI support assistant',
        'Admin dashboard with rate limiting and role-based access control',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_rag_cover_1795329338796.jpg',
      'https://github.com/abdullah-v-cmd/gymbro-fullstack-platform',
      '',
      'gymbro-fullstack-platform',
      null,
      0,
      11
    );

    insertProject.run(
      'ai-studio-multimodal',
      'Multi-Modal AI Content Generation Platform',
      'Generative AI & RAG',
      'Unified free-tier image (FLUX.1-schnell/SDXL), TTS audio, and Llama-3.3-70B text generation platform.',
      'Web platform combining image generation (FLUX.1-schnell and SDXL via Hugging Face), text-to-speech synthesis, and Llama-3.3-70B text generation with TypeScript and Cloudflare Workers/Vite.',
      'Creators experimenting with open-weights multimodal models often juggle separate tools for text, image, and speech.',
      'Built an integrated TypeScript application routing image, audio, and text prompts to open-weights inference APIs with style presets.',
      'TypeScript + Vite UI -> API Worker layer -> Hugging Face / Llama Inference.',
      'TypeScript, React.js, Tailwind CSS',
      'REST APIs, API Integration',
      'SQL Migrations',
      'FLUX.1-schnell, SDXL, Llama-3.3-70B, MMS-TTS',
      '',
      JSON.stringify(['TypeScript', 'Hugging Face', 'Large Language Models', 'API Integration']),
      JSON.stringify([
        'Multi-variant image generation with 6 style presets',
        'Text-to-speech synthesis and Llama text generation',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_omnisynth_cover_1795329338795.jpg',
      'https://github.com/abdullah-v-cmd/AI-Studio-Multi-Modal-AI-Content-Generation-Platform',
      '',
      'AI-Studio-Multi-Modal-AI-Content-Generation-Platform',
      null,
      0,
      12
    );

    insertProject.run(
      'linkedin-job-bot',
      'LinkedIn Job Bot — Automated Search & CV Matching',
      'Automation & MLOps',
      'Python + Flask & TypeScript automation suite for job search, PDF/TXT CV extraction, and match scoring.',
      'Automates job discovery, CV skill extraction from PDF/TXT resumes, match scoring, AI interview answer drafting, and Word document export.',
      'Manually filtering job boards and tailoring application notes across dozens of listings is slow and error-prone.',
      'Created a Python Flask service paired with TypeScript UI components for automated job parsing, CV matching, and structured export.',
      'React/TypeScript UI -> Python Flask automation backend.',
      'TypeScript, React.js',
      'Python, REST APIs',
      '',
      'CV Extraction & Match Scoring',
      '',
      JSON.stringify(['Python', 'TypeScript', 'React.js', 'REST APIs']),
      JSON.stringify([
        'Drag-and-drop PDF/TXT CV parsing and skill extraction',
        'Automated job filtering and match-score calculation',
        'Word document export of matched opportunities',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_mlops_cover_1795329338117.jpg',
      'https://github.com/abdullah-v-cmd/linkedin-job-bot',
      '',
      'linkedin-job-bot',
      null,
      0,
      13
    );

    insertProject.run(
      'ml-pipeline-end-to-end',
      'ML Pipeline End-to-End — Interactive Regression Workbench',
      'AI & Machine Learning',
      'Full-stack web workbench for CSV dataset ingestion, model training, real-time predictions, and experiment tracking.',
      'Interactive machine learning web platform enabling CSV dataset uploads with automatic feature detection, regression model training (Linear, Polynomial, Ridge), real-time inference, and experiment logging.',
      'Rapidly inspecting tabular datasets and comparing regression baselines often requires switching between notebooks and spreadsheets.',
      'Built an end-to-end JavaScript/TypeScript web application with D1/SQL migrations and seeded datasets.',
      'Vite frontend + Edge API + SQL migrations.',
      'JavaScript, TypeScript, Vite',
      'REST APIs',
      'SQL Migrations',
      'Linear, Polynomial, and Ridge Regression',
      '',
      JSON.stringify(['JavaScript', 'TypeScript', 'Machine Learning', 'Data Preprocessing', 'Feature Engineering', 'Model Training']),
      JSON.stringify([
        'CSV dataset upload and automatic feature inspection',
        'Interactive model training and experiment tracking',
      ]),
      JSON.stringify([]),
      JSON.stringify([]),
      '/src/assets/images/project_mlops_cover_1795329338117.jpg',
      'https://github.com/abdullah-v-cmd/ML-PipeLine-End-to-End',
      '',
      'ML-PipeLine-End-to-End',
      null,
      0,
      14
    );

    // 8. Seed initial verified GitHub repository discovery index
    const allRepos = [
      { name: 'Omni-Advanced-Version-of-Research-Bot', lang: 'Python', desc: 'OmniSynth - Enterprise AI Research & Productivity Platform', url: 'https://github.com/abdullah-v-cmd/Omni-Advanced-Version-of-Research-Bot', home: 'https://omni-advanced-version-of-research-b.vercel.app', status: 'approved' },
      { name: 'vwatch-ai-traffic-violation-system', lang: 'Python', desc: 'V-Watch: AI-Powered Smart Traffic Violation Detection and Centralized Management System', url: 'https://github.com/abdullah-v-cmd/vwatch-ai-traffic-violation-system', home: '', status: 'approved' },
      { name: 'Rag-System-with-scalable-architecture', lang: 'Python', desc: 'RAG Document Intelligence Platform with FastAPI, pgvector, Redis, Celery, React', url: 'https://github.com/abdullah-v-cmd/Rag-System-with-scalable-architecture', home: '', status: 'approved' },
      { name: '01-vanilla-rag', lang: 'Python', desc: 'From-scratch Retrieval-Augmented Generation pipeline without framework bloat', url: 'https://github.com/abdullah-v-cmd/01-vanilla-rag', home: '', status: 'approved' },
      { name: 'AI-ML-Engineering-Lab', lang: 'Python', desc: '60 Complete, Self-Contained AI & Machine Learning Model Implementations', url: 'https://github.com/abdullah-v-cmd/AI-ML-Engineering-Lab', home: '', status: 'approved' },
      { name: 'legalai-document-intelligence', lang: 'HTML', desc: 'LegalAI - AI-powered Legal Assistant with FastAPI, HuggingFace models, document generation, admin panel', url: 'https://github.com/abdullah-v-cmd/legalai-document-intelligence', home: '', status: 'approved' },
      { name: 'mlops-engineering-platform', lang: 'Python', desc: 'MLOps Engineering Lab - Model Training, DVC, MLflow & Docker Deployment', url: 'https://github.com/abdullah-v-cmd/mlops-engineering-platform', home: '', status: 'approved' },
      { name: 'zarafit-ai-tryon', lang: 'HTML', desc: 'ZaraFit - AI Virtual Try-On Bot powered by IDM-VTON', url: 'https://github.com/abdullah-v-cmd/zarafit-ai-tryon', home: '', status: 'approved' },
      { name: 'luxewatch-ecommerce', lang: 'TypeScript', desc: 'Premium Watch & Glasses eCommerce - Full Stack (FastAPI + Next.js + PostgreSQL + Redis + Stripe)', url: 'https://github.com/abdullah-v-cmd/luxewatch-ecommerce', home: '', status: 'approved' },
      { name: 'Scaleable-Ai-api-system', lang: 'TypeScript', desc: 'Multi-Model AI Service Platform built with Hono and TypeScript', url: 'https://github.com/abdullah-v-cmd/Scaleable-Ai-api-system', home: '', status: 'approved' },
      { name: 'gymbro-fullstack-platform', lang: 'Python', desc: 'Muscle Bros - Full-Stack Membership Platform with FastAPI, Next.js 14, PostgreSQL, Redis, Groq', url: 'https://github.com/abdullah-v-cmd/gymbro-fullstack-platform', home: '', status: 'approved' },
      { name: 'AI-Studio-Multi-Modal-AI-Content-Generation-Platform', lang: 'TypeScript', desc: 'Multi-Modal AI Content Generation Platform (FLUX.1-schnell, SDXL, TTS, Llama-3.3-70B)', url: 'https://github.com/abdullah-v-cmd/AI-Studio-Multi-Modal-AI-Content-Generation-Platform', home: '', status: 'approved' },
      { name: 'linkedin-job-bot', lang: 'TypeScript', desc: 'LinkedIn Job Bot - Auto job search, CV matching, AI answers & GitHub sync', url: 'https://github.com/abdullah-v-cmd/linkedin-job-bot', home: '', status: 'approved' },
      { name: 'ML-PipeLine-End-to-End', lang: 'JavaScript', desc: 'End-to-End Machine Learning Web Platform', url: 'https://github.com/abdullah-v-cmd/ML-PipeLine-End-to-End', home: '', status: 'approved' },
      { name: 'LMS-COMPLETE', lang: 'TypeScript', desc: 'Learning Management System platform', url: 'https://github.com/abdullah-v-cmd/LMS-COMPLETE', home: 'https://lms-complete-iota.vercel.app', status: 'discovered' },
      { name: 'production-rag-document-intelligence', lang: 'Python', desc: 'RAG Chatbot using LangChain, FAISS, Sentence Transformers & PyPDF', url: 'https://github.com/abdullah-v-cmd/production-rag-document-intelligence', home: '', status: 'discovered' },
      { name: 'Jarvis-Assistant', lang: 'Python', desc: 'Python voice assistant using speech recognition and text-to-speech', url: 'https://github.com/abdullah-v-cmd/Jarvis-Assistant', home: '', status: 'discovered' },
      { name: 'multi_gan_ai', lang: 'Python', desc: 'Generative Adversarial Network experiments in Python', url: 'https://github.com/abdullah-v-cmd/multi_gan_ai', home: '', status: 'discovered' },
      { name: 'marketshield-ai', lang: '', desc: 'Repository pending README and source inspection', url: 'https://github.com/abdullah-v-cmd/marketshield-ai', home: '', status: 'discovered' },
      { name: 'bros-fullstack', lang: 'TypeScript', desc: 'Full-stack TypeScript application', url: 'https://github.com/abdullah-v-cmd/bros-fullstack', home: '', status: 'discovered' },
      { name: 'muscle-bros', lang: 'TypeScript', desc: 'Muscle Bros web frontend', url: 'https://github.com/abdullah-v-cmd/muscle-bros', home: '', status: 'discovered' },
      { name: 'linkedin-job-bot-results', lang: '', desc: 'LinkedIn Job Bot automated tracking outputs', url: 'https://github.com/abdullah-v-cmd/linkedin-job-bot-results', home: '', status: 'discovered' },
    ];
    const insertRepo = db.prepare(`
      INSERT INTO github_repos (name, full_name, description, language, html_url, homepage, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of allRepos) {
      insertRepo.run(r.name, `abdullah-v-cmd/${r.name}`, r.desc, r.lang, r.url, r.home, r.status);
    }

    // 9. AI Providers (Default Gemini Server Key + Configurable Groq/OpenAI-Compatible Templates)
    const insertProvider = db.prepare(`
      INSERT INTO ai_providers (
        name, provider_type, base_url, model_name, embedding_model,
        is_active, is_fallback, max_tokens, rate_limit_rpm, last_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const hasGroqSeedKey = Boolean(getGroqEnvKey());
    insertProvider.run(
      'Google Gemini (Server Runtime)',
      'gemini',
      'https://generativelanguage.googleapis.com',
      'gemini-4-hydrogen',
      'gemini-embedding-2',
      hasGroqSeedKey ? 0 : 1,
      hasGroqSeedKey ? 1 : 0,
      1024,
      30,
      process.env.GEMINI_API_KEY ? 'configured' : 'awaiting_env_key'
    );
    insertProvider.run(
      'Groq Llama 3 (OpenAI-Compatible)',
      'openai_compatible',
      'https://api.groq.com/openai/v1',
      'openai/gpt-oss-120b',
      'local-semantic-v1',
      hasGroqSeedKey ? 1 : 0,
      hasGroqSeedKey ? 0 : 1,
      1024,
      30,
      hasGroqSeedKey ? 'configured' : 'awaiting_api_key'
    );
  })();
}

const HIGH_DEMAND_SKILL_CATEGORIES: Array<{ name: string; slug: string; skills: string[] }> = [
  {
    name: 'Generative AI & LLM Engineering',
    slug: 'genai-llm',
    skills: [
      'LangGraph',
      'LangChain',
      'RAG',
      'HyDE Retrieval',
      'Multi-Agent Orchestration',
      'FAISS',
      'pgvector',
      'Sentence Transformers',
      'Vector Databases',
      'Groq API',
      'Multi-Provider LLM Routing',
      'Multi-Engine OCR',
    ],
  },
  {
    name: 'AI, Deep Learning & MLOps',
    slug: 'ai-ml',
    skills: [
      'PyTorch',
      'TensorFlow',
      'scikit-learn',
      'Hugging Face',
      'MLflow',
      'DVC',
      'Machine Learning',
      'Deep Learning',
      'Feature Engineering',
      'Model Serving & Evaluation',
    ],
  },
  {
    name: 'Computer Vision & Edge AI',
    slug: 'cv',
    skills: [
      'YOLOv8',
      'OpenCV',
      'Computer Vision',
      'RTSP Stream Pipelines',
      'IDM-VTON',
      'Edge AI Inference',
    ],
  },
  {
    name: 'Backend & Distributed APIs',
    slug: 'backend',
    skills: [
      'FastAPI',
      'Python',
      'Node.js',
      'Express.js',
      'Hono',
      'Celery',
      'WebSockets & SSE',
      'SQLAlchemy',
      'Alembic',
      'JWT & RBAC Security',
      'REST APIs',
    ],
  },
  {
    name: 'Frontend & Interactive Web',
    slug: 'frontend',
    skills: ['TypeScript', 'Next.js', 'React.js', 'Tailwind CSS', 'Three.js'],
  },
  {
    name: 'Databases & Caching',
    slug: 'databases',
    skills: ['PostgreSQL', 'Redis', 'SQLite', 'MongoDB', 'MySQL'],
  },
  {
    name: 'Cloud, Docker & DevOps',
    slug: 'devops',
    skills: ['Docker', 'Docker Compose', 'CI/CD', 'Cloudflare Workers', 'Vercel', 'AWS', 'Linux'],
  },
];

const SKILL_SEARCH_ALIASES: Record<string, string[]> = {
  'HyDE Retrieval': ['hyde'],
  'Multi-Agent Orchestration': ['multi-agent', 'langgraph', '9 specialized'],
  'Multi-Engine OCR': ['ocr', 'pymupdf', 'easyocr', 'pytesseract', 'pdfplumber'],
  'Multi-Provider LLM Routing': ['multi-provider', 'llm routing', 'ai gateway'],
  'Sentence Transformers': ['sentence-transformers', 'all-minilm', 'sentence embeddings'],
  'Vector Databases': ['vector', 'faiss', 'pgvector'],
  'Hugging Face': ['hugging face', 'huggingface', 'idm-vton', 'flux.1'],
  'Model Serving & Evaluation': ['model training', 'serving', 'evaluation', 'mlops'],
  'RTSP Stream Pipelines': ['rtsp', 'watchdog'],
  'Edge AI Inference': ['edge_ai', 'edge inference', 'yolov8'],
  'WebSockets & SSE': ['websocket', 'websockets', 'streaming'],
  Alembic: ['alembic', 'migrations'],
  'JWT & RBAC Security': ['jwt', 'rbac', 'role-based', 'authentication'],
  'Docker Compose': ['docker compose', 'docker'],
  'Cloudflare Workers': ['cloudflare'],
};

const SKILL_PROFILES: Record<string, { description: string; whatItDoes: string; howUsed: string }> = {
  LangGraph: {
    description: 'Stateful multi-actor agent orchestration graph library for complex LLM workflows.',
    whatItDoes: 'Coordinates cyclical tool-calling, shared memory state, and specialized sub-agent handoffs.',
    howUsed: 'Orchestrates 9 specialized research & synthesis agents inside OmniSynth.',
  },
  LangChain: {
    description: 'Composable framework for document loaders, splitters, retrievers, and LLM chains.',
    whatItDoes: 'Connects unstructured enterprise files with vector indices and grounded prompt templates.',
    howUsed: 'Powers document ingestion and vector retrieval flows in Production RAG Document Intelligence.',
  },
  RAG: {
    description: 'Retrieval-Augmented Generation grounding LLM outputs in verified external documents.',
    whatItDoes: 'Combines document chunking, dense embeddings, similarity search, and citation-backed synthesis.',
    howUsed: 'Built production RAG pipelines at Developers Hub and engineered OmniSynth, Scalable RAG, and 01-Vanilla-RAG.',
  },
  'HyDE Retrieval': {
    description: 'Hypothetical Document Embeddings technique improving dense semantic search recall.',
    whatItDoes: 'Generates a hypothetical answer embedding to bridge query-to-document vocabulary gaps.',
    howUsed: 'Integrated over FAISS inside OmniSynth for higher-accuracy research retrieval.',
  },
  'Multi-Agent Orchestration': {
    description: 'Architecture coordinating multiple specialized AI agents with distinct reasoning roles.',
    whatItDoes: 'Splits complex research, validation, OCR, and synthesis tasks across collaborative agents.',
    howUsed: 'Engineered 9-agent LangGraph research pipelines in OmniSynth.',
  },
  FAISS: {
    description: 'Facebook AI Similarity Search high-speed dense vector indexing library.',
    whatItDoes: 'Performs low-latency nearest-neighbor similarity search across large embedding collections.',
    howUsed: 'Primary vector retrieval engine in OmniSynth and Production RAG Document Intelligence.',
  },
  pgvector: {
    description: 'PostgreSQL vector similarity extension unifying relational data and embeddings.',
    whatItDoes: 'Enables transactional ACID queries alongside cosine/L2 vector indexing in one database.',
    howUsed: 'Backs multi-user semantic document indexing in Scalable RAG Platform.',
  },
  'Sentence Transformers': {
    description: 'Dense bi-encoder transformer models (such as all-MiniLM-L6-v2) for semantic embeddings.',
    whatItDoes: 'Encodes text chunks and queries into dense vector space for semantic similarity.',
    howUsed: 'Generates local document and query embeddings in OmniSynth and 01-Vanilla-RAG.',
  },
  'Vector Databases': {
    description: 'Specialized storage and indexing engines for high-dimensional neural embeddings.',
    whatItDoes: 'Persists, indexes, and queries millions of semantic document chunks at millisecond latency.',
    howUsed: 'Architected across FAISS and PostgreSQL pgvector deployments in RAG systems.',
  },
  'Groq API': {
    description: 'Ultra-low-latency LPU inference API for Llama-3.3-70B, Llama-3-70B, and Mixtral models.',
    whatItDoes: 'Executes fast chat completions and multi-agent reasoning steps in milliseconds.',
    howUsed: 'Powers OmniSynth agents, Muscle Bros AI support assistant, and live inference in this portfolio.',
  },
  'Multi-Provider LLM Routing': {
    description: 'Resilient AI gateway pattern routing requests across Gemini, Groq, and OpenAI-compatible APIs.',
    whatItDoes: 'Handles automatic provider failover, rate limiting, and structured output enforcement.',
    howUsed: 'Built into Scaleable AI API Gateway (Hono) and this portfolio’s Abdullah AI backend.',
  },
  'Multi-Engine OCR': {
    description: 'Layered document extraction combining PyMuPDF, EasyOCR, pytesseract, and pdfplumber.',
    whatItDoes: 'Extracts clean text from native PDFs, scanned images, and complex multi-column tables.',
    howUsed: 'Ingests heterogeneous research documents inside OmniSynth.',
  },
  PyTorch: {
    description: 'Industry-standard deep learning framework with dynamic computation graphs.',
    whatItDoes: 'Trains custom neural networks, computer vision architectures, and generative GAN models.',
    howUsed: 'Used across AI-ML-Engineering-Lab neural implementations and Multi-GAN Multimodal AI.',
  },
  TensorFlow: {
    description: 'End-to-end open-source deep learning platform for training and serving models.',
    whatItDoes: 'Builds, evaluates, and exports neural sequence and vision pipelines.',
    howUsed: 'Applied in deep learning model implementations within AI-ML-Engineering-Lab.',
  },
  'scikit-learn': {
    description: 'Production Python library for classical machine learning and preprocessing pipelines.',
    whatItDoes: 'Implements regression, classification, clustering, cross-validation, and feature transformers.',
    howUsed: 'Core ML toolkit in AI-ML-Engineering-Lab, MLOps Engineering Lab, and ML Pipeline workbench.',
  },
  'Hugging Face': {
    description: 'Open-weights AI ecosystem for transformers, diffusion models, and inference endpoints.',
    whatItDoes: 'Supplies pretrained NLP, multimodal image (FLUX/SDXL), TTS, and virtual try-on models.',
    howUsed: 'Powers LegalAI, AI Studio Multimodal (FLUX.1-schnell/SDXL), and ZaraFit IDM-VTON.',
  },
  MLflow: {
    description: 'Open-source MLOps platform for experiment tracking, metrics, and model registry.',
    whatItDoes: 'Logs hyperparameters, evaluation scores, and reproducible model artifacts per run.',
    howUsed: 'Tracks training runs and model versions in MLOps Engineering Lab.',
  },
  DVC: {
    description: 'Data Version Control for reproducible ML datasets and multi-stage pipelines.',
    whatItDoes: 'Versions large training datasets and pipeline DAGs cleanly alongside Git.',
    howUsed: 'Manages reproducible dataset lineage and pipeline stages in MLOps Engineering Lab.',
  },
  'Machine Learning': {
    description: 'Applied supervised and unsupervised statistical learning systems.',
    whatItDoes: 'Solves classification, regression, clustering, and forecasting problems on structured data.',
    howUsed: 'Trained and deployed across DeepVision.ai, AI-ML-60-Models Lab, and ML Pipeline workbench.',
  },
  'Deep Learning': {
    description: 'Multi-layer neural architectures including CNNs, RNNs, transformers, and GANs.',
    whatItDoes: 'Learns hierarchical representations from images, sequences, and high-dimensional data.',
    howUsed: 'Built and trained neural architectures at DeepVision.ai, AI-ML-Engineering-Lab, and Multi-GAN AI.',
  },
  'Feature Engineering': {
    description: 'Domain-driven transformation of raw signals into predictive model features.',
    whatItDoes: 'Improves model generalization through encoding, normalization, and dimensionality reduction.',
    howUsed: 'Applied at DeepVision.ai and in the End-to-End ML Pipeline workbench.',
  },
  'Model Serving & Evaluation': {
    description: 'Productionizing trained ML models behind typed inference APIs with metric validation.',
    whatItDoes: 'Verifies accuracy/drift benchmarks and serves predictions reliably over REST endpoints.',
    howUsed: 'Engineered in MLOps Engineering Lab and DeepVision.ai workflows.',
  },
  YOLOv8: {
    description: 'Real-time object detection architecture by Ultralytics.',
    whatItDoes: 'Detects vehicles, traffic participants, and rule violations across live video frames.',
    howUsed: 'Pre-baked into the isolated edge_ai inference container in V-Watch 24/7 CCTV surveillance.',
  },
  OpenCV: {
    description: 'Open-source computer vision and real-time video frame processing library.',
    whatItDoes: 'Handles RTSP frame capture, mask preprocessing, spatial transforms, and visual overlays.',
    howUsed: 'Powers V-Watch frame capture/relay recovery and ZaraFit garment preprocessing.',
  },
  'Computer Vision': {
    description: 'Automated visual understanding across real-time camera feeds and image pipelines.',
    whatItDoes: 'Extracts detections, tracking metadata, and segmented masks from visual inputs.',
    howUsed: 'Core domain of V-Watch traffic surveillance, ZaraFit try-on, and AI-ML vision labs.',
  },
  'RTSP Stream Pipelines': {
    description: 'Continuous live IP camera stream ingestion with automated watchdog recovery.',
    whatItDoes: 'Maintains 24/7 CCTV video streams and recovers automatically from network/frame drops.',
    howUsed: 'Architected the self-healing RTSP relay & watchdog service in V-Watch.',
  },
  'IDM-VTON': {
    description: 'Diffusion-based virtual garment try-on architecture conditioned on pose and clothing.',
    whatItDoes: 'Synthesizes realistic virtual try-on previews from user photos and garment images.',
    howUsed: 'Powers the ZaraFit AI Virtual Try-On Bot alongside rembg background segmentation.',
  },
  'Edge AI Inference': {
    description: 'Containerized local/edge neural inference optimized for continuous low-latency execution.',
    whatItDoes: 'Runs vision models close to camera feeds with strict container isolation and failover.',
    howUsed: 'Designed the isolated edge_ai YOLOv8 service container in V-Watch.',
  },
  Python: {
    description: 'Primary engineering language for AI pipelines, computer vision workers, and FastAPI backends.',
    whatItDoes: 'Powers ML/DL training, async REST/WebSocket APIs, OCR, and automation systems.',
    howUsed: 'Used across DeepVision.ai, Developers Hub, OmniSynth, V-Watch, Scalable RAG, and 60+ ML models.',
  },
  FastAPI: {
    description: 'High-performance asynchronous Python web framework with automatic OpenAPI schemas.',
    whatItDoes: 'Serves typed REST APIs, JWT auth, streaming responses, and WebSocket real-time workspaces.',
    howUsed: 'Core backend framework in OmniSynth, V-Watch, Scalable RAG, LegalAI, LuxeWatch, and Muscle Bros.',
  },
  'Node.js': {
    description: 'Server-side JavaScript/TypeScript runtime for scalable APIs and real-time backends.',
    whatItDoes: 'Runs Express/Hono services, auth middleware, background webhooks, and tooling.',
    howUsed: 'Powers LMS-COMPLETE, Scaleable AI API Gateway, and this portfolio’s Express backend.',
  },
  'Express.js': {
    description: 'Minimalist Node.js HTTP server framework for structured REST APIs and security middleware.',
    whatItDoes: 'Handles routing, rate limiting, file uploads, Helmet security, and JSON APIs.',
    howUsed: 'Core server framework powering this portfolio’s public/admin API and CMS.',
  },
  Hono: {
    description: 'Ultrafast Web-Standards TypeScript router built for Cloudflare Workers and edge runtimes.',
    whatItDoes: 'Routes low-latency edge API requests with zero cold-start bloat.',
    howUsed: 'Powers the unified multi-model AI gateway in Scaleable AI API System.',
  },
  Celery: {
    description: 'Distributed asynchronous task queue for heavy background Python workloads.',
    whatItDoes: 'Offloads document chunking, OCR, and embedding generation from web request threads.',
    howUsed: 'Processes asynchronous RAG indexing jobs backed by Redis in Scalable RAG Platform.',
  },
  'WebSockets & SSE': {
    description: 'Bidirectional and server-push streaming protocols for live AI and collaborative UX.',
    whatItDoes: 'Streams LLM tokens incrementally and synchronizes multi-user workspace state.',
    howUsed: 'Implemented WebSocket collaboration in OmniSynth and SSE token streaming in Abdullah AI.',
  },
  SQLAlchemy: {
    description: 'Python SQL toolkit and Object-Relational Mapper for typed database workflows.',
    whatItDoes: 'Models relational schemas, session transactions, and safe parameterized queries.',
    howUsed: 'ORM layer in LegalAI Document Intelligence and LuxeWatch E-Commerce.',
  },
  Alembic: {
    description: 'Database schema migration engine for SQLAlchemy and PostgreSQL.',
    whatItDoes: 'Tracks versioned forward/rollback DDL migrations cleanly across environments.',
    howUsed: 'Manages schema migrations in LuxeWatch E-Commerce and LegalAI.',
  },
  'JWT & RBAC Security': {
    description: 'Stateless token authentication paired with strict role-based access control and TOTP MFA.',
    whatItDoes: 'Protects multi-role endpoints, admin portals, and tenant resources against privilege escalation.',
    howUsed: 'Implemented across LMS-COMPLETE, LuxeWatch, GymBro, LegalAI, and this portfolio’s Admin Portal.',
  },
  'REST APIs': {
    description: 'Clean resource-oriented HTTP APIs with schema validation, versioning, and error contracts.',
    whatItDoes: 'Connects frontend apps, mobile clients, AI workers, and third-party webhooks reliably.',
    howUsed: 'Standard integration layer across all full-stack and AI backend services.',
  },
  TypeScript: {
    description: 'Statically typed superset of JavaScript for reliable full-stack applications.',
    whatItDoes: 'Prevents runtime schema bugs across edge gateways, React components, and Express APIs.',
    howUsed: 'Core language for Scaleable AI API Gateway, LuxeWatch, LMS-COMPLETE, AI Studio, and this portfolio.',
  },
  'Next.js': {
    description: 'Full-stack React framework for server-rendered and modern interactive TypeScript applications.',
    whatItDoes: 'Delivers fast client/server routing, structured UI components, and clean API integration.',
    howUsed: 'Built web interfaces for OmniSynth, LuxeWatch E-Commerce, and Muscle Bros Full-Stack.',
  },
  'React.js': {
    description: 'Declarative component library for building responsive web applications and admin portals.',
    whatItDoes: 'Manages interactive client state, real-time streaming chat, carousels, and dashboards.',
    howUsed: 'Frontend layer for V-Watch, Scalable RAG Platform, LinkedIn Job Bot, LMS-COMPLETE, and this portfolio.',
  },
  'Tailwind CSS': {
    description: 'Utility-first CSS engine for rapid, consistent, responsive UI architecture.',
    whatItDoes: 'Builds high-contrast dark interfaces, responsive grids, and accessible interactive states.',
    howUsed: 'Styling engine across LuxeWatch, AI Studio, LMS-COMPLETE, and this portfolio.',
  },
  'Three.js': {
    description: 'WebGL 3D graphics engine for hardware-accelerated interactive web scenes.',
    whatItDoes: 'Renders spatial particle fields, interactive depth canvases, and real-time shaders.',
    howUsed: 'Powers the interactive 3D hero background canvas in this portfolio platform.',
  },
  PostgreSQL: {
    description: 'Enterprise relational database system with strong ACID guarantees and pgvector extensions.',
    whatItDoes: 'Stores relational application records alongside high-dimensional vector embeddings.',
    howUsed: 'Primary datastore across OmniSynth, V-Watch, Scalable RAG (pgvector), LuxeWatch, and Muscle Bros.',
  },
  Redis: {
    description: 'In-memory data structure store used for caching and distributed task queues.',
    whatItDoes: 'Accelerates API catalog reads and acts as message broker for asynchronous Celery workers.',
    howUsed: 'Backs async document ingestion in Scalable RAG and product caching in LuxeWatch & Muscle Bros.',
  },
  SQLite: {
    description: 'High-speed embedded relational database with WAL mode and zero network overhead.',
    whatItDoes: 'Serves transactional CMS state, MLflow tracking stores, and local RAG chunk indexes.',
    howUsed: 'Drives MLOps Engineering Lab tracking and this portfolio’s WAL-mode database.',
  },
  MongoDB: {
    description: 'Document-oriented NoSQL database for flexible JSON-like schemas.',
    whatItDoes: 'Stores semi-structured application documents and rapid prototype collections.',
    howUsed: 'Applied in full-stack document persistence workflows.',
  },
  MySQL: {
    description: 'Widely deployed relational database engine for structured web applications.',
    whatItDoes: 'Provides reliable relational tables, indexing, and transactional SQL storage.',
    howUsed: 'Applied across relational web backend implementations.',
  },
  Docker: {
    description: 'Containerization platform for packaging reproducible multi-service applications.',
    whatItDoes: 'Isolates API servers, databases, Redis brokers, and ML workers into deterministic images.',
    howUsed: 'Containerized RAG services at Developers Hub and packaged V-Watch, OmniSynth, LegalAI, and LMS-COMPLETE.',
  },
  'Docker Compose': {
    description: 'Multi-container orchestration for running interconnected API, DB, queue, and AI services.',
    whatItDoes: 'Defines shared networks, healthchecks, volumes, and dependency startup ordering.',
    howUsed: 'Orchestrates multi-service stacks in V-Watch, Scalable RAG, OmniSynth, and LuxeWatch.',
  },
  'CI/CD': {
    description: 'Automated build, lint, test, and deployment pipelines for continuous delivery.',
    whatItDoes: 'Catches regressions early and automates artifact packaging and service rollouts.',
    howUsed: 'Configured automated quality and deployment workflows in LegalAI, MLOps Lab, and Scaleable AI API.',
  },
  'Cloudflare Workers': {
    description: 'Serverless edge compute platform running TypeScript close to global users.',
    whatItDoes: 'Executes ultra-low-latency API gateways and static web workloads at the edge.',
    howUsed: 'Deploys Scaleable AI API Gateway and the ML-PipeLine-End-to-End workbench.',
  },
  Vercel: {
    description: 'Cloud platform optimized for Next.js and TypeScript full-stack web deployments.',
    whatItDoes: 'Provides automated preview URLs, edge routing, and production frontend hosting.',
    howUsed: 'Hosts the live public deployments of OmniSynth and EduSphere / LMS-COMPLETE.',
  },
  AWS: {
    description: 'Cloud infrastructure platform for scalable compute, storage, and container hosting.',
    whatItDoes: 'Supports production backend deployments, object storage, and cloud networking.',
    howUsed: 'Applied in cloud deployment architecture and infrastructure workflows.',
  },
  Linux: {
    description: 'Server operating system foundation for Docker hosts, GPU inference nodes, and networking.',
    whatItDoes: 'Runs headless containers, process watchdogs, shell automation, and reverse proxies.',
    howUsed: 'Production runtime environment for V-Watch surveillance containers and Docker Compose stacks.',
  },
};

function runPostSeedMigrations(): void {
  // 0. Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 0a. Replace basic initial skills with high-demand market skill set (one-time idempotent migration)
  const hasHighDemandSkills = db
    .prepare(`SELECT key FROM db_migrations WHERE key = 'high_demand_skills_v1'`)
    .get();
  if (!hasHighDemandSkills) {
    db.transaction(() => {
      db.prepare(`DELETE FROM skill_project_links`).run();
      db.prepare(`DELETE FROM skill_experience_links`).run();
      db.prepare(`DELETE FROM skills`).run();
      db.prepare(`DELETE FROM skill_categories`).run();

      const insertCat = db.prepare(`INSERT INTO skill_categories (name, slug, sort_order) VALUES (?, ?, ?)`);
      const insertSkill = db.prepare(
        `INSERT INTO skills (category_id, name, proficiency_label, is_published, is_verified, sort_order) VALUES (?, ?, 'Verified', 1, 1, ?)`
      );
      HIGH_DEMAND_SKILL_CATEGORIES.forEach((cat, idx) => {
        const catId = insertCat.run(cat.name, cat.slug, idx + 1).lastInsertRowid;
        cat.skills.forEach((skillName, sIdx) => {
          insertSkill.run(catId, skillName, sIdx + 1);
        });
      });

      db.prepare(`INSERT INTO db_migrations (key) VALUES ('high_demand_skills_v1')`).run();
      db.prepare(`DELETE FROM knowledge_chunks`).run();
    })();
  }

  // 0b. Upgrade placeholder LinkedIn URL to verified profile link
  const profLinkRow = db.prepare(`SELECT linkedin_url FROM profile_settings WHERE id = 1`).get() as
    | { linkedin_url?: string }
    | undefined;
  if (
    profLinkRow &&
    (!profLinkRow.linkedin_url ||
      profLinkRow.linkedin_url.trim() === 'https://www.linkedin.com' ||
      profLinkRow.linkedin_url.trim() === 'https://linkedin.com')
  ) {
    db.prepare(`UPDATE profile_settings SET linkedin_url = ?, updated_at = datetime('now') WHERE id = 1`).run(
      'https://www.linkedin.com/in/abdullah-naveed-8353492a1'
    );
    db.prepare(`DELETE FROM knowledge_chunks`).run();
  }

  // 1. Sync Groq env key if configured in AI Studio Secrets (`groq-api` or `GROQ_API_KEY`)
  const groqKey = getGroqEnvKey();
  if (groqKey) {
    const groqProv = db
      .prepare(`SELECT id, api_key_enc, last_status, is_active FROM ai_providers WHERE base_url LIKE '%groq.com%' LIMIT 1`)
      .get() as { id: number; api_key_enc: string; last_status: string; is_active: number } | undefined;
    if (groqProv) {
      if (groqProv.last_status === 'awaiting_api_key') {
        db.prepare(`UPDATE ai_providers SET last_status = 'configured', updated_at = datetime('now') WHERE id = ?`).run(groqProv.id);
      }
      // Prefer configured Groq secret when Gemini has no key or is not healthy, keeping Gemini as fallback
      const geminiProv = db
        .prepare(`SELECT id, api_key_enc, is_active, last_status FROM ai_providers WHERE provider_type = 'gemini' LIMIT 1`)
        .get() as { id: number; api_key_enc: string; is_active: number; last_status: string } | undefined;
      const anyOtherActive = db
        .prepare(`SELECT id FROM ai_providers WHERE is_active = 1 AND provider_type != 'gemini' LIMIT 1`)
        .get();
      const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim() || geminiProv?.api_key_enc);
      if (!anyOtherActive && (!hasGeminiKey || (geminiProv?.is_active === 1 && geminiProv?.last_status !== 'healthy'))) {
        db.transaction(() => {
          db.prepare(`UPDATE ai_providers SET is_active = 0, is_fallback = 1, updated_at = datetime('now') WHERE provider_type = 'gemini'`).run();
          db.prepare(
            `UPDATE ai_providers SET is_active = 1, is_fallback = 0, last_status = CASE WHEN last_status = 'healthy' THEN 'healthy' ELSE 'configured' END, updated_at = datetime('now') WHERE id = ?`
          ).run(groqProv.id);
        })();
      }
    }
  }

  // 2. Ensure verified project statuses, companion groups, and live_demo_verified flags
  const projectUpdates: Array<{ slug: string; status: string; liveVerified: number; companion: string; limitations: string }> = [
    {
      slug: 'omnisynth',
      status: 'Completed',
      liveVerified: 1,
      companion: '',
      limitations: 'Public frontend hosted on Vercel; full multi-agent FastAPI + FAISS backend requires Groq API and Postgres/Docker runtime.',
    },
    {
      slug: 'v-watch',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Designed for local or GPU server Docker Compose execution with RTSP/demo camera streams; no public hosted sandbox URL.',
    },
    {
      slug: 'scalable-rag-platform',
      status: 'Completed',
      liveVerified: 0,
      companion: 'rag-systems',
      limitations: 'Requires Docker Compose (PostgreSQL pgvector + Redis + Celery worker) for full asynchronous document indexing.',
    },
    {
      slug: '01-vanilla-rag',
      status: 'Completed',
      liveVerified: 0,
      companion: 'rag-systems',
      limitations: 'Intentionally uses in-process cosine vectors instead of external vector databases to keep every retrieval step inspectable.',
    },
    {
      slug: 'ai-ml-60-models',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Collection of 60 standalone training/evaluation modules for research and learning rather than a single hosted web service.',
    },
    {
      slug: 'legalai-assistant',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Educational AI legal drafting and Q&A tool requiring Hugging Face token; not a substitute for licensed legal counsel.',
    },
    {
      slug: 'mlops-engineering-lab',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Local MLOps reference pipeline (DVC, MLflow SQLite, Docker serving) without continuous cloud cluster deployment.',
    },
    {
      slug: 'zarafit-ai-tryon',
      status: 'Experimental',
      liveVerified: 0,
      companion: '',
      limitations: 'Depends on external Hugging Face Gradio IDM-VTON inference availability.',
    },
    {
      slug: 'luxewatch-ecommerce',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Configured for Docker Compose local/staging execution with Stripe test keys.',
    },
    {
      slug: 'scaleable-ai-api',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'API gateway framework requiring downstream LLM provider API keys.',
    },
    {
      slug: 'gymbro-fullstack',
      status: 'Completed',
      liveVerified: 0,
      companion: 'muscle-bros-series',
      limitations: 'Canonical FastAPI + Next.js 14 backend/frontend monorepo; superseded earlier prototypes (muscle-bros, bros-fullstack).',
    },
    {
      slug: 'ai-studio-multimodal',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Relies on third-party Hugging Face / Llama inference endpoints.',
    },
    {
      slug: 'linkedin-job-bot',
      status: 'Completed',
      liveVerified: 0,
      companion: 'linkedin-job-bot-series',
      limitations: 'Automated job search & CV matcher paired with companion output repo linkedin-job-bot-results.',
    },
    {
      slug: 'ml-pipeline-end-to-end',
      status: 'Completed',
      liveVerified: 0,
      companion: '',
      limitations: 'Interactive regression training workbench focused on tabular CSV datasets.',
    },
  ];
  const updProj = db.prepare(`UPDATE projects SET status = ?, live_demo_verified = ?, companion_group = ?, limitations = ? WHERE slug = ?`);
  for (const pu of projectUpdates) {
    updProj.run(pu.status, pu.liveVerified, pu.companion, pu.limitations, pu.slug);
  }

  // Add LMS-COMPLETE if not yet present in projects (has verified Vercel live demo + rich architecture docs)
  const existingLms = db.prepare(`SELECT id FROM projects WHERE slug = 'lms-complete'`).get();
  if (!existingLms) {
    db.prepare(`
      INSERT INTO projects (
        slug, title, category, tagline, overview, problem_statement, solution_summary,
        architecture_notes, frontend_stack, backend_stack, database_stack, ai_models_stack,
        rag_pipeline_notes, technologies_json, features_json, challenges_json, verified_results_json,
        cover_image, github_url, live_url, github_repo_name, is_featured, is_published, sort_order,
        status, live_demo_verified, companion_group, limitations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 15, 'Completed', 1, 'lms-series', ?)
    `).run(
      'lms-complete',
      'EduSphere / LMS-COMPLETE — Full-Stack Learning Management System',
      'Full-Stack Development',
      'Production-documented TypeScript Learning Management System with RBAC roles, course modules, and live Vercel deployment.',
      'A full-featured Learning Management System engineered with TypeScript, structured role-based access control, comprehensive architecture/security/load-test documentation, Docker support, and a live Vercel deployment.',
      'Academic and training institutions require structured multi-role workflows for administrators, instructors, and students with clear security boundaries.',
      'Implemented a modular TypeScript LMS architecture backed by documented PRD, RBAC manual, accessibility audit, and containerized deployment.',
      'TypeScript full-stack application with role-based permissions, Docker packaging, and Vercel deployment.',
      'TypeScript, React.js, Tailwind CSS',
      'Node.js, TypeScript, Authentication',
      'PostgreSQL / SQL Schema',
      '',
      '',
      JSON.stringify(['TypeScript', 'React.js', 'Tailwind CSS', 'Node.js', 'Authentication', 'Docker']),
      JSON.stringify([
        'Role-based access permissions across student, instructor, and admin tiers',
        'Documented architecture, security QA, and accessibility checklists',
        'Publicly deployed live Vercel preview',
      ]),
      JSON.stringify(['Designing clear permission boundaries across multi-role LMS modules']),
      JSON.stringify(['Live Vercel deployment and full architecture/security documentation verified in repository.']),
      '/src/assets/images/project_omnisynth_cover_1795329338795.jpg',
      'https://github.com/abdullah-v-cmd/LMS-COMPLETE',
      'https://lms-complete-iota.vercel.app',
      'LMS-COMPLETE',
      'Earlier draft LMS repos (edusphere-school-erp-lms, LMS-PORTAL, lms) are archived/unavailable; LMS-COMPLETE is the consolidated live release.'
    );
  }

  // 3. Keep GitHub repository status classifications honest & up-to-date
  const ghUpdates: Array<[string, string, string, string, string]> = [
    ['Omni-Advanced-Version-of-Research-Bot', 'Completed', '', 'OmniSynth - Enterprise AI Research & Productivity Platform', '9-agent research orchestration, FAISS RAG, Groq Llama-3-70B & Mixtral, FastAPI + Next.js, live Vercel frontend.'],
    ['vwatch-ai-traffic-violation-system', 'Completed', '', 'V-Watch: AI-Powered Smart Traffic Violation Detection and Centralized Management System', '24/7 CCTV AI traffic monitoring with YOLOv8, OpenCV, FastAPI, React, PostgreSQL, Docker Compose & self-healing RTSP watchdog.'],
    ['Rag-System-with-scalable-architecture', 'Completed', 'rag-systems', 'RAG Document Intelligence Platform with scalable pgvector, Redis, Celery & FastAPI architecture', 'Production-oriented multi-user RAG platform using FastAPI, React, PostgreSQL pgvector, Redis, and Celery async indexing.'],
    ['01-vanilla-rag', 'Completed', 'rag-systems', 'From-scratch Retrieval-Augmented Generation pipeline without LangChain or external vector DBs', 'Explicit ingestion, chunking, sentence embeddings, cosine vector search, and grounded LLM citations in Python.'],
    ['AI-ML-Engineering-Lab', 'Completed', '', '60 complete, self-contained AI & Machine Learning model implementations (Classical ML to GenAI)', 'Modular runnable implementations covering regression, ensembles, CNNs, RNNs, transformers, PyTorch, TensorFlow & scikit-learn.'],
    ['legalai-document-intelligence', 'Completed', '', 'LegalAI - AI-powered Legal Assistant with FastAPI, HuggingFace models, document generation & admin panel', 'Legal Q&A, paper/assignment/presentation generation, image/document analysis, and admin dashboard.'],
    ['mlops-engineering-platform', 'Completed', '', 'MLOps Engineering Lab - Reproducible model training, MLflow tracking, DVC & Docker API serving', 'End-to-end MLOps pipeline with experiment tracking, dataset versioning, evaluation, and containerized serving.'],
    ['zarafit-ai-tryon', 'Experimental', '', 'ZaraFit - AI Virtual Try-On Bot powered by IDM-VTON', 'Live camera/photo upload virtual garment fitting assistant using Hugging Face IDM-VTON inference.'],
    ['luxewatch-ecommerce', 'Completed', '', 'Premium Watch & Glasses eCommerce - Full Stack (FastAPI + Next.js + PostgreSQL + Redis + Stripe)', 'Full-stack e-commerce platform with SQLAlchemy/Alembic, Next.js 14, TailwindCSS, Redis caching, and Stripe checkout.'],
    ['Scaleable-Ai-api-system', 'Completed', '', 'Multi-Model AI Service Platform - Unified edge API gateway built with Hono & TypeScript', 'Unified multi-provider AI gateway built on Hono, TypeScript, and Cloudflare Workers.'],
    ['gymbro-fullstack-platform', 'Completed', 'muscle-bros-series', 'Muscle Bros - Full-Stack Membership, Subscriptions, AI Support & Admin Platform', 'Full-stack platform for a UK youth-empowerment gym & mentorship program with JWT auth, subscriptions, email automation & AI support.'],
    ['AI-Studio-Multi-Modal-AI-Content-Generation-Platform', 'Completed', '', 'AI Studio - Multi-Modal AI Content Generation Platform (Images, Audio & Text)', 'TypeScript platform supporting FLUX.1-schnell / SDXL image generation, multi-style presets, audio, and text workflows.'],
    ['linkedin-job-bot', 'Completed', 'linkedin-job-bot-series', 'LinkedIn Job Bot - Auto job search, CV matching, AI answers & GitHub sync', 'Automated LinkedIn job search, CV relevance matching, AI answer generation, and GitHub results syncing.'],
    ['ML-PipeLine-End-to-End', 'Completed', '', 'ML Pipeline - End-to-End Machine Learning workbench on Cloudflare Pages', 'Interactive web workbench for dataset upload, preprocessing, regression training, evaluation, and full ML lifecycle management.'],
    ['LMS-COMPLETE', 'Completed', 'lms-series', 'EduSphere / LMS-COMPLETE - Full-Stack TypeScript Learning Management System (Live on Vercel)', 'Production-documented TypeScript LMS with multi-role RBAC (student, instructor, admin), Docker support & live Vercel deployment.'],
    ['production-rag-document-intelligence', 'Experimental', 'rag-systems', 'RAG Chatbot with LangChain + FAISS retrieval pipeline', 'Foundational Python RAG chatbot loading documents, creating embeddings, indexing in FAISS, and answering with LLM context.'],
    ['Jarvis-Assistant', 'Experimental', '', 'Jarvis Assistant - Python Voice AI Assistant with Speech Recognition & TTS', 'Python personal voice assistant handling natural-language voice commands, text-to-speech responses, and desktop automation.'],
    ['multi_gan_ai', 'Experimental', '', 'Multi-GAN Multimodal AI Platform with FastAPI & PyTorch', 'Generative AI platform pairing a FastAPI backend, PyTorch GAN architectures, and a responsive frontend UI under MIT license.'],
    ['marketshield-ai', 'Incomplete', '', 'MarketShield AI - Empty placeholder repository (no source code pushed yet)', 'Reserved empty placeholder repository without implementation or README yet.'],
    ['bros-fullstack', 'Superseded / Companion', 'muscle-bros-series', 'Bros Full-Stack - Modern Full-Stack Web Platform companion/prototype', 'Companion full-stack prototype demonstrating responsive frontend, REST API, authentication, database workflows & Docker setup.'],
    ['muscle-bros', 'Superseded / Companion', 'muscle-bros-series', 'Muscle Bros UK - Charity Website ("Built in the Gym. Shaped for Life.")', 'Earlier UK charity website prototype for Muscle Bros UK youth mentorship, gym memberships, and supplement support (14-25).'],
    ['linkedin-job-bot-results', 'Companion Output Repo', 'linkedin-job-bot-series', 'LinkedIn Job Bot - Automated job tracking outputs (JSON & Markdown reports)', 'Companion results repository storing dated *_jobs.json and *_report.md job search outputs synced by linkedin-job-bot.'],
  ];
  const updGh = db.prepare(`
    UPDATE github_repos
    SET repo_status = ?,
        companion_group = ?,
        description = CASE WHEN description = '' OR description = 'gemini' THEN ? ELSE description END,
        readme_excerpt = CASE WHEN readme_excerpt = '' THEN ? ELSE readme_excerpt END
    WHERE name = ?
  `);
  for (const [name, st, grp, desc, excerpt] of ghUpdates) {
    updGh.run(st, grp, desc, excerpt, name);
  }
  const hasNewPortfolioGh = db.prepare(`SELECT id, readme_excerpt FROM github_repos WHERE name = 'neww-portfolio'`).get() as
    | { id: number; readme_excerpt?: string }
    | undefined;
  if (!hasNewPortfolioGh) {
    db.prepare(`
      INSERT INTO github_repos (name, full_name, description, readme_excerpt, language, html_url, approval_status, repo_status)
      VALUES ('neww-portfolio', 'abdullah-v-cmd/neww-portfolio', 'AI Engineer Portfolio Platform, Abdullah AI RAG Assistant & Admin CMS', 'React 19, TypeScript, Tailwind CSS v4, Three.js, Express + SQLite (better-sqlite3) full-stack portfolio and CMS.', 'TypeScript', 'https://github.com/abdullah-v-cmd/neww-portfolio', 'hidden', 'In Progress')
    `).run();
    db.prepare(`DELETE FROM knowledge_chunks`).run();
  } else if (!hasNewPortfolioGh.readme_excerpt) {
    db.prepare(`
      UPDATE github_repos
      SET description = 'AI Engineer Portfolio Platform, Abdullah AI RAG Assistant & Admin CMS',
          readme_excerpt = 'React 19, TypeScript, Tailwind CSS v4, Three.js, Express + SQLite (better-sqlite3) full-stack portfolio and CMS.'
      WHERE id = ?
    `).run(hasNewPortfolioGh.id);
    db.prepare(`DELETE FROM knowledge_chunks`).run();
  }

  // 4. Enrich published skills with detailed metadata + auto-link to verified projects & roles
  const allSkills = db.prepare(`SELECT * FROM skills`).all() as Array<any>;
  const allProjects = db.prepare(`SELECT id, title, technologies_json, overview, frontend_stack, backend_stack, database_stack, ai_models_stack FROM projects WHERE is_archived = 0`).all() as Array<any>;
  const allRoles = db.prepare(`SELECT id, title, description, responsibilities_json, skills_json FROM experience_roles`).all() as Array<any>;

  const updSkillMeta = db.prepare(`
    UPDATE skills
    SET description = CASE WHEN description = '' THEN ? ELSE description END,
        what_it_does = CASE WHEN what_it_does = '' THEN ? ELSE what_it_does END,
        how_abdullah_uses = CASE WHEN how_abdullah_uses = '' THEN ? ELSE how_abdullah_uses END,
        status = CASE WHEN status = '' THEN ? ELSE status END
    WHERE id = ?
  `);
  const insertProjLink = db.prepare(`INSERT OR IGNORE INTO skill_project_links (skill_id, project_id) VALUES (?, ?)`);
  const insertRoleLink = db.prepare(`INSERT OR IGNORE INTO skill_experience_links (skill_id, role_id) VALUES (?, ?)`);

  const linkCount = (db.prepare(`SELECT COUNT(*) as c FROM skill_project_links`).get() as { c: number }).c;

  for (const s of allSkills) {
    const q = s.name.toLowerCase();
    const searchTerms = [q, ...(SKILL_SEARCH_ALIASES[s.name] || [])];
    const matchedProjs = allProjects.filter((p) => {
      const techs = JSON.parse(p.technologies_json || '[]') as string[];
      const blob = `${p.overview} ${p.frontend_stack} ${p.backend_stack} ${p.database_stack} ${p.ai_models_stack}`.toLowerCase();
      return searchTerms.some(
        (term) =>
          techs.some((t) => t.toLowerCase() === term || t.toLowerCase().includes(term)) ||
          blob.includes(term)
      );
    });
    const matchedRoles = allRoles.filter((r) => {
      const rSkills = JSON.parse(r.skills_json || '[]') as string[];
      const rBlob = `${r.description} ${r.responsibilities_json}`.toLowerCase();
      return searchTerms.some(
        (term) =>
          rSkills.some((rs) => rs.toLowerCase() === term || rs.toLowerCase().includes(term)) ||
          rBlob.includes(term)
      );
    });

    if (linkCount === 0) {
      for (const mp of matchedProjs) insertProjLink.run(s.id, mp.id);
      for (const mr of matchedRoles) insertRoleLink.run(s.id, mr.id);
    }

    const customMeta = SKILL_PROFILES[s.name];
    const derivedStatus =
      matchedRoles.length > 0
        ? 'Professional Experience'
        : matchedProjs.length > 0
        ? 'Used in Projects'
        : 'Verified Stack';

    const desc =
      customMeta?.description ||
      `${s.name} — technical capability verified across Abdullah Naveed's ${matchedProjs.length ? 'engineering repositories' : 'skill stack'}.`;
    const whatItDoes =
      customMeta?.whatItDoes ||
      `Supports structured implementation, testing, and system architecture in ${s.name}-based workflows.`;
    const howUsed =
      customMeta?.howUsed ||
      (matchedProjs.length > 0
        ? `Applied in ${matchedProjs.slice(0, 3).map((p) => p.title.split('—')[0].trim()).join(', ')}.`
        : matchedRoles.length > 0
        ? `Applied during verified engineering work (${matchedRoles.map((r) => r.title).join(', ')}).`
        : 'Listed in Abdullah Naveed’s verified engineering skill universe.');

    updSkillMeta.run(desc, whatItDoes, howUsed, derivedStatus, s.id);
  }

  // 5. Add industry review queue candidates (unpublished until Admin reviews & approves)
  const devopsCat = db.prepare(`SELECT id FROM skill_categories WHERE slug = 'devops'`).get() as { id: number } | undefined;
  const aiCat = db.prepare(`SELECT id FROM skill_categories WHERE slug = 'ai-ml'`).get() as { id: number } | undefined;
  const genaiCat = db.prepare(`SELECT id FROM skill_categories WHERE slug = 'genai-llm'`).get() as { id: number } | undefined;

  const industryCandidates: Array<{ catId: number | undefined; name: string; desc: string; what: string; how: string; isVerified: number }> = [
    { catId: aiCat?.id, name: 'PyTorch', desc: 'Deep learning tensor & neural network framework.', what: 'Builds and trains custom neural architectures with dynamic computation graphs.', how: 'Detected in AI-ML-Engineering-Lab neural implementations (awaiting Admin review to publish).', isVerified: 0 },
    { catId: aiCat?.id, name: 'TensorFlow', desc: 'End-to-end open-source machine learning platform.', what: 'Trains and exports deep neural networks and sequence models.', how: 'Detected in AI-ML-Engineering-Lab implementations (awaiting Admin review to publish).', isVerified: 0 },
    { catId: aiCat?.id, name: 'scikit-learn', desc: 'Classical machine learning library for Python.', what: 'Provides regression, classification, clustering, and preprocessing pipelines.', how: 'Detected in AI-ML-Engineering-Lab & mlops-engineering-platform (awaiting Admin review).', isVerified: 0 },
    { catId: genaiCat?.id, name: 'LangGraph', desc: 'Stateful multi-actor agent orchestration graph library.', what: 'Coordinates cyclical tool-calling and multi-agent LLM workflows.', how: 'Detected in OmniSynth 9-agent orchestration stack (awaiting Admin review).', isVerified: 0 },
    { catId: genaiCat?.id, name: 'FAISS', desc: 'Facebook AI Similarity Search vector indexing engine.', what: 'Performs high-speed dense vector nearest-neighbor retrieval in memory or disk.', how: 'Detected in OmniSynth & production-rag-document-intelligence (awaiting Admin review).', isVerified: 0 },
    { catId: devopsCat?.id, name: 'MLflow', desc: 'Open-source platform for ML lifecycle & experiment tracking.', what: 'Logs parameters, metrics, artifacts, and model versions cleanly.', how: 'Detected in mlops-engineering-platform (awaiting Admin review).', isVerified: 0 },
    { catId: devopsCat?.id, name: 'DVC', desc: 'Data Version Control for ML datasets and reproducible pipelines.', what: 'Tracks large datasets and pipeline stages alongside Git.', how: 'Detected in mlops-engineering-platform (awaiting Admin review).', isVerified: 0 },
    { catId: devopsCat?.id, name: 'Kubernetes', desc: 'Container orchestration platform for automated scaling.', what: 'Manages multi-node container scheduling and rolling deployments.', how: 'Industry benchmark candidate — not yet verified in public repos (Admin Review Required).', isVerified: 0 },
  ];

  const existsSkill = db.prepare(`SELECT id FROM skills WHERE lower(name) = lower(?)`);
  const insertCandidate = db.prepare(`
    INSERT INTO skills (category_id, name, proficiency_label, description, what_it_does, how_abdullah_uses, status, is_published, is_verified, sort_order)
    VALUES (?, ?, 'Candidate', ?, ?, ?, 'Admin Review Required', 0, ?, 99)
  `);
  for (const cand of industryCandidates) {
    if (cand.catId && !existsSkill.get(cand.name)) {
      insertCandidate.run(cand.catId, cand.name, cand.desc, cand.what, cand.how, cand.isVerified);
    }
  }
}

