import type { GeneratedResume } from "./ai.js";
import type { Profile } from "./types.js";

export type LineRole = "plain" | "bullet" | "spacer";

export interface LineSpec {
  text: string;
  role: LineRole;
  /** Number of leading characters to bold (e.g. category name length for skill lines) */
  boldPrefix?: number;
}

export interface Block {
  startMarker: string;
  endMarker: string;
  lines: LineSpec[];
  styleMap: Partial<Record<LineRole, string>>;
}

// ─── simple replacements (replaceAllText — preserves all formatting) ──────────
//
// Replacing a placeholder with text containing \n splits the paragraph at each
// newline. Each resulting paragraph inherits the original's formatting (bullet
// style, bold, font, tab stops — everything). One placeholder per entry.

export function buildSimpleReplacements(
  profile: Profile,
  resume: GeneratedResume
): Record<string, string> {
  const c = profile.contact;
  const r: Record<string, string> = {
    "{{name}}":     c.full_name,
    "{{title}}":    resume.headline,
    "{{location}}": c.location,
    "{{email}}":    c.email,
    "{{phone}}":    c.phone,
    "{{linkedin}}": c.linkedin,
    "{{github}}":   c.github,
  };

  // Profile bullets — single placeholder, all points joined with \n
  r["{{profile_points}}"] = resume.summary.join("\n");

  // Experience bullets — one placeholder per entry, all bullets joined with \n
  resume.experience.forEach((exp, i) => {
    r[`{{exp-${i + 1}-bullet}}`] = exp.bullets.join("\n");
  });

  // Project skills, bullets, and URL — one placeholder each per project
  // URL comes from profile directly (not AI output) to avoid hallucination
  resume.projects.forEach((proj, i) => {
    r[`{{proj-${i + 1}-skills}}`] = proj.tech.join(" · ");
    r[`{{proj-${i + 1}-bullet}}`] = proj.bullets.join("\n");
    r[`{{proj-${i + 1}-url}}`]    = profile.projects[i]?.url ?? "";
  });

  return r;
}

// ─── blocks ───────────────────────────────────────────────────────────────────
//
// Skills uses a block so we can bold just the category name in each line.
// replaceAllText applies uniform formatting — can't do mixed bold/normal.

export function buildBlocks(resume: GeneratedResume): Block[] {
  return [
    {
      startMarker: "{{skils-start",
      endMarker:   "{{skills-end}}",
      lines: resume.skills.map((g) => ({
        text:        `${g.category}: ${g.items.join(" · ")}`,
        role:        "plain" as LineRole,
        boldPrefix:  g.category.length + 1, // bold "Category:" not the items
      })),
      styleMap: { plain: "{{skills-section-title}}" },
    },
  ];
}
