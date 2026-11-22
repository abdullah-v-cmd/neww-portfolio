# Abdullah Naveed — AI Engineer Portfolio, AI Recruiter & Admin CMS

## Architecture
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Three.js (ambient WebGL hero with software-GL & reduced-motion guards), GSAP, Lenis, Motion, Recharts.
- **Backend**: Express + TypeScript (`server.ts`, `/server/*`) with SQLite (`better-sqlite3`, WAL mode, 22 normalized tables in `data/portfolio.db`).
- **AI Recruiter (`Abdullah AI`)**: Semantic vector + lexical RAG over `knowledge_documents` (strict `public` vs `private` scope isolation, prompt-injection delimiters, grounded citation links) with runtime-switchable LLM providers (`@google/genai` server-side Gemini default + SSRF-validated OpenAI-compatible/Groq providers).
- **Security**:
  - `scrypt` password hashing + `timingSafeEqual`
  - AES-256-GCM encrypted API keys, SMTP passwords, TOTP MFA secrets, and inbound webhook secrets
  - One-time first-run Owner Bootstrap (`/secure-admin`) or `ADMIN_BOOTSTRAP_PASSCODE` env override (no default passwords shipped)
  - Memory-held session bearer tokens, login throttling, progressive lockout, audit logging, and magic-byte file upload validation

## Environment Variables
See `.env.example`:
- `GEMINI_API_KEY`: Server-side Gemini API key (configured via Secrets panel)
- `APP_URL`: Hosted application URL
- `ADMIN_BOOTSTRAP_PASSCODE` / `ADMIN_BOOTSTRAP_EMAIL` (optional): Pre-provisioned owner login override
- `ENCRYPTION_MASTER_KEY` (optional): Key for encrypting stored provider/SMTP secrets
- `GITHUB_TOKEN` (optional): Increases GitHub API sync rate limit

## Local Development & Build
- Install dependencies: `npm install`
- Development server (port 3000): `npm run dev`
- Type check: `npm run lint`
- Production build: `npm run build`
- Start production server: `npm start`
