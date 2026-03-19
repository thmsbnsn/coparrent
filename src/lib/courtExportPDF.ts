import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { resolveDisplayValue, resolveChildName } from '@/lib/displayResolver';
import type { CourtExportData } from '@/hooks/useCourtExport';

const BRAND_COLOR: [number, number, number] = [33, 176, 254];
const ALT_ROW_COLOR: [number, number, number] = [245, 247, 250];

const PATTERN_NAMES: Record<string, string> = {
  "alternating-weeks": "Alternating Weeks",
  "2-2-3": "2-2-3 Rotation",
  "2-2-5-5": "2-2-5-5 Rotation",
  "3-4-4-3": "3-4-4-3 Rotation",
  "every-other-weekend": "Every Other Weekend",
  "custom": "Custom Pattern",
};

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  education: 'Education',
  childcare: 'Childcare',
  extracurricular: 'Extracurricular',
  clothing: 'Clothing',
  transportation: 'Transportation',
  food: 'Food & Meals',
  entertainment: 'Entertainment',
  other: 'Other',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  swap: 'Schedule Swap',
  trade: 'Day Trade',
  extend: 'Extended Time',
  reduce: 'Reduced Time',
  cancel: 'Cancellation',
  other: 'Other Request',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
};

// Journal entries are intentionally excluded from court exports to preserve privacy

const THREAD_TYPE_LABELS: Record<string, string> = {
  family_channel: 'Family Channel',
  direct_message: 'Direct Message',
  group_chat: 'Group Chat',
};

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header bar
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 17);
  
  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, pageWidth - 14, 17, { align: 'right' });
  
  if (subtitle) {
    doc.setTextColor(200, 230, 255);
    doc.setFontSize(9);
    doc.text(subtitle, 14, 22);
  }
  
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text('CoParrent - Court-Ready Documentation', 14, pageHeight - 10);
  doc.text('Generated for legal proceedings', pageWidth - 14, pageHeight - 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 33, 33);
  doc.text(title, 14, y);
  
  // Underline
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, 80, y + 2);
  
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

function addPartiesSection(doc: jsPDF, data: CourtExportData, y: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Parties Involved:', 14, y);
  y += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Party A: ${data.userProfile?.full_name || data.userProfile?.email || 'Unknown'}`, 20, y);
  y += 5;
  doc.text(`Party B: ${data.coParent?.full_name || data.coParent?.email || 'Not Connected'}`, 20, y);
  y += 5;
  
  if (data.children.length > 0) {
    doc.text(`Children: ${data.children.map(c => c.name).join(', ')}`, 20, y);
    y += 5;
  }
  
  y += 5;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Report Period:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${format(data.dateRange.start, 'MMMM d, yyyy')} — ${format(data.dateRange.end, 'MMMM d, yyyy')}`,
    20, y
  );
  
  return y + 15;
}

function addTableOfContents(doc: jsPDF, data: CourtExportData, y: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Contents:', 14, y);
  y += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const sections = [
    { name: 'Communication Log', count: data.messages.length },
    { name: 'Schedule Change Requests', count: data.scheduleRequests.length },
    { name: 'Exchange Check-ins', count: data.exchangeCheckins.length },
    { name: 'Document Access Logs', count: data.documentAccessLogs.length },
    { name: 'Expense Records', count: data.expenses.length },
    { name: 'Custody Schedule Overview', count: data.schedule ? 1 : 0 },
  ];
  
  sections.forEach(section => {
    const status = section.count > 0 ? `${section.count} records` : 'No records';
    doc.text(`• ${section.name}: ${status}`, 20, y);
    y += 5;
  });
  
  return y + 10;
}

function addMessagesSection(doc: jsPDF, data: CourtExportData, startY: number): number {
  if (data.messages.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No messages in the selected date range.', 20, startY);
    return startY + 15;
  }
  
  const tableData = data.messages.map((msg) => [
    format(new Date(msg.created_at), 'MMM d, yyyy h:mm a'),
    msg.sender_name || 'Unknown',
    THREAD_TYPE_LABELS[msg.thread_type] || msg.thread_type,
    msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content,
  ]);
  
  autoTable(doc, {
    startY,
    head: [['Date & Time', 'From', 'Channel', 'Message']],
    body: tableData,
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 32 },
      2: { cellWidth: 30 },
      3: { cellWidth: 80 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW_COLOR,
    },
  });
  
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

function addScheduleRequestsSection(doc: jsPDF, data: CourtExportData, startY: number): number {
  if (data.scheduleRequests.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No schedule change requests in the selected date range.', 20, startY);
    return startY + 15;
  }
  
  const tableData = data.scheduleRequests.map((req) => {
    const isRequester = req.requester_id === data.userProfile?.id;
    return [
      format(new Date(req.created_at), 'MMM d, yyyy'),
      REQUEST_TYPE_LABELS[req.request_type] || req.request_type,
      format(new Date(req.original_date), 'MMM d, yyyy'),
      req.proposed_date ? format(new Date(req.proposed_date), 'MMM d, yyyy') : '-',
      isRequester ? 'Party A' : 'Party B',
      STATUS_LABELS[req.status] || req.status,
    ];
  });
  
  autoTable(doc, {
    startY,
    head: [['Requested', 'Type', 'Original Date', 'Proposed Date', 'Requested By', 'Status']],
    body: tableData,
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 32 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 28 },
      5: { cellWidth: 22 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW_COLOR,
    },
  });
  
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

