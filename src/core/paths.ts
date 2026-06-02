import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = join(homedir(), ".config", "resume-tailor");

// ensure the directory exists on first import
mkdirSync(DATA_DIR, { recursive: true });

export const PATHS = {
  dir:         DATA_DIR,
  env:         join(DATA_DIR, ".env"),
  config:      join(DATA_DIR, "config.json"),
  profile:     join(DATA_DIR, "profile.json"),
  generations: join(DATA_DIR, "generations.json"),
};
