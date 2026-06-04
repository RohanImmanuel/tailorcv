import chalk from "chalk";
import boxen from "boxen";

// ─── layout ───────────────────────────────────────────────────────────────────

export const cols = () => process.stdout.columns || 80;
const rule = (char = "─") => chalk.dim(char.repeat(cols()));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── spinners ────────────────────────────────────────────────────────────────

export const SPINNER_DOTS = {
  interval: 80,
  frames: ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"],
};

export const SPINNER_BLOCK = {
  interval: 120,
  frames: [
    "▰▱▱▱▱▱▱▱",
    "▰▰▱▱▱▱▱▱",
    "▰▰▰▱▱▱▱▱",
    "▰▰▰▰▱▱▱▱",
    "▰▰▰▰▰▱▱▱",
    "▰▰▰▰▰▰▱▱",
    "▰▰▰▰▰▰▰▱",
    "▰▰▰▰▰▰▰▰",
    "▱▰▰▰▰▰▰▰",
    "▱▱▰▰▰▰▰▰",
    "▱▱▱▰▰▰▰▰",
    "▱▱▱▱▰▰▰▰",
    "▱▱▱▱▱▰▰▰",
    "▱▱▱▱▱▱▰▰",
    "▱▱▱▱▱▱▱▰",
    "▱▱▱▱▱▱▱▱",
  ],
};

// ─── multi-stage AI spinner ───────────────────────────────────────────────────
//
// Returns a { stop } handle. Call stop(true) on success, stop(false) on failure.

const AI_STAGES = [
  "Analysing job requirements",
  "Scoring candidate fit",
  "Selecting strongest experience",
  "Reordering by relevance",
  "Writing tailored bullets",
  "Optimising for ATS",
  "Finalising resume",
];

export function startAiSpinner(ora: typeof import("ora").default) {
  const spinner = ora({
    text: chalk.cyan(AI_STAGES[0] + "…"),
    spinner: SPINNER_DOTS,
    color: "cyan",
  }).start();

  let i = 0;
  const cycle = setInterval(() => {
    i = (i + 1) % AI_STAGES.length;
    spinner.text = chalk.cyan(AI_STAGES[i] + "…");
  }, 2200);

  return {
    stop(success: boolean, msg: string) {
      clearInterval(cycle);
      if (success) spinner.succeed(chalk.bold.green(msg));
      else         spinner.fail(chalk.bold.red(msg));
    },
  };
}

// ─── doc build spinner ────────────────────────────────────────────────────────

const DOC_STAGES = [
  "Copying template",
  "Rendering skills block",
  "Rendering experience block",
  "Rendering projects block",
  "Applying formatting",
  "Saving to Drive",
];

export function startDocSpinner(ora: typeof import("ora").default) {
  const spinner = ora({
    text: chalk.cyan(DOC_STAGES[0] + "…"),
    spinner: SPINNER_BLOCK,
    color: "cyan",
  }).start();

  let i = 0;
  const cycle = setInterval(() => {
    i = Math.min(i + 1, DOC_STAGES.length - 1);
    spinner.text = chalk.cyan(DOC_STAGES[i] + "…");
  }, 1800);

  return {
    stop(success: boolean, msg: string) {
      clearInterval(cycle);
      if (success) spinner.succeed(chalk.bold.green(msg));
      else         spinner.fail(chalk.bold.red(msg));
    },
  };
}

// ─── typewriter ───────────────────────────────────────────────────────────────

export async function typewriter(text: string, delayMs = 14): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delayMs);
  }
  process.stdout.write("\n");
}

// ─── url reveal ───────────────────────────────────────────────────────────────