function addExchangeCheckinsSection(doc: jsPDF, data: CourtExportData, startY: number): number {
  if (data.exchangeCheckins.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No exchange check-ins in the selected date range.', 20, startY);
    return startY + 15;
  }
  
  const tableData = data.exchangeCheckins.map((checkin) => [
    format(new Date(checkin.exchange_date), 'MMM d, yyyy'),
    format(new Date(checkin.checked_in_at), 'h:mm a'),
    resolveDisplayValue(checkin.note, 'No notes'),
  ]);
  
  autoTable(doc, {
    startY,
    head: [['Exchange Date', 'Check-in Time', 'Note']],
    body: tableData,
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 35 },
      2: { cellWidth: 'auto' },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW_COLOR,
    },
  });
  
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

function addExpensesSection(doc: jsPDF, data: CourtExportData, startY: number): number {
  if (data.expenses.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No expenses in the selected date range.', 20, startY);
    return startY + 15;
  }
  
  // Summary
  const totalAmount = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Expenses: $${totalAmount.toFixed(2)} across ${data.expenses.length} transactions`, 20, startY);
  startY += 8;
  
  const tableData = data.expenses.map((exp) => [
    format(new Date(exp.expense_date), 'MMM d, yyyy'),
    CATEGORY_LABELS[exp.category] ?? 'Other',
    exp.description.length > 35 ? exp.description.substring(0, 35) + '...' : exp.description,
    `$${exp.amount.toFixed(2)}`,
    exp.split_percentage ? `${exp.split_percentage}%` : '50%',
    resolveChildName(exp.child?.name),
  ]);
  
  autoTable(doc, {
    startY,
    head: [['Date', 'Category', 'Description', 'Amount', 'Split', 'Child']],
    body: tableData,
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 28 },
      2: { cellWidth: 55 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 18 },
      5: { cellWidth: 25 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW_COLOR,
    },
  });
  
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

// Journal entries are intentionally excluded from court exports to preserve privacy

function addScheduleOverviewSection(doc: jsPDF, data: CourtExportData, startY: number): number {
  if (!data.schedule) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No custody schedule configured.', 20, startY);
    return startY + 15;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const details = [
    ['Pattern:', PATTERN_NAMES[data.schedule.pattern] || data.schedule.pattern],
    ['Effective Date:', format(new Date(data.schedule.start_date), 'MMMM d, yyyy')],
    ['Exchange Time:', data.schedule.exchange_time || 'Not specified'],
    ['Exchange Location:', data.schedule.exchange_location || 'Not specified'],
  ];
  
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, startY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 70, startY);
    startY += 6;
  });
  
  return startY + 10;
}

function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number = 60): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredSpace > pageHeight - 20) {
    doc.addPage();
    return 35;
  }
  return currentY;
}

const ACTION_LABELS: Record<string, string> = {
  upload: 'Uploaded',
  view: 'Viewed',
  download: 'Downloaded',
  delete: 'Deleted',
};

function addDocumentAccessLogsSection(doc: jsPDF, data: CourtExportData, startY: number): number {
  if (data.documentAccessLogs.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No document access logs in the selected date range.', 20, startY);
    return startY + 15;
  }
  
  const tableData = data.documentAccessLogs.map((log) => [
    format(new Date(log.created_at), 'MMM d, yyyy h:mm a'),
    log.document_title.length > 30 ? log.document_title.substring(0, 30) + '...' : log.document_title,
    ACTION_LABELS[log.action] || log.action,
    log.accessed_by_name || 'Unknown',
  ]);
  
  autoTable(doc, {
    startY,
    head: [['Date & Time', 'Document', 'Action', 'Accessed By']],
    body: tableData,
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { cellWidth: 40 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW_COLOR,
    },
  });
  
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

export function generateCourtReadyPDF(data: CourtExportData): void {
  const doc = new jsPDF();
  
  // Cover page
  addHeader(doc, 'Comprehensive Court-Ready Report', 'Co-Parenting Documentation Package');
  
  let y = 40;
  
  // Parties and date range
  y = addPartiesSection(doc, data, y);
  
  // Table of contents
  y = addTableOfContents(doc, data, y);
  
  // Legal disclaimer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  const disclaimer = 'This report contains records generated by CoParrent. All timestamps are automatically captured and records cannot be modified after creation. This documentation is provided for informational purposes and its admissibility in legal proceedings is subject to the rules of the relevant jurisdiction.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
  doc.text(splitDisclaimer, 14, y);
  doc.setTextColor(0, 0, 0);
  y += splitDisclaimer.length * 5 + 10;
  
  // Section 1: Messages
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, '1. Communication Log', y);
  y = addMessagesSection(doc, data, y);
  
  // Section 2: Schedule Requests
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, '2. Schedule Change Requests', y);
  y = addScheduleRequestsSection(doc, data, y);
  
  // Section 3: Exchange Check-ins
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, '3. Exchange Check-ins', y);
  y = addExchangeCheckinsSection(doc, data, y);
  
  // Section 4: Document Access Logs
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, '4. Document Access Logs', y);
  y = addDocumentAccessLogsSection(doc, data, y);
  
  // Section 5: Expenses
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, '5. Expense Records', y);
  y = addExpensesSection(doc, data, y);
  
  // Section 6: Schedule Overview (Journal entries excluded for privacy)
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, '6. Custody Schedule Overview', y);
  addScheduleOverviewSection(doc, data, y);
  
  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  // Save
  const fileName = `court-report-${format(data.dateRange.start, 'yyyy-MM-dd')}-to-${format(data.dateRange.end, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
