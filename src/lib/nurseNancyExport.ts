/**
 * Nurse Nancy Chat Export Utility
 * 
 * Exports Nurse Nancy chat conversations as branded PDFs using the
 * CoParrent Creations header style.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { NurseNancyMessage, NurseNancyThread } from '@/hooks/useNurseNancy';

// Brand color for CoParrent Creations header
const BRAND_COLOR: [number, number, number] = [33, 176, 254]; // #21B0FE
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const MUTED_TEXT: [number, number, number] = [100, 100, 100];
const USER_BG: [number, number, number] = [33, 176, 254];
const ASSISTANT_BG: [number, number, number] = [245, 245, 245];

/**
 * Generate a PDF export of a Nurse Nancy conversation
 */
export async function generateNurseNancyPdf(
  thread: NurseNancyThread,
  messages: NurseNancyMessage[]
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 0;

  // ===== HEADER BAR =====
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CoParrent Creations', pageWidth / 2, 13, { align: 'center' });
  y = 28;

  // ===== TITLE =====
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nurse Nancy - ${thread.title}`, margin, y);
  y += 7;

  // ===== TIMESTAMP =====
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text(`Exported: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, y);
  y += 10;

  // ===== DISCLAIMER BOX =====
  doc.setFillColor(255, 250, 230);
  doc.setDrawColor(255, 180, 0);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 2, 2, 'FD');
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(180, 120, 0);
  doc.text('⚠️ This conversation is for educational reference only. Nurse Nancy does not provide', margin + 3, y + 2);
  doc.text('medical advice, diagnosis, or treatment. For emergencies, call 911.', margin + 3, y + 6);
  y += 18;

  // ===== MESSAGES =====
  const contentWidth = pageWidth - margin * 2;
  
  for (const message of messages) {
    // Skip system welcome message in export (it's already shown as disclaimer)
    if (message.role === 'system') continue;

    const isUser = message.role === 'user';
    const timestamp = format(new Date(message.created_at), 'h:mm a');
    
    // Parse message content (remove markdown)
    const cleanContent = message.content
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/•/g, '-'); // Replace bullets

    const lines = doc.splitTextToSize(cleanContent, contentWidth - 20);
    const boxHeight = lines.length * 4.5 + 10;

    // Check if we need a new page
    if (y + boxHeight > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }

    // Draw message bubble
    const bubbleX = isUser ? margin + 10 : margin;
    const bubbleWidth = contentWidth - 10;
    
    if (isUser) {
      doc.setFillColor(...USER_BG);
    } else {
      doc.setFillColor(...ASSISTANT_BG);
    }
    
    doc.roundedRect(bubbleX, y, bubbleWidth, boxHeight, 3, 3, 'F');

    // Sender label
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    if (isUser) {
      doc.setTextColor(255, 255, 255);
      doc.text('You', bubbleX + 4, y);
    } else {
      doc.setTextColor(...DARK_TEXT);
      doc.text('Nurse Nancy', bubbleX + 4, y);
    }
    
    // Timestamp
    doc.setFont('helvetica', 'normal');
    if (isUser) {
      doc.setTextColor(220, 220, 255);
    } else {
      doc.setTextColor(...MUTED_TEXT);
    }
    doc.text(timestamp, bubbleX + bubbleWidth - 4, y, { align: 'right' });
    y += 4;

    // Message content
    doc.setFontSize(9);
    if (isUser) {
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...DARK_TEXT);
    }
    doc.setFont('helvetica', 'normal');
    
    lines.forEach((line: string) => {
      doc.text(line, bubbleX + 4, y + 2);
      y += 4.5;
    });
    y += 5;
  }

  // ===== FOOTER =====
  // Jump to last page if we added pages
  const pageCount = doc.getNumberOfPages();
  doc.setPage(pageCount);
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Page ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text('CoParrent', pageWidth - margin, pageHeight - 10, { align: 'right' });

  // Save
  const filename = thread.title.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 30);
  doc.save(`nurse-nancy-${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

/**
 * Open a print-ready view for a Nurse Nancy conversation
 */
export function openNurseNancyPrintView(
  thread: NurseNancyThread,
  messages: NurseNancyMessage[]
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to print.');
  }

  const messagesHtml = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const isUser = m.role === 'user';
      const timestamp = format(new Date(m.created_at), 'h:mm a');
      const content = m.content
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      
      return `
        <div class="message ${isUser ? 'user' : 'assistant'}">
          <div class="meta">
            <span class="sender">${isUser ? 'You' : 'Nurse Nancy'}</span>
            <span class="time">${timestamp}</span>
          </div>
          <div class="content">${content}</div>
        </div>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Nurse Nancy - ${thread.title}</title>
      <style>
        @page { size: letter portrait; margin: 0.75in; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #1e1e1e; }
        .header { background: #21B0FE; color: white; text-align: center; padding: 12px 20px; font-size: 18px; font-weight: bold; border-radius: 4px; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .timestamp { font-size: 12px; color: #666; margin-bottom: 15px; }
        .disclaimer { background: #fffae6; border: 1px solid #ffb400; border-radius: 8px; padding: 10px 15px; font-size: 11px; color: #b47800; margin-bottom: 20px; }
        .messages { display: flex; flex-direction: column; gap: 12px; }
        .message { padding: 12px 15px; border-radius: 12px; max-width: 85%; }
        .message.user { background: #21B0FE; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .message.assistant { background: #f5f5f5; align-self: flex-start; border-bottom-left-radius: 4px; }
        .meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px; }
        .sender { font-weight: 600; }
        .message.user .time { color: rgba(255,255,255,0.8); }
        .message.assistant .time { color: #666; }
        .content { font-size: 13px; line-height: 1.4; }
        .footer { text-align: center; color: #888; font-size: 10px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; }
        @media print { .header, .message.user { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header">CoParrent Creations</div>
      <div class="title">Nurse Nancy - ${thread.title}</div>
      <div class="timestamp">Exported: ${format(new Date(), 'MMMM d, yyyy h:mm a')}</div>
      <div class="disclaimer">
        ⚠️ This conversation is for educational reference only. Nurse Nancy does not provide medical advice, diagnosis, or treatment. For emergencies, call 911.
      </div>
      <div class="messages">
        ${messagesHtml}
      </div>
      <div class="footer">CoParrent • ${format(new Date(), 'MMMM d, yyyy')}</div>
      <script>
        window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
