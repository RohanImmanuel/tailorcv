import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import {
  cols, startAiSpinner, startDocSpinner,
  heroHeadline, fitSummary, revealUrl, errorBox,
} from "../core/ui.js";
import type { GeneratedResume } from "../core/ai.js";

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_RESUME: GeneratedResume = {
  headline: "Software Engineer · TypeScript · REST APIs",

  summary: [
    "3+ years building and shipping backend services, REST APIs, and automation tooling across product and SaaS environments.",
    "Experienced in end-to-end test automation, CI/CD integration, and developer tooling for cross-platform coverage.",
    "Proven ability to debug complex distributed systems and deliver reliable, well-tested features at pace.",
  ],

  skills: [
    { category: "Languages",      items: ["TypeScript", "Python", "JavaScript", "Go"] },
    { category: "Backend & APIs", items: ["REST", "Node.js", "Express", "Zod"] },
    { category: "Cloud & DevOps", items: ["AWS", "Docker", "GitHub Actions", "CI/CD"] },
    { category: "Databases",      items: ["MongoDB", "PostgreSQL"] },
  ],

  experience: [
    {
      company: "Horizon Tech",
      title:   "Software Engineer",
      bullets: [
        "Built and maintained REST APIs powering core product features, improving response time by 35% through query optimisation.",
        "Developed an automated test suite covering 80% of critical API endpoints, integrated into CI pipelines.",
        "Debugged and resolved cross-browser and cross-platform issues across web and mobile surfaces.",
        "Collaborated with product and design to ship three major features on time across a two-month release cycle.",
      ],
    },
    {
      company: "Vertex Systems",
      title:   "Backend Engineer",
      bullets: [
        "Designed and shipped a webhook delivery service handling 50k+ events per day with retry logic and dead-letter queuing.",
        "Migrated a monolithic data pipeline to event-driven microservices, reducing processing latency by 60%.",
        "Authored internal SDK used by four teams to integrate with the platform's REST API.",
        "Led incident response for two P1 outages, writing post-mortems and implementing preventive monitoring.",
      ],
    },
    {
      company: "Spark Digital",
      title:   "Junior Software Engineer",
      bullets: [
        "Contributed to a Node.js backend serving 10k daily active users, focusing on authentication and session management.",
        "Wrote integration tests for third-party payment and notification APIs reducing regression bugs by 45%.",
      ],
    },
  ],

  projects: [
    {
      name:    "OpenAPI Test Runner",
      tech:    ["Go", "REST", "GitHub Actions", "Docker"],
      bullets: [
        "Built a CLI tool that reads an OpenAPI spec and auto-generates integration tests, cutting manual test authoring time in half.",
        "Published as an open-source package with GitHub Actions integration and schema diff alerting.",
      ],
    },
    {
      name:    "AI Digest Service",
      tech:    ["Node.js", "OpenAI", "RSS", "AWS Lambda"],
      bullets: [
        "Developed a serverless pipeline that aggregates content from 30+ sources and delivers AI-summarised digests on a daily schedule.",
      ],
    },
  ],
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const sleep  = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bullet = (s: string)  => `  ${chalk.dim("•")} ${s}`;
const h      = (s: string)  => chalk.bold.underline(s);
const panel  = (content: string, title: string, color: "cyan" | "green" | "yellow" = "cyan") =>
  console.log(boxen(content, {
    title: chalk[color](title),
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: color,
    width: cols(),
  }));

// ─── command ──────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  const company = "Acme Corp";
  const role    = "Software Engineer";

  panel(chalk.bold("Generate a tailored resume"), "TailorCV");
  await sleep(400);

  // simulate prompts
  console.log(chalk.green("?") + " Company name " + chalk.cyan(company));
  console.log(chalk.green("?") + " Role title " + chalk.cyan(role));
  console.log(chalk.dim("\nPaste the job description below, then press Ctrl+D when done."));
  await sleep(600);
  console.log(chalk.dim("[job description pasted]\n"));
  await sleep(400);

  // ── AI generation ──────────────────────────────────────────────────────────

  const aiHandle = startAiSpinner(ora);
  await sleep(4000); // simulate GPT call duration
  aiHandle.stop(true, "Resume generated");

  // ── render ─────────────────────────────────────────────────────────────────

  await heroHeadline(MOCK_RESUME.headline);

  const totalBullets = MOCK_RESUME.experience.reduce((n, e) => n + e.bullets.length, 0)
                     + MOCK_RESUME.projects.reduce((n, p)   => n + p.bullets.length, 0);
  await fitSummary(
    MOCK_RESUME.experience.length,
    MOCK_RESUME.projects.length,
    MOCK_RESUME.skills.length,
    totalBullets
  );

  const lines: string[] = [];
  lines.push(h("Profile"));
  for (const p of MOCK_RESUME.summary) lines.push(bullet(p));

  lines.push(""); lines.push(h("Technical Skills"));
  for (const g of MOCK_RESUME.skills)
    lines.push(`${chalk.cyan(g.category + ":")} ${g.items.join(" · ")}`);

  lines.push(""); lines.push(h("Experience"));
  for (const exp of MOCK_RESUME.experience) {
    lines.push(`${chalk.bold(exp.company)} — ${exp.title}`);
    for (const b of exp.bullets) lines.push(bullet(b));
  }

  lines.push(""); lines.push(h("Projects"));
  for (const p of MOCK_RESUME.projects) {
    lines.push(`${chalk.bold(p.name)}  ${chalk.dim(p.tech.join(" · "))}`);
    for (const b of p.bullets) lines.push(bullet(b));
  }

  console.log();
  panel(lines.join("\n"), `${company} — ${role}`, "green");

  // ── doc building ───────────────────────────────────────────────────────────

  await sleep(600);
  const docHandle = startDocSpinner(ora);
  await sleep(3000); // simulate doc build duration
  docHandle.stop(true, "Google Doc ready");

  // ── url reveal ─────────────────────────────────────────────────────────────

  await revealUrl("https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit");

  // ── error demo (optional — uncomment to test error box) ──────────────────
  // await errorBox("Generation failed", "OpenAI API returned status 429: rate limit exceeded.");
}