export async function revealUrl(url: string): Promise<void> {
  const pad   = 2;
  const inner = cols() - pad * 2 - 4; // account for boxen border + padding
  const label = "Open your resume";

  // top border
  console.log("\n" + chalk.cyan("╔" + "═".repeat(cols() - 2) + "╗"));
  console.log(chalk.cyan("║") + " ".repeat(cols() - 2) + chalk.cyan("║"));
  console.log(chalk.cyan("║") + chalk.dim(label.padStart(Math.floor((cols() - 2 + label.length) / 2)).padEnd(cols() - 2)) + chalk.cyan("║"));
  console.log(chalk.cyan("║") + " ".repeat(cols() - 2) + chalk.cyan("║"));

  // typewriter URL line
  const urlPad = " ".repeat(Math.floor((cols() - 2 - url.length) / 2));
  process.stdout.write(chalk.cyan("║") + urlPad);
  for (const char of url) {
    process.stdout.write(chalk.bold.cyan(char));
    await sleep(12);
  }
  const rightPad = " ".repeat(Math.max(0, cols() - 2 - urlPad.length - url.length));
  process.stdout.write(rightPad + chalk.cyan("║") + "\n");

  console.log(chalk.cyan("║") + " ".repeat(cols() - 2) + chalk.cyan("║"));
  console.log(chalk.cyan("╚" + "═".repeat(cols() - 2) + "╝") + "\n");
}

// ─── error box ────────────────────────────────────────────────────────────────

export async function errorBox(title: string, message: string): Promise<void> {
  await sleep(80);
  console.log("\n" + rule("─"));
  console.log(chalk.bold.red(`  ✖  ${title}`));
  console.log(rule("─"));
  console.log(chalk.red(`  ${message}`));
  console.log(rule("─") + "\n");
}

// ─── headline hero ────────────────────────────────────────────────────────────

export async function heroHeadline(headline: string): Promise<void> {
  console.log();

  // animate border drawing
  const width = cols();
  const top    = "╔" + "═".repeat(width - 2) + "╗";
  const bottom = "╚" + "═".repeat(width - 2) + "╝";
  const blank  = "║" + " ".repeat(width - 2) + "║";

  const textPad = Math.max(0, Math.floor((width - 2 - headline.length) / 2));
  const textRow = "║" + " ".repeat(textPad) + headline + " ".repeat(Math.max(0, width - 2 - textPad - headline.length)) + "║";

  // draw top border character by character
  process.stdout.write(chalk.green("╔"));
  for (let i = 0; i < width - 2; i++) {
    process.stdout.write(chalk.green("═"));
    await sleep(4);
  }
  process.stdout.write(chalk.green("╗\n"));

  console.log(chalk.green(blank));

  // type headline
  process.stdout.write(chalk.green("║") + " ".repeat(textPad));
  for (const char of headline) {
    process.stdout.write(chalk.bold.white(char));
    await sleep(22);
  }
  process.stdout.write(" ".repeat(Math.max(0, width - 2 - textPad - headline.length)) + chalk.green("║\n"));

  console.log(chalk.green(blank));

  // draw bottom border
  process.stdout.write(chalk.green("╚"));
  for (let i = 0; i < width - 2; i++) {
    process.stdout.write(chalk.green("═"));
    await sleep(4);
  }
  process.stdout.write(chalk.green("╝\n"));
}

// ─── fit summary ──────────────────────────────────────────────────────────────

export async function fitSummary(
  roles: number,
  projects: number,
  skillGroups: number,
  bullets: number
): Promise<void> {
  const stat = (n: number, label: string) =>
    `${chalk.bold.green(String(n))} ${chalk.dim(label)}`;

  const parts = [
    stat(roles,       "roles"),
    stat(projects,    "projects"),
    stat(skillGroups, "skill groups"),
    stat(bullets,     "bullets"),
  ];

  process.stdout.write("\n  ");
  for (let i = 0; i < parts.length; i++) {
    process.stdout.write(parts[i]);
    if (i < parts.length - 1) {
      await sleep(120);
      process.stdout.write(chalk.dim("  ·  "));
    }
  }
  process.stdout.write("\n");
}
