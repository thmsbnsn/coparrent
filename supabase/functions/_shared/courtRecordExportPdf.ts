import {
  type FamilyCourtRecordCallSessionEntry,
  type FamilyCourtRecordExportPackage,
} from "./courtRecordExportIntegrity.ts";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN_LEFT = 48;
const PAGE_MARGIN_RIGHT = 48;
const PAGE_MARGIN_TOP = 52;
const PAGE_MARGIN_BOTTOM = 44;

type PdfFontKey = "bold" | "mono" | "regular";

type PdfLine = {
  font: PdfFontKey;
  size: number;
  text: string;
};

interface BuildCourtRecordExportPdfArgs {
  packageData: FamilyCourtRecordExportPackage;
  receiptId: string;
  signingKeyId: string | null;
  signatureAlgorithm: string | null;
}

const FONT_REFERENCES = {
  bold: "/F2 10 Tf",
  mono: "/F3 9 Tf",
  regular: "/F1 10 Tf",
} as const;

const escapePdfText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
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

const describeCallSession = (session: FamilyCourtRecordCallSessionEntry) => {
  const participants = [
    session.initiator_display_name ?? "Caller",
    session.callee_display_name ?? "Recipient",
  ].join(" -> ");

  const eventSummary = session.events
    .map((event) => `${event.created_at} ${event.event_type}`)
    .join(" | ");

  return {
    header: `${session.created_at} | ${session.call_type.toUpperCase()} call | ${session.status}`,
    body: `${participants}. ${
      eventSummary || "No additional persisted call events."
    }`,
  };
};

