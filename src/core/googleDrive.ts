import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { docs_v1 } from "googleapis";
import type { Profile } from "./types.js";
import type { GeneratedResume } from "./ai.js";
import { buildSimpleReplacements, buildBlocks } from "./templateEngine.js";
import type { Block, LineRole } from "./templateEngine.js";

export const getDrive = (auth: OAuth2Client) => google.drive({ version: "v3", auth });
export const getDocs  = (auth: OAuth2Client) => google.docs({ version: "v1", auth });

// ─── folder ──────────────────────────────────────────────────────────────────

export async function getOrCreateFolder(auth: OAuth2Client, name: string): Promise<string> {
  const drive = getDrive(auth);

  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  if (res.data.files?.length) return res.data.files[0].id!;

  const folder = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });

  return folder.data.id!;
}

// ─── template content ─────────────────────────────────────────────────────────
//
// Each block contains ONE sample line per role.
// Format those lines in Google Docs (bold, tab stops, bullets, font) —
// the code reads those styles and reuses them for every generated entry.

export const TEMPLATE_TEXT = `{{name}}
{{title}}
{{location}} · {{email}} · {{phone}} · {{linkedin}} · {{github}}

PROFILE

{{profile_points}}

TECHNICAL SKILLS

{{skils-start}}
{{skills-section-title}}: {{skills}}
{{skills-end}}

EXPERIENCE

{{experience-start}}
{{exp-company}}\t{{exp-location}}
{{exp-title}}\t{{exp-dates}}
{{exp-bullet}}
{{experience-end}}

PROJECTS

{{projects-start}}
{{proj-name}}\t{{proj-url}}
{{proj-tech}}
{{proj-bullet}}
{{projects-end}}

EDUCATION

{{education-start}}
{{edu-institution}}\t{{edu-location}}
{{edu-degree}}\t{{edu-graduation}}
{{edu-gpa}}
{{education-end}}

CERTIFICATIONS

{{certifications-start}}
{{cert-line}}
{{certifications-end}}

References available upon request`;

// ─── template doc ─────────────────────────────────────────────────────────────

export async function createTemplateDoc(auth: OAuth2Client, folderId: string): Promise<string> {
  const drive = getDrive(auth);
  const docs  = getDocs(auth);

  const file = await drive.files.create({
    requestBody: {
      name: "Resume Template",
      mimeType: "application/vnd.google-apps.document",
      parents: [folderId],
    },
    fields: "id",
  });

  const docId = file.data.id!;

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ insertText: { location: { index: 1 }, text: TEMPLATE_TEXT } }],
    },
  });

  return docId;
}

// ─── reset template ───────────────────────────────────────────────────────────

export async function resetTemplateContent(auth: OAuth2Client, docId: string): Promise<void> {
  const docs = getDocs(auth);
  const { data: doc } = await docs.documents.get({ documentId: docId });

  const content = doc.body?.content ?? [];
  const lastIndex = content[content.length - 1]?.endIndex ?? 2;

  const requests: docs_v1.Schema$Request[] = [];
  if (lastIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: lastIndex - 1 } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: TEMPLATE_TEXT } });

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
}

// ─── document paragraph extraction ───────────────────────────────────────────

interface Para {
  text: string;
  startIndex: number;
  endIndex: number;
}

function extractParagraphs(doc: docs_v1.Schema$Document): Para[] {
  return (doc.body?.content ?? [])
    .filter((el) => el.paragraph)
    .map((el) => ({
      text: (el.paragraph!.elements ?? [])
        .map((e) => e.textRun?.content ?? "")
        .join(""),
      startIndex: el.startIndex ?? 0,
      endIndex:   el.endIndex   ?? 0,
    }));
}

// ─── style extraction ─────────────────────────────────────────────────────────

// tabStops CAN be set via updateParagraphStyle (unlike named-style inherited values)
const PARA_STYLE_FIELDS = [
  "namedStyleType", "alignment", "lineSpacing", "spaceAbove", "spaceBelow",
  "indentFirstLine", "indentStart", "indentEnd",
] as const;

const TEXT_STYLE_FIELDS = [
  "bold", "italic", "underline", "fontSize", "weightedFontFamily", "foregroundColor",
] as const;

