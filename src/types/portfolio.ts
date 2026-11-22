export type ProfileMode = 'recruiter' | 'ai_ml' | 'developer' | 'explore';

export interface ProfileSettings {
  id: number;
  full_name: string;
  headline: string;
  subheadline: string;
  bio_short: string;
  bio_long: string;
  about_what_i_build: string;
  about_problem_solving: string;
  about_career_goals: string;
  location: string;
  email: string;
  github_url: string;
  linkedin_url: string;
  availability_enabled: number;
  availability_label: string;
  avatar_url: string;
  cover_url: string;
  resume_url: string;
  resume_filename: string;
  resume_downloads: number;
}

export interface ThemeSettings {
  accent_color: string;
  secondary_accent: string;
  intro_enabled: number;
  profile_selector_enabled: number;
  three_d_enabled: number;
  animation_intensity: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  section_order: string[];
  hidden_sections: string[];
  seo_title: string;
  seo_description: string;
}

export interface ExperienceRole {
  id: number;
  company_id: number;
  title: string;
  employment_type: string;
  start_date: string;
  end_date: string;
  is_current: number;
  description: string;
  responsibilities: string[];
  skills: string[];
  evidence_note: string;
  is_public: number;
  sort_order: number;
}

export interface CompanyExperience {
  id: number;
  name: string;
  location: string;
  arrangement: string;
  overall_dates: string;
  description: string;
  website_url: string;
  sort_order: number;
  is_public: number;
  is_archived: number;
  roles: ExperienceRole[];
}

export interface EducationEntry {
  id: number;
  institution: string;
  degree: string;
  field: string;
  student_name: string;
  start_date: string;
  end_date: string;
  details: string;
  is_public: number;
}

export interface SkillItem {
  id: number;
  category_id: number;
  name: string;
  proficiency_label: string;
  is_published: number;
  sort_order: number;
}

export interface SkillCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  skills: SkillItem[];
}

export interface ProjectItem {
  id: number;
  slug: string;
  title: string;
  category: string;
  tagline: string;
  overview: string;
  problem_statement: string;
  solution_summary: string;
  architecture_notes: string;
  frontend_stack: string;
  backend_stack: string;
  database_stack: string;
  ai_models_stack: string;
  rag_pipeline_notes: string;
  technologies: string[];
  features: string[];
  challenges: string[];
  verified_results: string[];
  cover_image: string;
  screenshots: string[];
  github_url: string;
  live_url: string;
  github_repo_name: string;
  company_id: number | null;
  is_featured: number;
  is_published: number;
  is_archived: number;
  sort_order: number;
}

export interface CertificateItem {
  id: number;
  title: string;
  issuer: string;
  issue_date: string;
  expiry_date: string;
  credential_id: string;
  verify_url: string;
  file_url: string;
  file_type: 'pdf' | 'image';
  description: string;
  skills: string[];
  is_featured: number;
  is_public: number;
  is_archived: number;
}

export interface PortfolioPayload {
  profile: ProfileSettings;
  theme: ThemeSettings;
  experience: CompanyExperience[];
  education: EducationEntry[];
  skillUniverse: SkillCategory[];
  projects: ProjectItem[];
  certificates: CertificateItem[];
}
