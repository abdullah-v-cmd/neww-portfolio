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

export interface ProfileBackgroundOverride {
  bg_mode?: 'default' | 'gradient' | 'image' | 'video';
  bg_video_url?: string;
  bg_mobile_video_url?: string;
  bg_poster_url?: string;
  bg_image_url?: string;
  bg_gradient_css?: string;
  bg_overlay_opacity?: number;
}

export interface HeroMontageSlide {
  projectSlug?: string;
  title: string;
  subtitle?: string;
  category?: string;
  imageUrl: string;
  videoUrl?: string;
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
  bg_mode?: 'default' | 'gradient' | 'image' | 'video';
  bg_video_url?: string;
  bg_mobile_video_url?: string;
  bg_poster_url?: string;
  bg_image_url?: string;
  bg_gradient_css?: string;
  bg_overlay_opacity?: number;
  profile_backgrounds?: Partial<Record<ProfileMode, ProfileBackgroundOverride>>;
  rag_top_k?: number;
  rag_chunk_size?: number;
  rag_hybrid_weight?: number;
  dvd_transition_enabled?: number;
  video_autoplay_preview?: number;
  hero_montage_enabled?: number;
  hero_montage?: HeroMontageSlide[];
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
  description?: string;
  what_it_does?: string;
  how_abdullah_uses?: string;
  status?: string;
  icon_key?: string;
  is_verified?: number;
  is_published: number;
  sort_order: number;
  linked_project_ids?: number[];
  linked_role_ids?: number[];
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
  preview_video_url?: string;
  video_description?: string;
  screenshots: string[];
  github_url: string;
  live_url: string;
  github_repo_name: string;
  company_id: number | null;
  is_featured: number;
  is_published: number;
  is_archived: number;
  sort_order: number;
  status?: string;
  limitations?: string;
  companion_group?: string;
  live_demo_verified?: number;
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

export interface ResumeVersionItem {
  id: number;
  version_name: string;
  description: string;
  filename: string;
  file_url: string;
  file_size: number;
  scope: 'public' | 'recruiter';
  is_active: number;
  is_default: number;
  is_archived: number;
  created_at: string;
}

export interface CvDeliveryLogItem {
  id: number;
  request_id: number;
  resume_version_id: number | null;
  custom_attachment_name: string;
  recipient_email: string;
  subject: string;
  email_body: string;
  sent_by_admin: string;
  attempt_number: number;
  delivery_status: string;
  error_message: string;
  message_id: string;
  download_token: string;
  created_at: string;
}

export interface CvRequestItem {
  id: number;
  request_uid: string;
  full_name: string;
  company: string;
  email: string;
  job_title: string;
  message: string;
  status: 'New Request' | 'Under Review' | 'Approved' | 'CV Sent' | 'Rejected' | 'Closed';
  delivery_status: string;
  internal_notes: string;
  created_at: string;
  updated_at: string;
  delivery_logs: CvDeliveryLogItem[];
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
