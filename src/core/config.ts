import { readFileSync, writeFileSync, existsSync } from "fs";
import { PATHS } from "./paths.js";

const CONFIG_PATH = PATHS.config;

export interface Config {
  openai_key_set?: boolean;
  google_folder_id?: string;
  google_template_doc_id?: string;
  google_token?: GoogleToken;
}

export interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Config;
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function updateConfig(partial: Partial<Config>): Config {
  const config = loadConfig();
  const updated = { ...config, ...partial };
  saveConfig(updated);
  return updated;
}
