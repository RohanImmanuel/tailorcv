#!/usr/bin/env node

// Load user env first — must happen before any other import reads process.env
import { config as loadEnv } from "dotenv";
import { join } from "path";
import { homedir } from "os";
loadEnv({ path: join(homedir(), ".config", "resume-tailor", ".env") });

import { Command } from "commander";
import { run as runProfile }  from "./commands/profile.js";
import { run as runGenerate } from "./commands/generate.js";
import { run as runSetup }    from "./commands/setup.js";
import { run as runTemplate } from "./commands/template.js";
import { run as runTest }     from "./commands/test.js";
import { run as runDemo }     from "./commands/demo.js";

const program = new Command();

program
  .name("tailorcv")
  .description("Generate tailored resumes using your own AI key")
  .version("0.1.0");

program
  .command("setup")
  .description("Configure your OpenAI API key and Google Drive")
  .action(runSetup);

program
  .command("profile")
  .description("View and edit your profile / master resume data")
  .action(runProfile);

program
  .command("generate")
  .description("Generate a tailored resume from a job description")
  .action(runGenerate);

program
  .command("template")
  .description("Reset your Google Docs template to the latest placeholder format")
  .action(runTemplate);

program
  .command("test")
  .description("Fill the template with mock data to verify layout without using AI tokens")
  .action(runTest);

program
  .command("demo")
  .description("Simulate the full generate flow with mock data and no API calls")
  .action(runDemo);

program.parse();
