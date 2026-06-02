import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import boxen from "boxen";
import { load, save } from "../core/profileStore.js";
import type { Profile, Contact, Entry } from "../core/types.js";

// ─── ui helpers ─────────────────────────────────────────────────────────────

const width = () => process.stdout.columns || 80;

const panel = (content: string, title: string) =>
  console.log(
    boxen(content, {
      title: chalk.cyan(title),
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      width: width(),
    })
  );

const success = (msg: string) => console.log(chalk.green(`✓ ${msg}`));
const warn    = (msg: string) => console.log(chalk.yellow(msg));
const dim     = (s: string)   => chalk.dim(s);
const row     = (label: string, value: string) =>
  `${chalk.cyan(label.padEnd(14))} ${value || dim("—")}`;

async function ask(message: string, defaultVal = ""): Promise<string> {
  return input({ message, default: defaultVal });
}

async function menu(choices: string[]): Promise<string> {
  return select({
    message: "Action",
    choices: [...choices, "← Back"].map((c) => ({ value: c })),
  });
}

// ─── contact ────────────────────────────────────────────────────────────────

function renderContact(c: Contact): void {
  const lines = [
    row("Name",         c.full_name),
    row("Email",        c.email),
    row("Phone",        c.phone),
    row("Location",     c.location),
    row("LinkedIn",     c.linkedin),
    row("GitHub",       c.github),
    row("Portfolio",    c.portfolio),
    row("Work Auth",    c.work_authorization),
  ].join("\n");
  panel(lines, "Contact Info");
}

async function editContact(profile: Profile): Promise<Profile> {
  console.log(dim("\nPress Enter to keep current value\n"));
  const c = profile.contact;
  profile.contact = {
    full_name:          await ask("Full name",        c.full_name),
    email:              await ask("Email",            c.email),
    phone:              await ask("Phone",            c.phone),
    location:           await ask("Location",         c.location),
    linkedin:           await ask("LinkedIn URL",     c.linkedin),
    github:             await ask("GitHub URL",       c.github),
    portfolio:          await ask("Portfolio URL",    c.portfolio),
    work_authorization: await ask("Work authorization", c.work_authorization),
  };
  save(profile);
  success("Contact saved");
  return profile;
}

async function manageContact(profile: Profile): Promise<Profile> {
  while (true) {
    renderContact(profile.contact);
    const action = await menu(["Edit"]);
    if (action === "Edit") profile = await editContact(profile);
    else break;
  }
  return profile;
}

// ─── skills ─────────────────────────────────────────────────────────────────

function renderSkills(skills: string[]): void {
  const content = skills.length
    ? skills.map((s, i) => `${chalk.cyan(String(i + 1).padEnd(4))} ${s}`).join("\n")
    : dim("No skills yet");
  panel(content, "Skills");
}

async function manageSkills(profile: Profile): Promise<Profile> {
  while (true) {
    renderSkills(profile.skills);
    const action = await menu(["Add", "Delete"]);

    if (action === "Add") {
      const val = await ask("Skill");
      if (val) { profile.skills.push(val); save(profile); success("Skill added"); }

    } else if (action === "Delete") {
      if (!profile.skills.length) { warn("Nothing to delete"); continue; }
      const choice = await select({
        message: "Delete which?",
        choices: [...profile.skills, "← Cancel"].map((s) => ({ value: s })),
      });
      if (choice !== "← Cancel") {
        if (await confirm({ message: `Delete "${choice}"?`, default: false })) {
          profile.skills = profile.skills.filter((s) => s !== choice);
          save(profile);
          success("Deleted");
        }
      }
    } else break;
  }
  return profile;
}

// ─── generic list sections ───────────────────────────────────────────────────

type ListSection = "experience" | "projects" | "education" | "certifications";

const FIELDS: Record<ListSection, { key: string; label: string; list?: boolean; multiline?: boolean }[]> = {
  experience: [
    { key: "company",    label: "Company" },
    { key: "title",      label: "Job title" },
    { key: "location",   label: "Location" },
    { key: "start_date", label: "Start date (e.g. Jan 2022)" },
    { key: "end_date",   label: "End date (e.g. Present)" },
    { key: "bullets",    label: "Key bullets (one per line)", multiline: true },
  ],
  projects: [
    { key: "name",    label: "Project name" },
    { key: "url",     label: "URL" },
    { key: "tech",    label: "Tech stack (comma-separated)", list: true },
    { key: "bullets", label: "Key bullets (one per line)", multiline: true },
  ],
  education: [
    { key: "institution", label: "Institution" },
    { key: "degree",      label: "Degree" },
    { key: "field",       label: "Field of study" },
    { key: "graduation",  label: "Graduation year" },
    { key: "gpa",         label: "GPA (optional)" },
  ],
  certifications: [
    { key: "name",   label: "Certification name" },
    { key: "issuer", label: "Issuer" },
    { key: "date",   label: "Date" },
    { key: "url",    label: "URL (optional)" },
  ],
};

