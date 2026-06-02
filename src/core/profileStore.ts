import { readFileSync, writeFileSync, existsSync } from "fs";
import { PATHS } from "./paths.js";
import type { Profile } from "./types.js";

const PROFILE_PATH = PATHS.profile;

const DEFAULT_PROFILE: Profile = {
  contact: {
    full_name: "", email: "", phone: "", location: "",
    linkedin: "", github: "", portfolio: "", work_authorization: "",
  },
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
};

export function load(): Profile {
  if (!existsSync(PROFILE_PATH)) return DEFAULT_PROFILE;
  return JSON.parse(readFileSync(PROFILE_PATH, "utf-8")) as Profile;
}

export function save(profile: Profile): void {
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
}
