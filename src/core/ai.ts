import OpenAI from "openai";
import { z } from "zod";
import type { Profile } from "./types.js";

// ─── output schema ───────────────────────────────────────────────────────────

export const ResumeSchema = z.object({
  headline: z.string()
    .describe("One-line professional title tailored to the target role"),

  summary: z.array(z.string())
    .describe("3-4 ATS-optimised profile bullet points"),

  skills: z.preprocess(
    (val) => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        return Object.entries(val as Record<string, string[]>).map(
          ([category, items]) => ({ category, items })
        );
      }
      return [];
    },
    z.array(z.object({ category: z.string(), items: z.array(z.string()) }))
  ).describe("Skills grouped by category, ordered by JD relevance"),

  experience: z.array(
    z.object({
      company: z.string(),
      title:   z.string(),
      bullets: z.array(z.string()),
    })
  ).describe("Same order as candidate profile — one object per role"),

  projects: z.array(
    z.object({
      name:    z.string(),
      tech:    z.array(z.string()),
      bullets: z.array(z.string()),
    })
  ).describe("Same order as candidate profile — one object per project"),
});

export type GeneratedResume = z.infer<typeof ResumeSchema>;

// ─── prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(profile: Profile, company: string, role: string, jd: string): string {
  return `You are an expert resume writer, ATS optimisation specialist, and technical recruiter.

Your task is to generate tailored resume content for the target job using ONLY the candidate's real profile details.

Do not invent companies, titles, dates, tools, metrics, achievements, responsibilities, certifications, degrees, domain experience, leadership experience, or production ownership.

## Target Role
Company: ${company}
Role: ${role}

## Job Description
${jd}

## Candidate Profile
${JSON.stringify(profile, null, 2)}

## Output Goal
Generate ATS-optimised resume content that truthfully aligns the candidate's real experience with the job description.

The output must:
- Match the provided JSON schema exactly
- Preserve the same number and order of experience entries as the candidate profile
- Preserve the same number and order of project entries as the candidate profile
- Use only evidence found in the candidate profile
- Mirror important job description keywords only when truthful
- Prioritise relevance to the target role over generic resume language
- Be concise, specific, and recruiter-friendly
- Return ONLY valid JSON with no markdown, comments, explanations, or code fences

## Silent Analysis Before Writing
Before generating the JSON, silently perform these steps:
1. Identify the top 5 must-have requirements in the job description.
2. Identify the top 5 nice-to-have requirements.
3. Identify which requirements are directly supported by the candidate profile.
4. Identify which requirements are only adjacent or partially supported.
5. Identify which requirements are missing and must be omitted.
6. Select the strongest evidence from the candidate profile for each resume section.
7. Silently assign a fit score from 1–10. If below 6, produce a truthful transferable-skills resume. If 6–8, emphasise adjacent and direct matches carefully. If above 8, strongly mirror JD language where truthful.
8. Do not reveal this analysis or score in the final output.

## Selection Strategy
Optimise for recruiter shortlisting, not just ATS keyword matching.

Prioritise resume content in this order:
1. Direct matches to must-have JD requirements
2. Recent experience relevant to the role
3. Evidence-backed technical achievements with tools, systems, and outcomes
4. Adjacent experience framed honestly
5. Generic experience only when it improves role fit

The resume must be both ATS-readable and recruiter-believable.
Do not make the candidate appear more specialised than the profile supports.
The first summary bullet and first two experience bullets should give the strongest truthful reason to shortlist the candidate.
Do not over-optimise for ATS at the cost of recruiter credibility — the resume must read like a truthful human resume, not a keyword-stuffed generated document.

## ATS Optimisation Rules
1. Use exact wording from the job description where it accurately matches the candidate's background.
2. Prefer hard skills, tools, frameworks, platforms, methodologies, and measurable outcomes.
3. Do not keyword-stuff. Use keywords naturally across headline, summary, skills, experience, and projects.
4. Do not claim direct experience with a tool, technology, domain, or responsibility unless it appears in the candidate profile.
5. If the JD asks for a skill that is not in the profile, omit it.
6. If the candidate has adjacent experience, describe it honestly without overstating it.
7. Do not repeat the same JD keyword unnecessarily across multiple bullets.

## Headline Rules
Return a single professional title line, not a sentence.

The headline must:
- Align with the target role where truthful
- Reflect the candidate's actual seniority level and background
- Not copy the job title if it would overstate the candidate's experience
- Not inflate to "Senior", "Lead", "Architect", "Manager", or domain specialist unless clearly supported by the profile
- Include 1–2 important technical keywords from the JD when truthful
- Be 5–10 words maximum
- Have no period at the end

If the candidate does not have direct evidence for the target job title, use a broader truthful title with relevant keywords instead.

Examples:
- Use "Software Engineer · Java · REST APIs" instead of "Java Developer" if Java experience exists but backend Java ownership is limited
- Use "QA Automation Engineer · Selenium · CI/CD" instead of "SDET" if the profile is mostly automation testing
- Use "Solutions Engineer · APIs · Cloud" instead of "Cloud Architect" if architecture ownership is not clearly supported

Good headline examples:
- "Software Engineer · Java · Spring Boot"
- "Backend Engineer | Python · APIs"
- "QA Automation Engineer · Selenium · CI/CD"
- "Solutions Engineer · APIs · Cloud"

## Summary Rules
Return 3–4 bullet points.

Each summary bullet must:
- Align with the target role
- Include relevant technical keywords only when supported by the profile
- Avoid first-person language
- Avoid vague claims like "passionate", "hard-working", "fast learner", or "team player"
- Be specific, recruiter-friendly, and grounded in real experience

## Skills Rules
Group skills by clear categories.

Rules:
- Order categories by relevance to the job description
- Order skills inside each category by JD relevance
- Only include skills present in the candidate profile
- Do not include missing JD skills
- Do not create categories with only weak or irrelevant skills
- Do not list a skill only because it appears once in a weak or unrelated context
- Prioritise skills that are required by the JD, used in recent roles, supported by experience bullets or projects, and defensible in an interview
- If a skill is important to the JD but only lightly supported, place it lower in the relevant category

Suggested categories:
- Programming Languages
- Backend & APIs
- Frontend
- Cloud & DevOps
- Testing & Automation
- Databases
- Tools & Platforms
- Methodologies

Only use categories that fit the candidate profile and job description.

## Experience Rules
For each experience entry:
- Return one object with company, title, and bullets
- Keep company and title exactly as they appear in the candidate profile
- Keep the same order as the candidate profile
- Generate 4–6 bullets for recent or highly relevant roles
- Generate 3–5 bullets for older or less relevant roles
- If a role is weakly related to the JD, keep only the most transferable bullets
- Do not include every possible bullet just because evidence exists — prefer quality over quantity
- If a bullet in the candidate profile contains a URL, preserve it exactly at the end of that bullet
- Tailor the original experience to the target role
- Start every bullet with a strong action verb
- Include metrics only if they already exist in the profile
- Do not add technologies not used in that role
- Do not invent business impact
- Emphasise the most JD-relevant work first
- Avoid repeating the same wording across roles
- Use past tense for previous roles and present tense only for current roles

Strong action verbs:
Built, Developed, Automated, Integrated, Designed, Optimised, Improved, Delivered, Implemented, Supported, Debugged, Refactored, Collaborated, Migrated, Tested, Monitored, Streamlined.

## Project Rules
For each project entry:
- Return one object with name, tech, and bullets
- Keep name exactly as it appears in the candidate profile
- Keep the same order as the candidate profile
- Generate 2–3 bullets only when enough real evidence exists
- Use only technologies listed for that project or clearly present in the candidate profile
- Tailor bullets toward the target job
- Emphasise technical implementation, architecture, APIs, automation, testing, deployment, scalability, reliability, or user impact where applicable
- Do not invent users, scale, revenue impact, or production usage unless provided

## Gap Handling Rules
If the JD asks for a skill or experience missing from the profile:
- Do not include the missing skill
- Do not mention the gap
- Use the closest truthful adjacent evidence only if it genuinely helps positioning
- Do not convert testing, support, tooling, or exposure into direct production ownership

Examples:
- If Spring Boot is missing, do not write Spring Boot
- If payments integration is missing but Stripe testing exists, write "payment-flow validation" not "payments integration development"
- If SQL queries are present but database design is not, write "SQL queries" not "database architecture"

## Anti-Hallucination Rules
Do not:
- Invent metrics
- Invent job titles
- Invent leadership experience
- Invent production ownership
- Invent financial, payment, healthcare, security, or domain experience unless stated
- Claim expertise in a JD skill missing from the profile
- Add certifications, degrees, awards, or open-source work unless provided
- Use buzzwords without evidence
- Inflate seniority in the headline
- Convert adjacent experience into direct experience

If a job description requirement is missing from the profile, omit it completely.

## Writing Style
Use:
- Clear, modern resume language
- Bullet points between 18 and 32 words where possible
- Technical keywords naturally
- Specific tools and outcomes where supported
- Concise recruiter-friendly phrasing

Avoid:
- First-person language
- Generic soft skills
- Inflated claims
- Long sentences
- Repetition
- Markdown
- Explanations outside JSON

## Required JSON Output
Return ONLY valid JSON. No markdown. No comments. No explanations. No code fences. No trailing commas.

{
  "headline": "Professional Title · Key Skill · Key Skill",
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "skills": [{ "category": "Category Name", "items": ["Skill 1", "Skill 2"] }],
  "experience": [{ "company": "Company", "title": "Title", "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"] }],
  "projects": [{ "name": "Project Name", "tech": ["Tech 1"], "bullets": ["bullet 1", "bullet 2"] }]
}

## Recruiter Believability Check
Before returning, silently verify:
- The headline is supported by at least two pieces of evidence in the profile
- The summary does not make the candidate sound more senior or specialised than the experience proves
- The first 5 skills strongly match the JD and are defensible
- The first 2 experience bullets create a strong reason to shortlist the candidate
- No bullet sounds like it was written only to force in a JD keyword
- Adjacent experience is framed as adjacent, not direct

## Final Silent Verification
Before returning, silently verify:
- JSON is valid with no trailing commas
- Schema is followed exactly including the headline field
- No unsupported claims were added
- No missing JD skills were falsely included
- Headline does not inflate seniority
- Company names and titles are unchanged from the profile
- Project names are unchanged from the profile
- Experience order matches the candidate profile
- Project order matches the candidate profile
- Any bullet containing a URL in the candidate profile still contains that URL
- Skills are ordered by JD relevance
- Output contains no markdown`;
}

// ─── generate ────────────────────────────────────────────────────────────────

export async function generateResume(
  profile: Profile,
  company: string,
  role: string,
  jd: string
): Promise<GeneratedResume> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-5.5",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a resume writer. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: buildPrompt(profile, company, role, jd),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  const parsed = JSON.parse(raw);
  return ResumeSchema.parse(parsed);
}
