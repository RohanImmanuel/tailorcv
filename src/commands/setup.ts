import { password, confirm, select, input } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { readFileSync, writeFileSync, existsSync } from "fs";
import OpenAI from "openai";
import { runOAuthFlow, getAuthenticatedClient } from "../core/googleAuth.js";
import { getOrCreateFolder, createTemplateDoc, getDrive } from "../core/googleDrive.js";
import { loadConfig, updateConfig } from "../core/config.js";
import { PATHS } from "../core/paths.js";

const ENV_PATH = PATHS.env;

// ─── .env helpers ────────────────────────────────────────────────────────────

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    readFileSync(ENV_PATH, "utf-8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const [k, ...v] = l.split("=");
        return [k.trim(), v.join("=").trim()];
      })
  );
}

function setEnvVar(key: string, value: string): void {
  const env = readEnv();
  env[key] = value;
  writeFileSync(
    ENV_PATH,
    Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n"
  );
}

// ─── ui ──────────────────────────────────────────────────────────────────────

const w = () => process.stdout.columns || 80;

const panel = (content: string, title: string) =>
  console.log(boxen(content, {
    title: chalk.cyan(title),
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "cyan",
    width: w(),
  }));

const success = (msg: string) => console.log(chalk.green(`✓ ${msg}`));
const step    = (n: number, msg: string) => console.log(`\n${chalk.cyan(`[${n}]`)} ${chalk.bold(msg)}`);

// ─── openai ──────────────────────────────────────────────────────────────────

async function setupOpenAI(): Promise<void> {
  step(1, "OpenAI API key");

  const existing = process.env.OPENAI_API_KEY || readEnv()["OPENAI_API_KEY"];

  if (existing) {
    console.log(`Key already set: ${chalk.cyan(`sk-...${existing.slice(-4)}`)}`);
    const overwrite = await confirm({ message: "Replace it?", default: false });
    if (!overwrite) return;
  }

  const key = await password({
    message: "Paste your OpenAI API key",
    mask: "•",
    validate: (v) => v.startsWith("sk-") ? true : "Key should start with sk-",
  });

  const spinner = ora({ text: "Testing connection…", color: "cyan" }).start();
  try {
    await new OpenAI({ apiKey: key }).models.list();
    spinner.succeed("Connected");
    setEnvVar("OPENAI_API_KEY", key);
    success("OpenAI key saved");
  } catch {
    spinner.fail(chalk.red("Connection failed — key may be invalid"));
    throw new Error("OpenAI setup failed");
  }
}

// ─── google ───────────────────────────────────────────────────────────────────

async function checkTemplateDocExists(auth: Awaited<ReturnType<typeof getAuthenticatedClient>>, docId: string): Promise<boolean> {
  if (!auth) return false;
  try {
    const drive = getDrive(auth);
    await drive.files.get({ fileId: docId, fields: "id,trashed" });
    return true;
  } catch {
    return false;
  }
}

async function setupGoogle(): Promise<void> {
  step(2, "Google Drive");

  const config = loadConfig();
  const auth   = await getAuthenticatedClient();

  // check if already connected and template doc still exists
  if (auth && config.google_folder_id && config.google_template_doc_id) {
    const docExists = await checkTemplateDocExists(auth, config.google_template_doc_id);
    if (docExists) {
      console.log(`Already connected  ${chalk.dim("folder and template doc exist")}`);
      const redo = await confirm({ message: "Reconnect Google?", default: false });
      if (!redo) return;
    } else {
      console.log(chalk.yellow("⚠ Template doc was deleted from Drive — recreating it…"));
      const newDocId = await createTemplateDoc(auth, config.google_folder_id);
      updateConfig({ google_template_doc_id: newDocId });
      console.log(chalk.green("✓ Template recreated"));
      console.log(chalk.dim("Open and format it:"));
      console.log(chalk.cyan(`https://docs.google.com/document/d/${newDocId}/edit`));
      return;
    }
  }

  // if credentials aren't baked in, ask for them
  const needsCreds = !process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === "YOUR_CLIENT_ID";
  if (needsCreds) {
    console.log(chalk.dim("\nYou need Google OAuth credentials. Get them at:"));
    console.log(chalk.cyan("https://console.cloud.google.com/"));
    console.log(chalk.dim("New project → Enable Drive API + Docs API → OAuth consent screen → Credentials → Desktop app\n"));

    const clientId = await input({
      message: "Paste your Google Client ID",
      validate: (v) => v.includes(".apps.googleusercontent.com") ? true : "Should end in .apps.googleusercontent.com",
    });

    const clientSecret = await input({
      message: "Paste your Google Client Secret",
      validate: (v) => v.length > 0 ? true : "Required",
    });

    setEnvVar("GOOGLE_CLIENT_ID", clientId);
    setEnvVar("GOOGLE_CLIENT_SECRET", clientSecret);

    // reload env so googleAuth picks them up
    process.env.GOOGLE_CLIENT_ID     = clientId;
    process.env.GOOGLE_CLIENT_SECRET = clientSecret;
  }

  // run OAuth
  const oauthSpinner = ora({ text: "Opening browser for Google authorisation…", color: "cyan" }).start();
  try {
    await runOAuthFlow();
    oauthSpinner.succeed("Google account connected");
  } catch {
    oauthSpinner.fail(chalk.red("Google auth failed"));
    throw new Error("Google setup failed");
  }

  const freshAuth = await getAuthenticatedClient();
  if (!freshAuth) throw new Error("Auth missing after OAuth");

  const folderSpinner = ora("Setting up ResumeTailor folder…").start();
  const folderId = await getOrCreateFolder(freshAuth, "ResumeTailor");
  folderSpinner.succeed(`Folder ready`);

  const docSpinner = ora("Creating template doc…").start();
  const templateDocId = await createTemplateDoc(freshAuth, folderId);
  docSpinner.succeed("Template doc created");

  updateConfig({ google_folder_id: folderId, google_template_doc_id: templateDocId });

  success("Google Drive connected");
  console.log(chalk.dim("\nOpen your template doc, format it to your liking, keep the placeholders:"));
  console.log(chalk.cyan(`https://docs.google.com/document/d/${templateDocId}/edit\n`));
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  panel(chalk.bold("Setup"), "Setup");

  const config = loadConfig();
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || readEnv()["OPENAI_API_KEY"]);
  const hasGoogle = !!(config.google_folder_id && config.google_template_doc_id);

  // first run — show status
  if (!hasOpenAI || !hasGoogle) {
    const lines = [
      `OpenAI key   ${hasOpenAI ? chalk.green("✓ set") : chalk.yellow("not set")}`,
      `Google Drive ${hasGoogle ? chalk.green("✓ connected") : chalk.yellow("not connected")}`,
    ];
    panel(lines.join("\n"), "Status");
  }

  const choices = [
    { value: "all",    name: "Everything (OpenAI + Google Drive)" },
    { value: "openai", name: "OpenAI API key only" },
    { value: "google", name: "Google Drive only" },
  ];

  const choice = await select({ message: "What would you like to set up?", choices });

  try {
    if (choice === "all" || choice === "openai") await setupOpenAI();
    if (choice === "all" || choice === "google") await setupGoogle();
    console.log(chalk.green("\n✓ Done."));
    if (!hasOpenAI || !hasGoogle) {
      console.log(chalk.dim("Next: fill your profile with ") + chalk.cyan("tailorcv profile"));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`\nSetup stopped: ${msg}`));
  }
}
