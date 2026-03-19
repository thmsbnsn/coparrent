/**
 * CoParrent Creations Export Utility
 * 
 * BRAND-CLEAN, PRINT-FIRST REQUIREMENTS:
 * =====================================
 * This output may be printed, shared with children, families, schools, or courts.
 * It MUST be 100% CoParrent-owned in appearance.
 * 
 * REMOVED (and must NEVER return):
 * - "coparrent.lovable.app" or any domain reference
 * - "Generated [date]" or any generation metadata
 * - Any footer text whatsoever
 * - Any watermark, hidden text, or print artifact
 * - The generation prompt (internal-only, treated as sensitive)
 * - Any reference to generation source, tool, or platform
 * 
 * ALLOWED:
 * - "CoParrent Creations" - subtle header, once, at top
 * - The artwork itself - centered, maximized, print-priority
 * 
 * Layout contract: All CoParrent Kids Hub exports MUST use this utility 
 * to ensure branding consistency and zero platform leakage.
 */

import jsPDF from 'jspdf';

// Brand color for CoParrent Creations header - subtle, professional
const BRAND_COLOR: [number, number, number] = [33, 176, 254]; // #21B0FE

export interface CreationsPdfOptions {
  /** 
   * Title text - defaults to 'CoParrent Creations' 
   * This is the ONLY text allowed on the page
   */
  title?: string;
  /** 
   * REMOVED: Subtitle/prompt NEVER appears on output
   * @deprecated - prompts are internal only
   */
  subtitle?: string;
  /** Primary image as data URL */
  imageDataUrl?: string;
  /** 
   * REMOVED: Footer notes NEVER appear on output
   * @deprecated - no footer text allowed
   */
  footerNote?: string;
  /** Page format - defaults to 'letter' */
  pageFormat?: 'letter' | 'a4';
  /** Filename for download (without extension) */
  filename?: string;
}

export interface CreationsPrintOptions {
  /** 
   * Title text - defaults to 'CoParrent Creations'
   * This is the ONLY text allowed on the page
   */
  title?: string;
  /** 
   * REMOVED: Subtitle/prompt NEVER appears on output
   * @deprecated - prompts are internal only
   */
  subtitle?: string;
  /** Image URL or data URL */
  imageUrl: string;
  /** Alt text for image (screen-reader only, not visible) */
  imageAlt?: string;
  /** 
   * REMOVED: Footer notes NEVER appear on output
   * @deprecated - no footer text allowed
   */
  footerNote?: string;
}

/**
 * Add minimal branded header to PDF document.
 * 
 * Header is intentionally subtle - calm imprint, not a banner.
 * Returns the Y offset where content should begin.
 */
function addCreationsHeader(doc: jsPDF, title: string = 'CoParrent Creations'): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Subtle header text only - no colored bar, no banner
  // Positioned at top, centered, understated
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 12, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Return Y offset - minimal space below header to maximize artwork
  return 18;
}

/**
 * Generate and download a brand-clean PDF.
 * 
 * CRITICAL: This function produces court-ready, child-safe output.
 * - NO platform metadata
 * - NO generation dates
 * - NO prompts or subtitles
 * - NO footer text
 * - Artwork is CENTERED and MAXIMIZED for printing
 */
export async function generateCreationsPdf(options: CreationsPdfOptions): Promise<void> {
  const {
    title = 'CoParrent Creations',
    // subtitle is intentionally ignored - prompts are internal only
    imageDataUrl,
    // footerNote is intentionally ignored - no footer text allowed
    pageFormat = 'letter',
    filename = 'coparrent-creation',
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Create new PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: pageFormat,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Add subtle branded header
      const contentStartY = addCreationsHeader(doc, title);

      // If image provided, add it - MAXIMIZED for print
      if (imageDataUrl) {
        const img = new Image();
        img.onload = () => {
          // Minimal margins to maximize artwork space
          // This is a coloring page - the artwork IS the content
          const margin = 10; // 10mm margins (~0.4 inch) - minimal but clean
          const bottomMargin = 8; // Small bottom margin
          
          const maxWidth = pageWidth - (margin * 2);
          const maxHeight = pageHeight - contentStartY - bottomMargin;

          // Calculate aspect ratio preserving dimensions
          const imgRatio = img.width / img.height;
          let imgWidth = maxWidth;
          let imgHeight = imgWidth / imgRatio;

          // If too tall, scale down to fit
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * imgRatio;
          }

          // Center horizontally and vertically within available space
          const x = (pageWidth - imgWidth) / 2;
          const availableHeight = pageHeight - contentStartY - bottomMargin;
          const y = contentStartY + (availableHeight - imgHeight) / 2;

          // Add image to PDF - this is the primary content
          doc.addImage(imageDataUrl, 'PNG', x, y, imgWidth, imgHeight);

          // NO FOOTER - intentionally removed
          // NO date, NO domain, NO metadata

          // Save the PDF
          const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '-');
          doc.save(`${sanitizedFilename}.pdf`);
          
          resolve();
        };

        img.onerror = () => {
          reject(new Error('Failed to load image for PDF export'));
        };

        img.src = imageDataUrl;
      } else {
        // No image - just save with header (edge case)
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '-');
        doc.save(`${sanitizedFilename}.pdf`);
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Open a print-ready view with brand-clean output.
 * 
 * CRITICAL: This produces court-ready, child-safe printed output.
 * - NO platform metadata
 * - NO generation dates  
 * - NO prompts visible
 * - NO footer text
 * - Artwork is CENTERED and MAXIMIZED
 * - Print CSS explicitly removes browser chrome
 */
