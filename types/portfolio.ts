export interface SocialLink {
  platform: 'github' | 'linkedin' | 'email' | 'phone';
  label: string;
  url: string;
  username: string;
}

export interface StatItem {
  label: string;
  value: number;
  suffix: string;
  description: string;
}

export interface SkillItem {
  name: string;
  icon?: string;
  highlighted?: boolean;
}

export interface SkillCategory {
  id: string;
  category: string;
  description: string;
  skills: SkillItem[];
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  current?: boolean;
  description: string[];
  technologies: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  slug: string;
  category: 'AI & Computer Vision' | 'Machine Learning' | 'Data Analytics & Viz';
  summary: string;
  description: string;
  image: string;
  tags: string[];
  githubUrl: string;
  demoUrl: string;
  liveDemoUrl?: string;
  featured: boolean;
  highlights: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  location: string;
  period: string;
  gpa: string;
  details: string[];
}

export interface CertificationItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  credentialUrl?: string;
  skillsLearned: string[];
}

export interface NavItem {
  label: string;
  href: string;
}

export interface Profile {
  name: string;
  headline: string;
  roles: string[];
  location: string;
  email: string;
  phone: string;
  statusBadge: string;
  summary: string;
  aboutParagraphs: string[];
  cvUrl: string;
  profileImage: string;
  formspreeEndpoint: string;
}

export interface PortfolioData {
  profile: Profile;
  socialLinks: SocialLink[];
  stats: StatItem[];
  skills: SkillCategory[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  navItems: NavItem[];
  adminPasscode: string;
}