const LABEL_KEYS: Record<ListSection, [string, string]> = {
  experience:    ["company", "title"],
  projects:      ["name", "url"],
  education:     ["institution", "degree"],
  certifications:["name", "issuer"],
};

const TITLES: Record<ListSection, string> = {
  experience:    "Work Experience",
  projects:      "Projects",
  education:     "Education",
  certifications:"Certifications",
};

function entryLabel(section: ListSection, entry: Entry): string {
  const [k1, k2] = LABEL_KEYS[section];
  return [entry[k1], entry[k2]].filter((v) => v && typeof v === "string").join(" — ") || "(unnamed)";
}

function renderList(section: ListSection, items: Entry[]): void {
  const content = items.length
    ? items.map((e, i) => `${chalk.cyan(String(i + 1).padEnd(4))} ${entryLabel(section, e)}`).join("\n")
    : dim(`No ${section} yet`);
  panel(content, TITLES[section]);
}

async function promptEntry(section: ListSection, existing?: Entry): Promise<Entry> {
  if (existing) console.log(dim("\nPress Enter to keep current value\n"));
  const entry: Entry = {};
  for (const { key, label, list, multiline } of FIELDS[section]) {
    const current = existing?.[key] ?? "";
    if (multiline) {
      const defaultVal = Array.isArray(current) ? current.join("\n") : String(current);
      console.log(chalk.dim(`${label} (current: ${defaultVal || "none"})`));
      console.log(chalk.dim("Enter one item per line. Press Enter twice when done.\n"));
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
            lines.push(line);
          }
        });
        rl.on("close", resolve);
      });
      entry[key] = lines.length ? lines.map((v) => v.trim()).filter(Boolean) : (Array.isArray(current) ? current : []);
    } else if (list) {
      const defaultVal = Array.isArray(current) ? current.join(", ") : current;
      const val = await ask(label, defaultVal);
      entry[key] = val.split(",").map((v) => v.trim()).filter(Boolean);
    } else {
      entry[key] = await ask(label, Array.isArray(current) ? "" : current);
    }
  }
  return entry;
}

async function manageList(section: ListSection, profile: Profile): Promise<Profile> {
  while (true) {
    const items = profile[section] as Entry[];
    renderList(section, items);
    const action = await menu(["Add", "Edit", "Delete"]);

    if (action === "Add") {
      const entry = await promptEntry(section);
      items.push(entry);
      save(profile);
      success("Entry added");

    } else if (action === "Edit") {
      if (!items.length) { warn("Nothing to edit"); continue; }
      const labels = items.map((e) => entryLabel(section, e));
      const choice = await select({
        message: "Edit which?",
        choices: [...labels, "← Cancel"].map((l) => ({ value: l })),
      });
      if (choice !== "← Cancel") {
        const idx = labels.indexOf(choice);
        items[idx] = await promptEntry(section, items[idx]);
        save(profile);
        success("Entry updated");
      }

    } else if (action === "Delete") {
      if (!items.length) { warn("Nothing to delete"); continue; }
      const labels = items.map((e) => entryLabel(section, e));
      const choice = await select({
        message: "Delete which?",
        choices: [...labels, "← Cancel"].map((l) => ({ value: l })),
      });
      if (choice !== "← Cancel") {
        const idx = labels.indexOf(choice);
        if (await confirm({ message: `Delete "${choice}"?`, default: false })) {
          items.splice(idx, 1);
          save(profile);
          success("Deleted");
        }
      }
    } else break;
  }
  return profile;
}

// ─── main ────────────────────────────────────────────────────────────────────

export async function run(): Promise<void> {
  let profile = load();

  panel(chalk.bold("Your master resume data"), "Profile");

  const SECTIONS: { label: string; fn: (p: Profile) => Promise<Profile> }[] = [
    { label: "Contact Info",   fn: manageContact },
    { label: "Skills",         fn: manageSkills },
    { label: "Work Experience",fn: (p) => manageList("experience", p) },
    { label: "Projects",       fn: (p) => manageList("projects", p) },
    { label: "Education",      fn: (p) => manageList("education", p) },
    { label: "Certifications", fn: (p) => manageList("certifications", p) },
  ];

  while (true) {
    const section = await select({
      message: "Which section?",
      choices: [...SECTIONS.map((s) => ({ value: s.label })), { value: "← Exit" }],
    });
    if (section === "← Exit") break;
    const match = SECTIONS.find((s) => s.label === section);
    if (match) profile = await match.fn(profile);
  }
}
