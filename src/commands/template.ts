import chalk from "chalk";
import ora from "ora";
import { confirm } from "@inquirer/prompts";
import { getAuthenticatedClient } from "../core/googleAuth.js";
import { resetTemplateContent } from "../core/googleDrive.js";
import { loadConfig } from "../core/config.js";

export async function run(): Promise<void> {
  const config = loadConfig();

  if (!config.google_template_doc_id) {
    console.log(chalk.red("No template doc configured. Run resume setup first."));
    return;
  }

  console.log(chalk.yellow("⚠  This replaces your template content with the new placeholder format."));
  console.log(chalk.dim("Your text will be reset — you'll need to re-format the placeholder lines."));
  console.log(chalk.dim("\nAfter reset, open the doc and format each placeholder line:"));
  console.log(chalk.dim("  • {{exp-company}} / {{exp-title}}  → bold + right tab stop for location/dates"));
  console.log(chalk.dim("  • {{exp-bullet}}                   → list bullet style"));
  console.log(chalk.dim("  • {{profile-bullet}}               → list bullet style"));
  console.log(chalk.dim("  • {{skills-line}}, {{cert-line}}   → your preferred plain text style"));
  console.log(chalk.cyan(`\nhttps://docs.google.com/document/d/${config.google_template_doc_id}/edit\n`));

  const ok = await confirm({ message: "Reset template?", default: false });
  if (!ok) return;

  const auth = await getAuthenticatedClient();
  if (!auth) {
    console.log(chalk.red("Not authenticated. Run resume setup."));
    return;
  }

  const spinner = ora("Resetting template…").start();
  try {
    await resetTemplateContent(auth, config.google_template_doc_id);
    spinner.succeed("Template reset");
    console.log(chalk.green("\nNow open the doc and format the placeholder lines:"));
    console.log(chalk.cyan(`https://docs.google.com/document/d/${config.google_template_doc_id}/edit`));
  } catch (err) {
    spinner.fail(chalk.red("Reset failed"));
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(msg));
  }
}
