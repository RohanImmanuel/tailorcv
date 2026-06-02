export interface Contact {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  work_authorization: string;
}

export interface Entry {
  [key: string]: string | string[];
}

export interface Experience extends Entry {
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string[];
}

export interface Project extends Entry {
  name: string;
  url: string;
  tech: string[];
  bullets: string[];
}

export interface Education extends Entry {
  institution: string;
  degree: string;
  field: string;
  graduation: string;
  gpa: string;
}

export interface Certification extends Entry {
  name: string;
  issuer: string;
  date: string;
  url: string;
}

export interface Profile {
  contact: Contact;
  skills: string[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
}
