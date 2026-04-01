import {
  type MessagingThreadExportPackage,
  type MessagingThreadExportReceipt,
} from "./messagingThreadExportIntegrity.ts";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN_LEFT = 48;
const PAGE_MARGIN_RIGHT = 48;
const PAGE_MARGIN_TOP = 52;
const PAGE_MARGIN_BOTTOM = 44;

type PdfFontKey = "regular" | "bold" | "mono";

type PdfLine = {
  font: PdfFontKey;
  size: number;
  text: string;
};

interface BuildMessagingThreadExportPdfArgs {
  packageData: MessagingThreadExportPackage;
  receiptId: string;
  signingKeyId: string | null;
  signatureAlgorithm: string | null;
}

const normalizeArtifactTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const sanitizePdfText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[^\x20-\x7E\n]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapText = (value: string, maxChars: number) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine = `${currentLine} ${word}`;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const wrapMonospace = (value: string, maxChars: number) => {
  const normalized = value.trim();
  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];
  for (let index = 0; index < normalized.length; index += maxChars) {
    lines.push(normalized.slice(index, index + maxChars));
  }

  return lines;
};

const pushWrappedLines = (
  lines: PdfLine[],
  value: string,
  options: {
    font: PdfFontKey;
    maxChars: number;
    prefix?: string;
    size?: number;
  },
) => {
  const wrappedLines =
    options.font === "mono"
      ? wrapMonospace(value, options.maxChars)
      : wrapText(value, options.maxChars);

  wrappedLines.forEach((line, index) => {
    lines.push({
      font: options.font,
      size: options.size ?? 10,
      text: index === 0 && options.prefix ? `${options.prefix}${line}` : line,
    });
  });
};

const addSpacer = (lines: PdfLine[], count = 1) => {
  for (let index = 0; index < count; index += 1) {
    lines.push({ font: "regular", size: 10, text: "" });
  }
};

