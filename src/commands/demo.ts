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
    "3+ years building and testing web, mobile, and API-based platforms across fast-paced product and SaaS environments.",
    "Experienced in end-to-end test automation, CI/CD integration, and developer tooling for cross-browser and cross-platform coverage.",
    "Proven ability to debug complex systems at scale, from browser quirks to cloud-deployed backend services.",
  ],

  skills: [
    { category: "Languages",      items: ["TypeScript", "Python", "JavaScript", "Go"] },
    { category: "Testing",        items: ["Selenium", "Playwright", "Appium", "Pytest", "WebdriverIO"] },
    { category: "Cloud & DevOps", items: ["AWS", "Docker", "GitHub Actions", "CI/CD"] },
    { category: "Databases",      items: ["MongoDB", "PostgreSQL"] },
  ],

  experience: [
    {
      company: "HubSpot",
      title:   "Software Engineer, Final Semester Internship",
      bullets: [
        "Built automated test coverage for platform APIs using TypeScript and REST-based test frameworks, improving pipeline reliability.",
        "Debugged and resolved cross-browser issues across Chrome, Firefox, and Safari for production web features.",
        "Collaborated with senior engineers to ship a CI-integrated test suite reducing manual QA effort by 40%.",
        "Documented testing patterns adopted across two product squads.",
      ],
    },
    {
      company: "BrowserStack",
      title:   "Software Development Engineer, Customer Engineering",
      bullets: [
        "Supported enterprise customers integrating Selenium, Appium, and Playwright with BrowserStack's cloud infrastructure.",
        "Built and maintained a custom Chrome-extension debugging tool used internally to reproduce customer-reported issues.",
        "Resolved 25+ parallel environment configuration issues monthly across web and mobile automation pipelines.",
        "Authored technical guides and runbooks adopted by the wider Customer Engineering team.",
      ],
    },
    {
      company: "Maneuver Marketing",
      title:   "Tech Systems Engineer, Contract",
      bullets: [
        "Automated CRM workflows and marketing pipeline integrations reducing manual processing time by 60%.",
        "Built REST API integrations between third-party SaaS platforms using JavaScript and Zapier.",
      ],
    },
  ],

  projects: [
    {
      name:    "AI News Digest Platform",
      tech:    ["Node.js", "OpenAI", "RSS", "Docker", "AWS"],
      bullets: [
        "Built an automated news aggregation pipeline using OpenAI to summarise and categorise articles from 20+ RSS feeds.",
        "Deployed as a containerised service on AWS with scheduled runs and email digest delivery.",
      ],
    },
    {
      name:    "go-api-test-runner",
      tech:    ["Go", "REST", "GitHub Actions"],
      bullets: [
        "Developed a lightweight CLI test runner for REST APIs in Go, supporting JSON schema validation and CI integration.",
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
  console.log(chalk.dim("\nPaste the job description below, then press Enter twice to continue."));
  await sleep(600);
  console.log(chalk.dim("[job description pasted]\n"));
  await sleep(400);

  // ── AI generation ──────────────────────────────────────────────────────────

  const aiHandle = startAiSpinner(ora);
  await sleep(13000); // simulate GPT call duration
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
  await sleep(9000); // simulate doc build duration
  docHandle.stop(true, "Google Doc ready");

  // ── url reveal ─────────────────────────────────────────────────────────────

  await revealUrl("https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit");

  // ── error demo (optional — uncomment to test error box) ──────────────────
  // await errorBox("Generation failed", "OpenAI API returned status 429: rate limit exceeded.");
}