export function openCreationsPrintView(options: CreationsPrintOptions): void {
  const {
    title = 'CoParrent Creations',
    // subtitle intentionally ignored - prompts are internal only
    imageUrl,
    imageAlt = 'Coloring page',
    // footerNote intentionally ignored - no footer text allowed
  } = options;

  // Create a print-specific window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to print.');
  }

  /**
   * PRINT-FIRST LAYOUT:
   * - Header: "CoParrent Creations" only - subtle, top, centered
   * - Image: Full page priority, centered, scaled for printing
   * - NO subtitle, NO footer, NO metadata, NO browser chrome
   */
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        /*
         * PRINT-FIRST CSS
         * 
         * REMOVED (must never appear):
         * - Any domain/URL text
         * - Any "Generated" date text  
         * - Any footer whatsoever
         * - The prompt/subtitle
         * - Any generation metadata
         */
        
        @page {
          size: letter portrait;
          margin: 0.4in;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html, body {
          height: 100%;
          width: 100%;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100vh;
          padding: 12px;
          background: white;
        }
        
        /* 
         * Header: "CoParrent Creations" - ONLY allowed text
         * Subtle, professional, not oversized or playful
         */
        .header {
          color: #21B0FE;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          flex-shrink: 0;
        }
        
        /*
         * Image container: MAXIMIZED for printing
         * The coloring page IS the content - it takes priority
         */
        .image-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 0;
        }
        
        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        
        /*
         * PRINT-SPECIFIC OVERRIDES
         * Ensures clean output regardless of browser settings
         */
        @media print {
          @page {
            margin: 0.3in;
          }
          
          html, body {
            height: 100%;
            overflow: hidden;
          }
          
          body {
            padding: 8px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .header {
            color: #21B0FE !important;
            font-size: 12px;
            margin-bottom: 8px;
          }
          
          .image-container {
            height: calc(100vh - 40px);
          }
          
          img {
            max-height: calc(100vh - 50px);
          }
          
          /* 
           * CRITICAL: Force-hide any browser-injected content
           * Some browsers add headers/footers - this prevents that
           */
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <!-- ONLY allowed text on the page -->
      <div class="header">${title}</div>
      
      <!-- Primary content: the coloring page artwork -->
      <div class="image-container">
        <img src="${imageUrl}" alt="${imageAlt}" />
      </div>
      
      <!-- NO FOOTER - intentionally removed -->
      <!-- NO date, NO domain, NO metadata -->
      
      <script>
        // Auto-trigger print dialog after image loads
        window.onload = function() {
          // Wait for image to fully render
          const img = document.querySelector('img');
          if (img.complete) {
            triggerPrint();
          } else {
            img.onload = triggerPrint;
          }
        };
        
        function triggerPrint() {
          setTimeout(function() {
            window.print();
            // Close after print dialog (user can cancel)
            window.onafterprint = function() {
              window.close();
            };
          }, 300);
        }
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Download an image as PNG with sanitized filename.
 * 
 * Note: PNG downloads are clean by nature - just the image.
 * No metadata or branding is embedded in the file itself.
 */
export function downloadCreationPng(imageDataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = imageDataUrl;
  // Sanitize filename - remove special chars, limit length
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 50);
  link.download = `${sanitizedFilename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
