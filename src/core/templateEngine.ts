import type { GeneratedResume } from "./ai.js";
import type { Profile } from "./types.js";

export type LineRole = "plain" | "bullet" | "spacer" | "header" | "subheader";

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
// Contact fields and profile summary only. Experience and projects are handled
// by blocks so the AI can reorder entries by relevance.

export function buildSimpleReplacements(
  profile: Profile,
  resume: GeneratedResume
): Record<string, string> {
  const c = profile.contact;
  return {
    "{{name}}":          c.full_name,
    "{{title}}":         resume.headline,
    "{{location}}":      c.location,
    "{{email}}":         c.email,
    "{{phone}}":         c.phone,
    "{{linkedin}}":      c.linkedin,
    "{{github}}":        c.github,
    "{{profile_points}}": resume.summary.join("\n"),
  };
}

// ─── blocks ───────────────────────────────────────────────────────────────────
//
// Skills, experience, and projects are all rendered as blocks so the engine
// can apply per-line styles (bold prefix, bullets, header/subheader) and the
// AI is free to reorder entries by relevance.
//
// For experience and projects, each AI entry is matched back to the profile by
// name to retrieve fields the AI does not generate (location, dates, url).

export function buildBlocks(profile: Profile, resume: GeneratedResume): Block[] {
  const findExp = (company: string, title: string) =>
    profile.experience.find((e) => e.company === company && e.title === title);

  const findProj = (name: string) =>
    profile.projects.find((p) => p.name === name);

  return [
    // ── skills ────────────────────────────────────────────────────────────────
    {
      startMarker: "{{skils-start",
      endMarker:   "{{skills-end}}",
      lines: resume.skills.map((g) => ({
        text:       `${g.category}: ${g.items.join(" · ")}`,
        role:       "plain" as LineRole,
        boldPrefix: g.category.length + 1,
      })),
      styleMap: { plain: "{{skills-section-title}}" },
    },

    // ── experience ────────────────────────────────────────────────────────────
    {
      startMarker: "{{experience-start}}",
      endMarker:   "{{experience-end}}",
      lines: resume.experience.flatMap((exp, i) => {
        const pe = findExp(exp.company, exp.title);
        return [
          ...(i > 0 ? [{ text: "", role: "spacer" as LineRole }] : []),
          { text: `${exp.company}\t${pe?.location ?? ""}`, role: "header"    as LineRole },
          { text: `${exp.title}\t${pe?.dates ?? ""}`,      role: "subheader" as LineRole },
          ...exp.bullets.map((b) => ({ text: b, role: "bullet" as LineRole })),
        ];
      }),
      styleMap: {
        header:    "{{exp-company}}",
        subheader: "{{exp-title}}",
        bullet:    "{{exp-bullet}}",
      },
    },

    // ── projects ──────────────────────────────────────────────────────────────
    {
      startMarker: "{{projects-start}}",
      endMarker:   "{{projects-end}}",
      lines: resume.projects.flatMap((proj, i) => {
        const pp = findProj(proj.name);
        return [
          ...(i > 0 ? [{ text: "", role: "spacer" as LineRole }] : []),
          { text: `${proj.name}\t${pp?.url ?? ""}`, role: "header" as LineRole },
          { text: proj.tech.join(" · "),            role: "plain"  as LineRole },
          ...proj.bullets.map((b) => ({ text: b, role: "bullet" as LineRole })),
        ];
      }),
      styleMap: {
        header: "{{proj-name}}",
        plain:  "{{proj-tech}}",
        bullet: "{{proj-bullet}}",
      },
    },
  ];
}
