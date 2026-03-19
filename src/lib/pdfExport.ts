import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { resolveChildName, resolvePersonName } from '@/lib/displayResolver';

interface Message {
  id: string;
  content: string;
  created_at: string;
  is_from_me: boolean;
}

interface Profile {
  full_name: string | null;
  email: string | null;
}

interface ScheduleConfig {
  pattern: string;
  startDate: Date;
  startingParent: string;
  exchangeTime: string;
  exchangeLocation: string;
  holidays: { name: string; rule: string; enabled: boolean }[];
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  expense_date: string;
  split_percentage: number | null;
  notes: string | null;
  child?: { name: string } | null;
  creator?: { full_name: string | null; email: string | null } | null;
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

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

function addHeader(doc: jsPDF, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header bar
  doc.setFillColor(33, 176, 254); // #21B0FE
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
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text('CoParrent - Court-Ready Documentation', 14, pageHeight - 10);
  doc.setTextColor(0, 0, 0);
}

export function exportMessagesToPDF(
  messages: Message[],
  userProfile: Profile | null,
  coParent: Profile | null
): void {
  const doc = new jsPDF();
  
  addHeader(doc, 'Communication Log');
  
  let yPosition = 35;
  
  // Parties information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Parties:', 14, yPosition);
  yPosition += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Party A: ${userProfile?.full_name || userProfile?.email || 'Unknown'}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Party B: ${coParent?.full_name || coParent?.email || 'Unknown'}`, 20, yPosition);
  yPosition += 10;
  
  // Message count summary
  doc.setFont('helvetica', 'bold');
  doc.text('Summary:', 14, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Messages: ${messages.length}`, 20, yPosition);
  yPosition += 5;
  
  if (messages.length > 0) {
    const firstDate = format(new Date(messages[0].created_at), 'MMM d, yyyy');
    const lastDate = format(new Date(messages[messages.length - 1].created_at), 'MMM d, yyyy');
    doc.text(`Date Range: ${firstDate} - ${lastDate}`, 20, yPosition);
  }
  yPosition += 15;
  
  // Messages table
  const tableData = messages.map((msg) => [
    format(new Date(msg.created_at), 'MMM d, yyyy h:mm a'),
    msg.is_from_me 
      ? (userProfile?.full_name || 'You') 
      : (coParent?.full_name || 'Co-Parent'),
    msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content
  ]);
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Date & Time', 'From', 'Message']],
    body: tableData,
    headStyles: {
      fillColor: [33, 176, 254],
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
      fillColor: [245, 247, 250],
    },
    didDrawPage: (data) => {
      // Add header on subsequent pages
      if (data.pageNumber > 1) {
        addHeader(doc, 'Communication Log (continued)');
      }
    },
  });
  
  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  doc.save(`messages-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportScheduleToPDF(
  config: ScheduleConfig,
  userProfile: Profile | null,
  coParent: Profile | null
): void {
  const doc = new jsPDF();
  
  addHeader(doc, 'Custody Schedule');
  
  let yPosition = 35;
  
  // Parties
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Parties:', 14, yPosition);
  yPosition += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Parent A: ${userProfile?.full_name || userProfile?.email || 'Unknown'}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Parent B: ${coParent?.full_name || coParent?.email || 'Unknown'}`, 20, yPosition);
  yPosition += 15;
  
  // Schedule Pattern
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Schedule Pattern:', 14, yPosition);
  yPosition += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Pattern: ${PATTERN_NAMES[config.pattern] || config.pattern}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Starting Parent: Parent ${config.startingParent}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Effective Date: ${format(new Date(config.startDate), 'MMMM d, yyyy')}`, 20, yPosition);
  yPosition += 15;
  
  // Exchange Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Exchange Details:', 14, yPosition);
  yPosition += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Exchange Time: ${config.exchangeTime || 'Not specified'}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Primary Location: ${config.exchangeLocation || 'Not specified'}`, 20, yPosition);
  yPosition += 15;
  
  // Holiday Schedule
  const enabledHolidays = config.holidays.filter(h => h.enabled);
  if (enabledHolidays.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Holiday Schedule:', 14, yPosition);
    yPosition += 6;
    
    const holidayData = enabledHolidays.map(h => {
      let ruleText = '';
      switch (h.rule) {
        case 'alternate': ruleText = 'Alternating Years'; break;
        case 'split': ruleText = 'Split Between Parents'; break;
        case 'fixed-a': ruleText = 'Always with Parent A'; break;
        case 'fixed-b': ruleText = 'Always with Parent B'; break;
        default: ruleText = h.rule;
      }
      return [h.name, ruleText];
    });
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Holiday', 'Arrangement']],
      body: holidayData,
      headStyles: {
        fillColor: [33, 176, 254],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });
  }
  
  // Add footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  doc.save(`custody-schedule-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportExpensesToPDF(
  expenses: Expense[],
  userProfile: Profile | null,
  coParent: Profile | null,
  dateRange?: { start: string; end: string }
): void {
  const doc = new jsPDF();
  const docWithAutoTable = doc as JsPdfWithAutoTable;
  
  addHeader(doc, 'Expense Report');
  
  let yPosition = 35;
  
  // Parties
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Parties:', 14, yPosition);
  yPosition += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Parent A: ${userProfile?.full_name || userProfile?.email || 'Unknown'}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Parent B: ${coParent?.full_name || coParent?.email || 'Unknown'}`, 20, yPosition);
  yPosition += 10;
  
  // Date range
  if (dateRange) {
    doc.text(`Report Period: ${format(new Date(dateRange.start), 'MMM d, yyyy')} - ${format(new Date(dateRange.end), 'MMM d, yyyy')}`, 20, yPosition);
    yPosition += 10;
  }
  
  // Summary
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary:', 14, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Expenses: $${totalAmount.toFixed(2)}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Number of Transactions: ${expenses.length}`, 20, yPosition);
  yPosition += 15;
  
  // Expenses table
  const tableData = expenses.map((exp) => [
    format(new Date(exp.expense_date), 'MMM d, yyyy'),
    CATEGORY_LABELS[exp.category] ?? 'Other',
    exp.description.length > 40 ? exp.description.substring(0, 40) + '...' : exp.description,
    `$${exp.amount.toFixed(2)}`,
    resolveChildName(exp.child?.name),
    resolvePersonName(exp.creator?.full_name)
  ]);
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Date', 'Category', 'Description', 'Amount', 'Child', 'Added By']],
    body: tableData,
    headStyles: {
      fillColor: [33, 176, 254],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 28 },
      2: { cellWidth: 50 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        addHeader(doc, 'Expense Report (continued)');
      }
    },
  });
  
  // Category breakdown
  const finalY = (docWithAutoTable.lastAutoTable?.finalY ?? yPosition) + 15;
  
  if (finalY < doc.internal.pageSize.getHeight() - 60) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Category Breakdown:', 14, finalY);
    
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    
    const breakdownData = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => [
        CATEGORY_LABELS[cat] || cat,
        `$${amount.toFixed(2)}`,
        `${((amount / totalAmount) * 100).toFixed(1)}%`
      ]);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Category', 'Total', 'Percentage']],
      body: breakdownData,
      headStyles: {
        fillColor: [33, 176, 254],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });
  }
  
  // Add footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  doc.save(`expenses-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
