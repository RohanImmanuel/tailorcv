import { input } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { load as loadProfile } from "../core/profileStore.js";
import { generateResume, type GeneratedResume } from "../core/ai.js";
import { loadConfig } from "../core/config.js";
import { getAuthenticatedClient } from "../core/googleAuth.js";
import { copyAndFill } from "../core/googleDrive.js";

// ─── ui helpers ──────────────────────────────────────────────────────────────

const w = () => process.stdout.columns || 80;

const panel = (content: string, title: string, color: "cyan" | "green" | "yellow" = "cyan") =>
  console.log(boxen(content, {
    title: chalk[color](title),
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: color,
    width: w(),
  }));

const label  = (s: string) => chalk.cyan(s.padEnd(14));
const bullet = (s: string) => `  ${chalk.dim("•")} ${s}`;
const h      = (s: string) => chalk.bold.underline(s);

// ─── resume renderer ─────────────────────────────────────────────────────────

function renderResume(resume: GeneratedResume, company: string, role: string): void {
  const lines: string[] = [];

  lines.push(chalk.bold(resume.headline));
  lines.push("");
  lines.push(h("Profile"));
  for (const p of resume.summary) lines.push(bullet(p));

  if (resume.skills.length) {
    lines.push("");
    lines.push(h("Technical Skills"));
    for (const g of resume.skills) {
      lines.push(`${chalk.cyan(g.category + ":")} ${g.items.join(" · ")}`);
    }
  }

  if (resume.experience.length) {
    lines.push("");
    lines.push(h("Experience"));
    for (const exp of resume.experience) {
      lines.push(`${chalk.bold(exp.company)} — ${exp.title}`);
      for (const b of exp.bullets) lines.push(bullet(b));
    }
  }

  if (resume.projects.length) {
    lines.push("");
    lines.push(h("Projects"));
    for (const p of resume.projects) {
      lines.push(`${chalk.bold(p.name)}  ${chalk.dim(p.tech.join(", "))}`);
      for (const b of p.bullets) lines.push(bullet(b));
    }
  }

  panel(lines.join("\n"), `${company} — ${role}`, "green");
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  panel(chalk.bold("Generate a tailored resume"), "Generate");

  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.yellow("⚠ No OpenAI key found. Run ") + chalk.cyan("tailorcv setup") + chalk.yellow(" first."));
    return;
  }

  const profile = loadProfile();
  const hasData = profile.experience.length || profile.skills.length || profile.education.length;
  if (!hasData) {
    console.log(chalk.yellow("⚠ Profile is empty. Run ") + chalk.cyan("tailorcv profile") + chalk.yellow(" first."));
    return;
  }

  const company = await input({ message: "Company name" });
  const role    = await input({ message: "Role title" });

  console.log(chalk.dim("\nPaste the job description below, then press Enter twice to continue.\n"));

  const lines: string[] = [];
  let blankCount = 0;
  const rl = (await import("readline")).createInterface({ input: process.stdin });
  await new Promise<void>((resolve) => {
    rl.on("line", (line) => {
      if (line === "") {
        blankCount++;
        if (blankCount >= 2) { rl.close(); resolve(); return; }
      } else {
        blankCount = 0;
      }
      lines.push(line);
    });
    rl.on("close", resolve);
  });
  const jd = lines.join("\n").trim();

  if (!jd) {
    console.log(chalk.yellow("No job description provided. Aborting."));
    return;
  }

  // ── AI generation ──────────────────────────────────────────────────────────

  const aiSpinner = ora({ text: "Generating resume with GPT-5.5…", color: "cyan" }).start();

  let resume: GeneratedResume;
  try {
    resume = await generateResume(profile, company, role, jd);
    aiSpinner.succeed(chalk.green("Resume generated"));
  } catch (err) {
    aiSpinner.fail(chalk.red("AI generation failed"));
    console.log(chalk.red(err instanceof Error ? err.message : String(err)));
    return;
  }

  renderResume(resume, company, role);

  // ── Google Doc creation ────────────────────────────────────────────────────

  const config = loadConfig();

  if (config.google_folder_id && config.google_template_doc_id) {
    const auth = await getAuthenticatedClient();

    if (auth) {
      const docSpinner = ora({ text: "Creating Google Doc…", color: "cyan" }).start();
      try {
        const docName = `${company} - ${role} - Resume`;

        const { url } = await copyAndFill(
          auth,
          config.google_template_doc_id,
          config.google_folder_id,
          docName,
          profile,
          resume
        );

        docSpinner.succeed(chalk.green("Google Doc created"));
        console.log(`\n${chalk.bold("Open your resume:")} ${chalk.cyan(url)}\n`);
        return;

      } catch (err) {
        docSpinner.fail(chalk.red("Google Doc creation failed"));
        console.log(chalk.dim(err instanceof Error ? err.message : String(err)));
      }
    }
  } else {
    console.log(chalk.dim("\nTip: run ") + chalk.cyan("tailorcv setup") + chalk.dim(" to connect Google Drive and get a formatted doc."));
  }
}
