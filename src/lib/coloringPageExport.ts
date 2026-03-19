/**
 * Coloring Page Export Utilities
 * 
 * BRAND-CLEAN EXPORT REQUIREMENTS:
 * ================================
 * - The generation prompt is INTERNAL ONLY - never shown on output
 * - No metadata, dates, or platform references on printed/PDF output
 * - Only "CoParrent Creations" header is allowed
 * 
 * Built on top of the shared CoParrent Creations export utility.
 */

import { 
  generateCreationsPdf, 
  openCreationsPrintView, 
  downloadCreationPng 
} from './creationsExport';

/**
 * Export coloring page to PDF with clean CoParrent Creations branding.
 * 
 * NOTE: The prompt parameter is used for filename only - it is NEVER
 * displayed on the exported PDF. This is intentional per brand requirements.
 */
export async function exportColoringPagePDF(
  imageUrl: string,
  prompt: string
): Promise<void> {
  // Prompt is used for filename generation only - never displayed
  const sanitizedPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
  
  return generateCreationsPdf({
    title: 'CoParrent Creations',
    // subtitle intentionally NOT passed - prompts are internal only
    imageDataUrl: imageUrl,
    filename: `${sanitizedPrompt}-coloring-page`,
  });
}

/**
 * Print coloring page with clean CoParrent Creations header.
 * 
 * NOTE: The prompt parameter is NOT displayed on the printed output.
 * Only "CoParrent Creations" header appears - per brand requirements.
 */
export function printColoringPage(imageUrl: string, prompt: string): void {
  openCreationsPrintView({
    title: 'CoParrent Creations',
    // subtitle intentionally NOT passed - prompts are internal only
    imageUrl,
    imageAlt: 'Coloring page',
  });
}

/**
 * Download coloring page as PNG.
 * 
 * PNG is just the raw image - no branding embedded.
 * Prompt is used for filename only.
 */
export function downloadColoringPagePNG(imageUrl: string, prompt: string): void {
  const sanitizedPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
  downloadCreationPng(imageUrl, `${sanitizedPrompt}-coloring-page`);
}
