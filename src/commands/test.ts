import chalk from "chalk";
import ora from "ora";
import { getAuthenticatedClient } from "../core/googleAuth.js";
import { copyAndFill, resetAndFill } from "../core/googleDrive.js";
import { loadConfig, updateConfig } from "../core/config.js";
import { load as loadProfile } from "../core/profileStore.js";
import type { GeneratedResume } from "../core/ai.js";
import open from "open";

// ─── mock resume ─────────────────────────────────────────────────────────────
//
// Uses real company/title/project names from the profile so the block engine
// can match entries back to get location, dates, and url.

const MOCK_RESUME: GeneratedResume = {
  headline: "Software Engineer · Test Drive · Template Check",

  summary: [
    "This is profile bullet one — checking font, size, and spacing.",
    "This is profile bullet two — verifying the bullet list style is applied.",
    "This is profile bullet three — confirming all three points render correctly.",
  ],

  skills: [
    { category: "Languages",       items: ["TypeScript", "Python", "Go", "JavaScript"] },
    { category: "Testing",         items: ["Selenium", "Playwright", "Appium", "Pytest"] },
    { category: "Cloud & DevOps",  items: ["AWS", "Docker", "GitHub Actions"] },
    { category: "Databases",       items: ["MongoDB", "PostgreSQL"] },
  ],

  experience: [
    {
      company: "HubSpot",
      title:   "Software Engineer, Final Semester Internship",
      bullets: [
        "First bullet for HubSpot — checking action verb, spacing, and wrap at line length.",
        "Second bullet — verifying tab stop on header line above aligns location to the right.",
        "Third bullet — confirming bullet style (disc/indent) matches the template reference line.",
      ],
    },
    {
      company: "BrowserStack",
      title:   "Software Development Engineer, Customer Engineering",
      bullets: [
        "First bullet for BrowserStack role — block engine should pick up location and dates from profile.",
        "Second bullet — verifying spacer line appears between this entry and the one above.",
      ],
    },
    {
      company: "Maneuver Marketing",
      title:   "Tech Systems Engineer, Contract",
      bullets: [
        "Single bullet for Maneuver Marketing — checking reordering works (this was entry 2 in the profile).",
      ],
    },
  ],

  projects: [
    {
      name:    "AI News Digest Platform",
      tech:    ["Node.js", "OpenAI", "RSS", "Docker"],
      bullets: [
        "First bullet for AI News Digest — checking tech line style above and URL tab stop.",
        "Second bullet — verifying project block spacer between entries.",
      ],
    },
    {
      name:    "go-api-test-runner",
      tech:    ["Go", "REST", "GitHub Actions"],
      bullets: [
        "Single bullet for go-api-test-runner — this was project 3 in the profile, reordered here.",
      ],
    },
  ],
};

// ─── command ──────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  const config = loadConfig();

  if (!config.google_template_doc_id || !config.google_folder_id) {
    console.log(chalk.red("Not set up. Run tailorcv setup first."));
    return;
  }

  const profile = loadProfile();

  const auth = await getAuthenticatedClient();
  if (!auth) {
    console.log(chalk.red("Not authenticated. Run tailorcv setup."));
    return;
  }

  const spinner = ora("Filling template with mock data…").start();

  try {
    let url: string;

    if (config.google_test_doc_id) {
      // reuse existing test doc — reset to template then fill
      url = await resetAndFill(auth, config.google_test_doc_id, profile, MOCK_RESUME);
    } else {
      // first run — create the doc and save its id
      const result = await copyAndFill(
        auth,
        config.google_template_doc_id,
        config.google_folder_id,
        "TEST - Template Check",
        profile,
        MOCK_RESUME
      );
      url = result.url;
      updateConfig({ google_test_doc_id: result.docId });
    }

    spinner.succeed("Test doc updated");
    console.log(chalk.green("\nOpen your doc and check:"));
    console.log(chalk.dim("  • Skills lines: bold category name, plain items, correct separator"));
    console.log(chalk.dim("  • Experience: company/location right-aligned, title/dates right-aligned, bullets styled"));
    console.log(chalk.dim("  • Projects: name/url right-aligned, tech line styled, bullets styled"));
    console.log(chalk.dim("  • Reordering: BrowserStack appears before Maneuver Marketing (profile order was reversed)"));
    console.log(chalk.dim("  • Only 3 experience and 2 project entries (subset to keep the doc short)\n"));
    console.log(chalk.cyan(url));
    await open(url);
  } catch (err) {
    spinner.fail(chalk.red("Test failed"));
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(msg));
  }
}