interface StoredStyle {
  paragraphStyle: Partial<docs_v1.Schema$ParagraphStyle>;
  textStyle: Partial<docs_v1.Schema$TextStyle>;
  hasBullet: boolean;
}

function readStyleFromElement(el: docs_v1.Schema$StructuralElement): StoredStyle {
  const para = el.paragraph!;
  const rawPara = para.paragraphStyle ?? {};
  const rawText = para.elements?.[0]?.textRun?.textStyle ?? {};

  const paragraphStyle: Partial<docs_v1.Schema$ParagraphStyle> = {};
  for (const key of PARA_STYLE_FIELDS) {
    if (key in rawPara) {
      (paragraphStyle as Record<string, unknown>)[key] = rawPara[key as keyof typeof rawPara];
    }
  }

  const textStyle: Partial<docs_v1.Schema$TextStyle> = {};
  for (const key of TEXT_STYLE_FIELDS) {
    if (key in rawText) {
      (textStyle as Record<string, unknown>)[key] = rawText[key as keyof typeof rawText];
    }
  }

  return { paragraphStyle, textStyle, hasBullet: !!para.bullet };
}

function readBlockStyles(
  allElements: docs_v1.Schema$StructuralElement[],
  styleMap: Partial<Record<LineRole, string>>
): Partial<Record<LineRole, StoredStyle>> {
  const result: Partial<Record<LineRole, StoredStyle>> = {};

  for (const [role, placeholder] of Object.entries(styleMap) as [LineRole, string][]) {
    const el = allElements.find((e) =>
      e.paragraph?.elements?.some((run) => run.textRun?.content?.includes(placeholder))
    );
    if (el) result[role] = readStyleFromElement(el);
  }

  return result;
}

function applyStyle(
  requests: docs_v1.Schema$Request[],
  style: StoredStyle,
  line: { text: string; boldPrefix?: number },
  lineStart: number,
  lineEnd: number
): void {
  const paraFields = Object.keys(style.paragraphStyle);
  if (paraFields.length) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: lineStart, endIndex: lineEnd },
        paragraphStyle: style.paragraphStyle,
        fields: paraFields.join(","),
      },
    });
  }

  const textFields = Object.keys(style.textStyle);
  if (textFields.length) {
    requests.push({
      updateTextStyle: {
        range: { startIndex: lineStart, endIndex: lineEnd - 1 },
        textStyle: style.textStyle,
        fields: textFields.join(","),
      },
    });
  }

  if (style.hasBullet) {
    requests.push({
      createParagraphBullets: {
        range: { startIndex: lineStart, endIndex: lineEnd },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    });
  }

  // Bold just the leading prefix (e.g. "Category:" in skill lines)
  if (line.boldPrefix && line.boldPrefix > 0) {
    requests.push({
      updateTextStyle: {
        range: { startIndex: lineStart, endIndex: lineStart + line.boldPrefix },
        textStyle: { bold: true },
        fields: "bold",
      },
    });
    requests.push({
      updateTextStyle: {
        range: { startIndex: lineStart + line.boldPrefix, endIndex: lineEnd - 1 },
        textStyle: { bold: false },
        fields: "bold",
      },
    });
  }
}

// ─── copy + fill ──────────────────────────────────────────────────────────────

export async function copyAndFill(
  auth: OAuth2Client,
  templateDocId: string,
  folderId: string,
  docName: string,
  profile: Profile,
  resume: GeneratedResume
): Promise<{ docId: string; url: string }> {
  const drive = getDrive(auth);
  const docs  = getDocs(auth);

  // 1. copy template
  const copy = await drive.files.copy({
    fileId: templateDocId,
    requestBody: { name: docName, parents: [folderId] },
    fields: "id,webViewLink",
  });

  const docId = copy.data.id!;
  const url   = copy.data.webViewLink!;

  // 2. read document
  const { data: doc } = await docs.documents.get({ documentId: docId });
  const allElements = doc.body?.content ?? [];
  const paragraphs  = extractParagraphs(doc);

  // 3. build block requests — reads styles from placeholder lines, then replaces content
  const blocks = buildBlocks(profile, resume);
  const blockRequests = buildBlockRequests(allElements, paragraphs, blocks);

  if (blockRequests.length) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: blockRequests },
    });
  }

  // 4. simple replaceAllText (index-independent, apply after block edits)
  const replacements = buildSimpleReplacements(profile, resume);
  const simpleRequests: docs_v1.Schema$Request[] = Object.entries(replacements).map(
    ([placeholder, value]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: value,
      },
    })
  );

  if (simpleRequests.length) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: simpleRequests },
    });
  }

  // 5. apply right tab stop to any paragraph containing a tab character
  //    (company\tlocation, title\tdates, proj-name\turl lines)
  await applyRightTabStops(docs, docId);

  return { docId, url };
}

