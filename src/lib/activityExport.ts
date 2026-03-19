/**
 * Activity Export Utility
 * 
 * BRAND-CLEAN EXPORT REQUIREMENTS:
 * ================================
 * This output may be printed, shared with children, families, schools, or courts.
 * It MUST be 100% CoParrent-owned in appearance.
 * 
 * REMOVED (and must NEVER return):
 * - "coparrent.lovable.app" or any domain reference
 * - "Generated [date]" or any generation metadata
 * - Any footer text whatsoever
 * - Any watermark, hidden text, or print artifact
 * - Any reference to generation source, tool, or platform
 * 
 * ALLOWED:
 * - "CoParrent Creations" - header, once
 * - Activity content (title, steps, materials, etc.)
 * 
 * Extends the CoParrent Creations export system for Activity Generator.
 */

import jsPDF from 'jspdf';
import type { GeneratedActivity } from '@/hooks/useActivityGenerator';

// Brand color for CoParrent Creations header
const BRAND_COLOR: [number, number, number] = [33, 176, 254]; // #21B0FE
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const MUTED_TEXT: [number, number, number] = [100, 100, 100];
const ACCENT_BG: [number, number, number] = [240, 248, 255]; // Light blue

/**
 * Generate a professionally styled, brand-clean PDF for an activity
 * 
 * CRITICAL: No platform metadata, no dates, no domain references
 */