const buildPdfLines = ({
  packageData,
  receiptId,
  signingKeyId,
  signatureAlgorithm,
}: BuildCourtRecordExportPdfArgs) => {
  const lines: PdfLine[] = [];
  const receipt = packageData.receipt;
  const manifest = packageData.manifest;
  const payload = packageData.canonicalPayload;

  lines.push({ font: "bold", size: 18, text: "CoParrent Court Record Export" });
  lines.push({
    font: "regular",
    size: 10,
    text: `Family ID: ${manifest.family_id}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Receipt ID: ${receiptId}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Generated at: ${manifest.export_generated_at}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Requested range: ${manifest.requested_range_start} to ${manifest.requested_range_end}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `Included sections: ${manifest.included_sections.join(", ") || "None"}`,
  });

  addSpacer(lines);
  lines.push({ font: "bold", size: 12, text: "Evidence metadata" });
  [
    "Generated from server-authoritative family records only.",
    "Call evidence is represented as persisted session and event history only. No recordings or transcripts are included.",
    "Raw document files are excluded. Document references and access history are included instead.",
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
    text: `Manifest hash: ${receipt.manifest_hash}`,
  });
  lines.push({
    font: "regular",
    size: 10,
    text: `JSON evidence package hash: ${receipt.artifact_hash}`,
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
      "This PDF does not contain an embedded Acrobat-style digital signature. Verification is performed against the stored server-signed receipt and immutable storage metadata.",
  });

  addSpacer(lines);
  lines.push({ font: "bold", size: 12, text: "Parties and children" });
  payload.parties.forEach((party) => {
    lines.push({
      font: "regular",
      size: 10,
      text: `${party.membership_role}: ${party.full_name ?? party.email ?? party.profile_id}`,
    });
  });
  if (payload.children.length === 0) {
    lines.push({ font: "regular", size: 10, text: "Children: None recorded." });
  } else {
    lines.push({
      font: "regular",
      size: 10,
      text: `Children: ${payload.children.map((child) => child.name).join(", ")}`,
    });
  }

  const sections: Array<{ label: string; records: string[] }> = [
    {
      label: "Messages",
      records:
        payload.messages.length === 0
          ? ["No messages in the selected range."]
          : payload.messages.map(
              (message) =>
                `${message.created_at} | ${message.sender_name} | ${
                  message.thread_name ?? message.thread_type
                } | ${message.content}`,
            ),
    },
    {
      label: "Call activity",
      records:
        payload.call_activity.length === 0
          ? ["No call sessions in the selected range."]
          : payload.call_activity.flatMap((session) => {
              const summary = describeCallSession(session);
              return [summary.header, `  ${summary.body}`];
            }),
    },
    {
      label: "Schedule requests",
      records:
        payload.schedule_requests.length === 0
          ? ["No schedule requests in the selected range."]
          : payload.schedule_requests.map(
              (request) =>
                `${request.created_at} | ${request.request_type} | ${request.status} | ${
                  request.requester_name ?? "Unknown"
                } -> ${request.recipient_name ?? "Unknown"}`,
            ),
    },
    {
      label: "Exchange check-ins",
      records:
        payload.exchange_checkins.length === 0
          ? ["No exchange check-ins in the selected range."]
          : payload.exchange_checkins.map(
              (checkin) =>
                `${checkin.exchange_date} | ${checkin.checked_in_at} | ${
                  checkin.user_name ?? "Unknown"
                } | ${checkin.note ?? "No note"}`,
            ),
    },
    {
      label: "Document references",
      records:
        payload.document_references.length === 0
          ? ["No document references in the selected range."]
          : payload.document_references.map(
              (document) =>
                `${document.created_at} | ${document.title} | ${document.category} | ${
                  document.uploaded_by_name ?? "Unknown uploader"
                }`,
            ),
    },
    {
      label: "Document access logs",
      records:
        payload.document_access_logs.length === 0
          ? ["No document access logs in the selected range."]
          : payload.document_access_logs.map(
              (log) =>
                `${log.created_at} | ${log.document_title} | ${log.action} | ${
                  log.accessed_by_name ?? "Unknown"
                }`,
            ),
    },
    {
      label: "Expenses",
      records:
        payload.expenses.length === 0
          ? ["No expenses in the selected range."]
          : payload.expenses.map(
              (expense) =>
                `${expense.expense_date} | ${expense.description} | $${expense.amount.toFixed(
                  2,
                )} | ${expense.category}`,
            ),
    },
    {
      label: "Schedule overview",
      records: payload.schedule_overview
        ? [
            `${payload.schedule_overview.start_date} | ${payload.schedule_overview.pattern} | ${
              payload.schedule_overview.exchange_time ?? "No exchange time"
            } | ${
              payload.schedule_overview.exchange_location ?? "No exchange location"
            }`,
          ]
        : ["No custody schedule overview is stored for this family."],
    },
  ];

  sections.forEach((section) => {
    addSpacer(lines, 2);
    lines.push({ font: "bold", size: 12, text: section.label });
    section.records.forEach((record) =>
      pushWrappedLines(lines, record, {
        font: "regular",
        maxChars: 88,
        size: 10,
      }),
    );
  });

  return lines;
};

const buildTextCommands = (lines: PdfLine[]) => {
  const commands: string[] = [];
  let currentY = PAGE_HEIGHT - PAGE_MARGIN_TOP;
  let currentFont: PdfFontKey = "regular";

  commands.push("BT");
  commands.push(`${PAGE_MARGIN_LEFT} ${currentY} Td`);

  lines.forEach((line, index) => {
    if (index > 0) {
      currentY -= line.text === "" ? 8 : line.size + 4;

      if (currentY < PAGE_MARGIN_BOTTOM) {
        commands.push("ET");
        commands.push("BT");
        currentY = PAGE_HEIGHT - PAGE_MARGIN_TOP;
        commands.push(`${PAGE_MARGIN_LEFT} ${currentY} Td`);
        currentFont = "regular";
      } else {
        commands.push(`0 -${line.text === "" ? 8 : line.size + 4} Td`);
      }
    }

    if (line.font !== currentFont) {
      commands.push(FONT_REFERENCES[line.font]);
      currentFont = line.font;
    } else if (index === 0) {
      commands.push(FONT_REFERENCES[line.font]);
      currentFont = line.font;
    }

    if (line.text !== "") {
      commands.push(`(${escapePdfText(line.text)}) Tj`);
    }
  });

  commands.push("ET");
  return commands.join("\n");
};

const createPdfDocument = (textCommands: string) => {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  const pageId = addObject(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
  );
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const monoFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const contentId = addObject(
    `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`,
  );

  const objectEntries = [
    { body: objects[catalogId - 1], id: catalogId },
    { body: objects[pagesId - 1], id: pagesId },
    { body: objects[pageId - 1], id: pageId },
    { body: objects[regularFontId - 1], id: regularFontId },
    { body: objects[boldFontId - 1], id: boldFontId },
    { body: objects[monoFontId - 1], id: monoFontId },
    { body: objects[contentId - 1], id: contentId },
  ];

  let output = "%PDF-1.4\n";
  const offsets = [0];

  objectEntries.forEach((entry) => {
    offsets.push(output.length);
    output += `${entry.id} 0 obj\n${entry.body}\nendobj\n`;
  });

  const xrefOffset = output.length;
  output += `xref\n0 ${offsets.length}\n`;
  output += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${offsets.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(output);
};

export const generateCourtRecordExportPdf = (
  args: BuildCourtRecordExportPdfArgs,
) => createPdfDocument(buildTextCommands(buildPdfLines(args)));