const buildPdfLines = ({
  packageData,
  receiptId,
  signingKeyId,
  signatureAlgorithm,
}: BuildMessagingThreadExportPdfArgs) => {
  const lines: PdfLine[] = [];
  const receipt = packageData.receipt;
  const manifest = packageData.manifest;
  const exportedAt =
    normalizeArtifactTimestamp(manifest.export_generated_at) ??
    manifest.export_generated_at;

  lines.push({ font: "bold", size: 18, text: "CoParrent Message Record" });
  lines.push({
    font: "regular",
    size: 10,
    text: `Thread: ${manifest.thread_display_name}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Receipt ID: ${receiptId}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Generated at: ${exportedAt}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Record count: ${manifest.total_entries}`,
  });

  addSpacer(lines);
  lines.push({ font: "bold", size: 12, text: "Evidence metadata" });
  [
    "Generated from server-authoritative records within the selected family scope.",
    `Family ID: ${manifest.family_id}`,
    `Thread type: ${manifest.thread_type}`,
    `Record range: ${
      manifest.record_start ?? "Unavailable"
    } to ${manifest.record_end ?? "Unavailable"}`,
    `Canonical content hash (${receipt.canonical_hash_algorithm.toUpperCase()}):`,
  ].forEach((line) => lines.push({ font: "regular", size: 10, text: line }));
  pushWrappedLines(lines, receipt.canonical_content_hash, {
    font: "mono",
    maxChars: 64,
    size: 9,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Manifest hash: ${receipt.manifest_hash ?? "Unavailable"}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `JSON evidence package hash: ${receipt.artifact_hash ?? "Unavailable"}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Signing key ID: ${signingKeyId ?? "Unavailable"}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Receipt signature algorithm: ${signatureAlgorithm ?? "Unavailable"}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text:
      "The exact PDF artifact hash is stored in the server-signed export receipt and paired JSON evidence package after the final PDF bytes are generated.",
  });
  lines.push({
    font: "regular",
    size: 10,
    text:
      "This PDF does not contain an embedded Acrobat-style digital signature. Verification is performed against the stored server-signed export receipt.",
  });
  lines.push({
    font: "regular",
    size: 10,
    text:
      "This export is tamper-evident evidence support. It is not notarization, legal certification, or legal advice.",
  });

  addSpacer(lines);
  lines.push({ font: "bold", size: 12, text: "Recorded timeline" });
  packageData.canonicalPayload.entries.forEach((entry) => {
    addSpacer(lines);

    if (entry.kind === "system") {
      lines.push({
        font: "bold",
        size: 10,
        text: `${entry.timestamp} | ${entry.actor_name} | System event`,
      });
      pushWrappedLines(lines, entry.note, {
        font: "regular",
        maxChars: 84,
        prefix: "  ",
        size: 10,
      });
      return;
    }

    lines.push({
      font: "bold",
      size: 10,
      text: `${entry.timestamp} | ${entry.sender_name} | ${entry.sender_role_label}`,
    });
    pushWrappedLines(lines, entry.content, {
      font: "regular",
      maxChars: 84,
      prefix: "  ",
      size: 10,
    });
  });

  addSpacer(lines, 2);
  lines.push({ font: "bold", size: 12, text: "Export receipt summary" });
  [
    `Thread ID: ${manifest.thread_id}`,
    `Export format: ${manifest.export_format}`,
    `Messages: ${manifest.total_messages}`,
    `System events: ${manifest.total_system_events}`,
    `Integrity model: ${receipt.integrity_model_version}`,
    `Canonicalization: ${receipt.canonicalization_version}`,
  ].forEach((line) => lines.push({ font: "regular", size: 10, text: line }));

  lines.push({ font: "regular", size: 10, text: "Included message IDs:" });
  pushWrappedLines(lines, manifest.included_message_ids.join(", ") || "None", {
    font: "mono",
    maxChars: 72,
    prefix: "  ",
    size: 8,
  });
  lines.push({ font: "regular", size: 10, text: "Included system event IDs:" });
  pushWrappedLines(lines, manifest.included_system_event_ids.join(", ") || "None", {
    font: "mono",
    maxChars: 72,
    prefix: "  ",
    size: 8,
  });

  addSpacer(lines);
  lines.push({ font: "bold", size: 12, text: "Verification notes" });
  manifest.verification_notes.forEach((note) =>
    pushWrappedLines(lines, note, {
      font: "regular",
      maxChars: 86,
      prefix: "- ",
      size: 10,
    }),
  );

  return lines;
};

const paginatePdfLines = (lines: PdfLine[]) => {
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let currentY = PAGE_HEIGHT - PAGE_MARGIN_TOP;

  const pushCurrentPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    currentPage = [];
    currentY = PAGE_HEIGHT - PAGE_MARGIN_TOP;
  };

  lines.forEach((line) => {
    const height = line.text ? Math.max(line.size + 4, 12) : 8;
    if (currentY - height < PAGE_MARGIN_BOTTOM) {
      pushCurrentPage();
    }
    currentPage.push(line);
    currentY -= height;
  });

  pushCurrentPage();
  return pages.length > 0 ? pages : [[]];
};

const buildPdfContentStream = (pageLines: PdfLine[], pageIndex: number, pageCount: number, receiptId: string, canonicalHash: string) => {
  let currentY = PAGE_HEIGHT - PAGE_MARGIN_TOP;
  const operations: string[] = [];

  const emitText = (font: PdfFontKey, size: number, text: string, x = PAGE_MARGIN_LEFT) => {
    const fontName =
      font === "bold" ? "F2" : font === "mono" ? "F3" : "F1";
    operations.push(
      "BT",
      `/${fontName} ${size} Tf`,
      `${x} ${currentY} Td`,
      `(${sanitizePdfText(text)}) Tj`,
      "ET",
    );
  };

  pageLines.forEach((line) => {
    const height = line.text ? Math.max(line.size + 4, 12) : 8;
    if (line.text) {
      emitText(line.font, line.size, line.text);
    }
    currentY -= height;
  });

  const footerText = `Page ${pageIndex + 1} of ${pageCount} | Receipt ${receiptId.slice(0, 12)}... | Canonical hash ${canonicalHash.slice(0, 16)}...`;
  currentY = PAGE_MARGIN_BOTTOM - 4;
  emitText("regular", 8, footerText, PAGE_MARGIN_LEFT);

  return operations.join("\n");
};

const buildPdfDocumentBytes = (pages: string[]) => {
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const catalogObject = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObjectIndex = addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  const regularFontObject = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontObject = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const monoFontObject = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const pageObjectIndices: number[] = [];

  pages.forEach((contentStream) => {
    const contentObjectIndex = addObject(
      `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    );
    const pageObjectIndex = addObject(
      `<< /Type /Page /Parent ${pagesObjectIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontObject} 0 R /F2 ${boldFontObject} 0 R /F3 ${monoFontObject} 0 R >> >> /Contents ${contentObjectIndex} 0 R >>`,
    );
    pageObjectIndices.push(pageObjectIndex);
  });

  objects[pagesObjectIndex - 1] =
    `<< /Type /Pages /Kids [${pageObjectIndices.map((index) => `${index} 0 R`).join(" ")}] /Count ${pageObjectIndices.length} >>`;

  const buffer: string[] = ["%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n"];
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(buffer.join("").length);
    buffer.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = buffer.join("").length;
  buffer.push(`xref\n0 ${objects.length + 1}\n`);
  buffer.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    buffer.push(`${offset.toString().padStart(10, "0")} 00000 n \n`);
  });
  buffer.push(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return new TextEncoder().encode(buffer.join(""));
};

export const generateMessagingThreadExportPdf = (
  args: BuildMessagingThreadExportPdfArgs,
) => {
  const lines = buildPdfLines(args);
  const pages = paginatePdfLines(lines);
  const contentStreams = pages.map((pageLines, index) =>
    buildPdfContentStream(
      pageLines,
      index,
      pages.length,
      args.receiptId,
      args.packageData.contentHash,
    ),
  );

  return buildPdfDocumentBytes(contentStreams);
};