// ─── right tab stop pass ──────────────────────────────────────────────────────
//
// After all replaceAllText calls, fetch the document and apply a right-aligned
// tab stop to every paragraph that contains a tab character. These are the
// header lines: Company\tLocation, Title\tDates, ProjectName\tURL.
// Content width is derived from the document's own page size and margins.

function contentWidthPt(doc: docs_v1.Schema$Document): number {
  const style = doc.documentStyle ?? {};
  const pageW     = style.pageSize?.width?.magnitude      ?? 612; // letter width in pt
  const marginL   = style.marginLeft?.magnitude            ?? 72;  // 1 inch default
  const marginR   = style.marginRight?.magnitude           ?? 72;
  return pageW - marginL - marginR;
}

async function applyRightTabStops(
  docs: ReturnType<typeof getDocs>,
  docId: string
): Promise<void> {
  const { data: doc } = await docs.documents.get({ documentId: docId });

  const width = contentWidthPt(doc);

  const tabRequests: docs_v1.Schema$Request[] = (doc.body?.content ?? [])
    .filter((el) => {
      if (!el.paragraph) return false;
      const text = (el.paragraph.elements ?? [])
        .map((e) => e.textRun?.content ?? "")
        .join("");
      return text.includes("\t");
    })
    .map((el) => ({
      updateParagraphStyle: {
        range: { startIndex: el.startIndex!, endIndex: el.endIndex! },
        paragraphStyle: {
          tabStops: [{ alignment: "END", offset: { magnitude: width, unit: "PT" } }],
        },
        fields: "tabStops",
      },
    }));

  if (tabRequests.length) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: tabRequests },
    });
  }
}

// ─── block request builder ───────────────────────────────────────────────────

function buildBlockRequests(
  allElements: docs_v1.Schema$StructuralElement[],
  paragraphs: Para[],
  blocks: Block[]
): docs_v1.Schema$Request[] {
  type Located = {
    startIndex: number;
    endIndex: number;
    lines: Block["lines"];
    styles: Partial<Record<LineRole, StoredStyle>>;
  };

  const located: Located[] = [];

  for (const block of blocks) {
    const startPara = paragraphs.find((p) => p.text.includes(block.startMarker));
    const endPara   = paragraphs.find((p) => p.text.includes(block.endMarker));
    if (!startPara || !endPara) continue;

    located.push({
      startIndex: startPara.startIndex,
      endIndex:   endPara.endIndex,
      lines:      block.lines,
      styles:     readBlockStyles(allElements, block.styleMap),
    });
  }

  // process bottom-to-top so deletions don't shift earlier indices
  located.sort((a, b) => b.startIndex - a.startIndex);

  const requests: docs_v1.Schema$Request[] = [];

  for (const { startIndex, endIndex, lines, styles } of located) {
    requests.push({ deleteContentRange: { range: { startIndex, endIndex } } });

    if (!lines.length) continue;

    const text = lines.map((l) => l.text).join("\n") + "\n";
    requests.push({ insertText: { location: { index: startIndex }, text } });

    // apply per-line styles at the known character offsets
    let offset = startIndex;
    for (const line of lines) {
      const lineStart = offset;
      const lineEnd   = offset + line.text.length + 1; // +1 for \n
      offset = lineEnd;

      if (!line.text || line.role === "spacer") continue;

      const style = styles[line.role];
      if (style) applyStyle(requests, style, line, lineStart, lineEnd);
    }
  }

  return requests;
}
