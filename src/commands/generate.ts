import { input, editor } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { load as loadProfile } from "../core/profileStore.js";
import { generateResume, type GeneratedResume } from "../core/ai.js";
import { loadConfig } from "../core/config.js";
import { getAuthenticatedClient } from "../core/googleAuth.js";
import { copyAndFill } from "../core/googleDrive.js";
import {
  cols, startAiSpinner, startDocSpinner,
  heroHeadline, fitSummary, revealUrl, errorBox,
} from "../core/ui.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

const bullet = (s: string) => `  ${chalk.dim("•")} ${s}`;
const h      = (s: string) => chalk.bold.underline(s);
const panel  = (content: string, title: string, color: "cyan" | "green" | "yellow" = "cyan") =>
  console.log(boxen(content, {
    title: chalk[color](title),
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: color,
    width: cols(),
  }));

// ─── resume renderer ─────────────────────────────────────────────────────────

async function renderResume(resume: GeneratedResume, company: string, role: string): Promise<void> {
  await heroHeadline(resume.headline);

  const totalBullets = resume.experience.reduce((n, e) => n + e.bullets.length, 0)
                     + resume.projects.reduce((n, p)   => n + p.bullets.length, 0);
  await fitSummary(resume.experience.length, resume.projects.length, resume.skills.length, totalBullets);

  const lines: string[] = [];

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
      lines.push(`${chalk.bold(p.name)}  ${chalk.dim(p.tech.join(" · "))}`);
      for (const b of p.bullets) lines.push(bullet(b));
    }
  }

  console.log();
  panel(lines.join("\n"), `${company} — ${role}`, "green");
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  panel(chalk.bold("Generate a tailored resume"), "TailorCV");

  if (!process.env.OPENAI_API_KEY) {
    await errorBox("No OpenAI key found", "Run tailorcv setup first.");
    return;
  }

  const profile = loadProfile();
  const hasData = profile.experience.length || profile.skills.length || profile.education.length;
  if (!hasData) {
    await errorBox("Profile is empty", "Run tailorcv profile first.");
    return;
  }

  const company = await input({ message: "Company name" });
  const role    = await input({ message: "Role title" });

  console.log(chalk.dim("\nYour editor will open — paste the job description, save, and quit.\n"));

  const jd = (await editor({
    message: "Job description",
    postfix: ".txt",
  })).trim();

  if (!jd) {
    await errorBox("No job description", "Nothing was saved. Aborting.");
    return;
  }

  // ── AI generation ──────────────────────────────────────────────────────────

  const aiHandle = startAiSpinner(ora);
  let resume: GeneratedResume;
  try {
    resume = await generateResume(profile, company, role, jd);
    aiHandle.stop(true, "Resume generated");
  } catch (err) {
    aiHandle.stop(false, "AI generation failed");
    await errorBox("Generation failed", err instanceof Error ? err.message : String(err));
    return;
  }

  await renderResume(resume, company, role);

  // ── Google Doc creation ────────────────────────────────────────────────────

  const config = loadConfig();

  if (config.google_folder_id && config.google_template_doc_id) {
    const auth = await getAuthenticatedClient();

    if (auth) {
      const docHandle = startDocSpinner(ora);
      try {
        const { url } = await copyAndFill(
          auth,
          config.google_template_doc_id,
          config.google_folder_id,
          `${company} - ${role} - Resume`,
          profile,
          resume
        );
        docHandle.stop(true, "Google Doc ready");
        await revealUrl(url);
        return;
      } catch (err) {
        docHandle.stop(false, "Google Doc creation failed");
        await errorBox("Doc creation failed", err instanceof Error ? err.message : String(err));
      }
    }
  } else {
    console.log(
      chalk.dim("\nTip: run ") +
      chalk.cyan("tailorcv setup") +
      chalk.dim(" to connect Google Drive and get a formatted doc.")
    );
  }
}
