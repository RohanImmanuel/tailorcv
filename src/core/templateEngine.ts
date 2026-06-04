import type { GeneratedResume } from "./ai.js";
import type { Profile } from "./types.js";

export type LineRole = "plain" | "bullet" | "spacer" | "header" | "subheader";

export interface LineSpec {
  text: string;
  role: LineRole;
  boldPrefix?: number;
}

export interface Block {
  startMarker: string;
  endMarker:   string;
  lines:       LineSpec[];
  styleMap:    Partial<Record<LineRole, string>>;
}

// ─── simple replacements ──────────────────────────────────────────────────────

export function buildSimpleReplacements(
  profile: Profile,
  resume: GeneratedResume
): Record<string, string> {
  const c = profile.contact;
  return {
    "{{name}}":           c.full_name,
    "{{title}}":          resume.headline,
    "{{location}}":       c.location,
    "{{email}}":          c.email,
    "{{phone}}":          c.phone,
    "{{linkedin}}":       c.linkedin,
    "{{github}}":         c.github,
    "{{profile_points}}": resume.summary.join("\n"),
  };
}

// ─── blocks ───────────────────────────────────────────────────────────────────
//
// The block engine uses an INSERT-BEFORE strategy so generated paragraphs
// inherit the reference line's paragraph style — including any right tab stop
// the user has set — without needing to write tabStops via the API (read-only).
//
// For experience/projects, each AI entry is matched back to the profile by
// company+title / name to retrieve fields the AI does not output (location,
// dates, url).

export function buildBlocks(profile: Profile, resume: GeneratedResume): Block[] {
  const findExp  = (company: string, title: string) =>
    profile.experience.find((e) => e.company === company && e.title === title);
  const findProj = (name: string) =>
    profile.projects.find((p) => p.name === name);

  return [
    // ── skills ────────────────────────────────────────────────────────────────
    {
      startMarker: "{{skils-start}}",
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
        header:    "{{exp-header}}",
        subheader: "{{exp-subheader}}",
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
        header: "{{proj-header}}",
        plain:  "{{proj-tech}}",
        bullet: "{{proj-bullet}}",
      },
    },

    // ── education ─────────────────────────────────────────────────────────────
    {
      startMarker: "{{education-start}}",
      endMarker:   "{{education-end}}",
      lines: profile.education.flatMap((edu, i) => [
        ...(i > 0 ? [{ text: "", role: "spacer" as LineRole }] : []),
        { text: `${edu.institution}\t${edu.location ?? ""}`, role: "header"    as LineRole, boldPrefix: edu.institution.length },
        { text: `${edu.degree}\t${edu.graduation}`,          role: "subheader" as LineRole },
        ...(edu.gpa ? [{ text: edu.gpa, role: "plain" as LineRole }] : []),
      ]),
      styleMap: {
        header:    "{{edu-header}}",
        subheader: "{{edu-subheader}}",
        plain:     "{{edu-gpa}}",
      },
    },

    // ── certifications ────────────────────────────────────────────────────────
    {
      startMarker: "{{certifications-start}}",
      endMarker:   "{{certifications-end}}",
      lines: profile.certifications.map((cert) => ({
        text: [cert.name, cert.issuer, cert.date].filter(Boolean).join(" · "),
        role: "plain" as LineRole,
      })),
      styleMap: { plain: "{{cert-line}}" },
    },
  ];
}