export async function generateActivityPdf(activity: GeneratedActivity): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 0;

  // ===== HEADER: "CoParrent Creations" - subtle, professional =====
  // Using subtle text instead of colored bar for cleaner look
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('CoParrent Creations', pageWidth / 2, 12, { align: 'center' });
  y = 22;

  // ===== TITLE + AGE RANGE =====
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(activity.title, pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(...MUTED_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ages ${activity.age_range}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // ===== QUICK FACTS ROW =====
  doc.setFillColor(...ACCENT_BG);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 3, 3, 'F');
  y += 5;

  const facts: string[] = [];
  if (activity.duration_minutes) facts.push(`⏱ ${activity.duration_minutes} min`);
  if (activity.indoor_outdoor) facts.push(`📍 ${capitalize(activity.indoor_outdoor)}`);
  if (activity.energy_level) facts.push(`⚡ ${capitalize(activity.energy_level)} energy`);
  if (activity.mess_level) facts.push(`🎨 ${capitalize(activity.mess_level)} mess`);
  if (activity.supervision_level) facts.push(`👀 ${capitalize(activity.supervision_level)} supervision`);

  doc.setFontSize(9);
  doc.setTextColor(...DARK_TEXT);
  const factsText = facts.join('   •   ');
  doc.text(factsText, pageWidth / 2, y + 5, { align: 'center' });
  y += 20;

  // ===== MATERIALS =====
  if (activity.materials && activity.materials.length > 0) {
    y = addSection(doc, 'Materials', y, margin, pageWidth);
    doc.setFontSize(10);
    doc.setTextColor(...DARK_TEXT);
    activity.materials.forEach((material, i) => {
      doc.text(`• ${material}`, margin + 5, y);
      y += 5;
    });
    y += 5;
  }

  // ===== STEPS =====
  if (activity.steps && activity.steps.length > 0) {
    y = addSection(doc, 'Steps', y, margin, pageWidth);
    doc.setFontSize(10);
    doc.setTextColor(...DARK_TEXT);
    activity.steps.forEach((step, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${step}`, pageWidth - margin * 2 - 10);
      lines.forEach((line: string) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin + 5, y);
        y += 5;
      });
    });
    y += 5;
  }

  // ===== VARIATIONS =====
  if (activity.variations && (activity.variations.easier || activity.variations.harder)) {
    y = addSection(doc, 'Variations', y, margin, pageWidth);
    doc.setFontSize(10);
    
    if (activity.variations.easier) {
      doc.setFont('helvetica', 'bold');
      doc.text('Easier:', margin + 5, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(activity.variations.easier, pageWidth - margin * 2 - 30);
      doc.text(lines, margin + 25, y);
      y += lines.length * 5 + 3;
    }
    
    if (activity.variations.harder) {
      doc.setFont('helvetica', 'bold');
      doc.text('Harder:', margin + 5, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(activity.variations.harder, pageWidth - margin * 2 - 30);
      doc.text(lines, margin + 25, y);
      y += lines.length * 5 + 3;
    }
    y += 5;
  }

  // ===== LEARNING GOALS =====
  if (activity.learning_goals && activity.learning_goals.length > 0) {
    y = addSection(doc, 'Learning Goals', y, margin, pageWidth);
    doc.setFontSize(10);
    doc.setTextColor(...DARK_TEXT);
    activity.learning_goals.forEach(goal => {
      doc.text(`• ${goal}`, margin + 5, y);
      y += 5;
    });
    y += 5;
  }

  // ===== SAFETY NOTES =====
  if (activity.safety_notes) {
    // Safety box with border
    doc.setDrawColor(255, 180, 0);
    doc.setFillColor(255, 250, 230);
    const safetyLines = doc.splitTextToSize(activity.safety_notes, pageWidth - margin * 2 - 20);
    const boxHeight = safetyLines.length * 5 + 12;
    
    if (y + boxHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    
    doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 3, 3, 'FD');
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 120, 0);
    doc.text('⚠️ Safety Notes', margin + 5, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_TEXT);
    doc.text(safetyLines, margin + 5, y);
  }

  // ===== NO FOOTER =====
  // REMOVED: "Generated: [date]" - no generation metadata allowed
  // REMOVED: "coparrent.lovable.app" - no domain references allowed

  // Save
  const filename = activity.title.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
  doc.save(`activity-${filename}.pdf`);
}

/**
 * Open a print-ready view for an activity - brand-clean output
 * 
 * CRITICAL: No platform metadata, no dates, no domain references
 */
export function openActivityPrintView(activity: GeneratedActivity): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to print.');
  }

  const factsHtml = [
    activity.duration_minutes && `<span>⏱ ${activity.duration_minutes} min</span>`,
    activity.indoor_outdoor && `<span>📍 ${capitalize(activity.indoor_outdoor)}</span>`,
    activity.energy_level && `<span>⚡ ${capitalize(activity.energy_level)} energy</span>`,
    activity.mess_level && `<span>🎨 ${capitalize(activity.mess_level)} mess</span>`,
    activity.supervision_level && `<span>👀 ${capitalize(activity.supervision_level)} supervision</span>`,
  ].filter(Boolean).join(' • ');

  const materialsHtml = activity.materials?.length 
    ? `<section><h2>Materials</h2><ul>${activity.materials.map(m => `<li>${m}</li>`).join('')}</ul></section>` 
    : '';

  const stepsHtml = activity.steps?.length 
    ? `<section><h2>Steps</h2><ol>${activity.steps.map(s => `<li>${s}</li>`).join('')}</ol></section>` 
    : '';

  const variationsHtml = (activity.variations?.easier || activity.variations?.harder)
    ? `<section><h2>Variations</h2>
        ${activity.variations.easier ? `<p><strong>Easier:</strong> ${activity.variations.easier}</p>` : ''}
        ${activity.variations.harder ? `<p><strong>Harder:</strong> ${activity.variations.harder}</p>` : ''}
       </section>`
    : '';

  const goalsHtml = activity.learning_goals?.length 
    ? `<section><h2>Learning Goals</h2><ul>${activity.learning_goals.map(g => `<li>${g}</li>`).join('')}</ul></section>` 
    : '';

  const safetyHtml = activity.safety_notes 
    ? `<section class="safety"><h2>⚠️ Safety Notes</h2><p>${activity.safety_notes}</p></section>` 
    : '';

  /**
   * PRINT-FIRST LAYOUT:
   * - Header: "CoParrent Creations" only - subtle
   * - Activity content takes priority
   * - NO footer, NO metadata, NO domain references
   */
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${activity.title} - CoParrent Creations</title>
      <style>
        /*
         * PRINT-FIRST CSS - BRAND-CLEAN
         * 
         * REMOVED (must never appear):
         * - Any domain/URL text
         * - Any "Generated" date text  
         * - Any footer whatsoever
         */
        
        @page { size: letter portrait; margin: 0.6in; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
          padding: 20px; 
          color: #1e1e1e; 
        }
        
        /* Header: "CoParrent Creations" - subtle, not a banner */
        .header { 
          color: #21B0FE;
          text-align: center; 
          font-size: 14px; 
          font-weight: 500;
          letter-spacing: 0.5px;
          margin-bottom: 20px; 
        }
        
        .title { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 5px; }
        .age { text-align: center; color: #666; margin-bottom: 15px; }
        .facts { background: #f0f8ff; padding: 10px 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; font-size: 14px; }
        section { margin-bottom: 20px; }
        h2 { font-size: 14px; color: #21B0FE; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
        ul, ol { margin-left: 20px; }
        li { margin-bottom: 5px; }
        .safety { background: #fffae6; border: 1px solid #ffb400; border-radius: 8px; padding: 15px; }
        .safety h2 { border: none; color: #b47800; }
        
        /* NO FOOTER - intentionally removed */
        
        @media print { 
          body { padding: 0; }
          .header { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          } 
        }
      </style>
    </head>
    <body>
      <!-- ONLY header text allowed -->
      <div class="header">CoParrent Creations</div>
      
      <div class="title">${activity.title}</div>
      <div class="age">Ages ${activity.age_range}</div>
      <div class="facts">${factsHtml}</div>
      ${materialsHtml}
      ${stepsHtml}
      ${variationsHtml}
      ${goalsHtml}
      ${safetyHtml}
      
      <!-- NO FOOTER - intentionally removed -->
      <!-- NO date, NO domain, NO metadata -->
      
      <script>
        window.onload = function() { 
          setTimeout(function() { 
            window.print(); 
            window.onafterprint = function() { window.close(); };
          }, 500); 
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function addSection(doc: jsPDF, title: string, y: number, margin: number, pageWidth: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_COLOR);
  doc.text(title, margin, y);
  
  doc.setDrawColor(...BRAND_COLOR);
  doc.line(margin, y + 2, margin + 30, y + 2);
  
  doc.setTextColor(...DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  return y + 8;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
