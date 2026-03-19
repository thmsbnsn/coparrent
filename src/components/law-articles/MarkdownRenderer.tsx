import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  onHeadingsExtracted?: (headings: TocHeading[]) => void;
}

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

// Slugify text for anchor IDs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Simple, safe markdown renderer - no dangerouslySetInnerHTML
export const MarkdownRenderer = ({ content, onHeadingsExtracted }: MarkdownRendererProps) => {
  const { elements, headings } = useMemo(() => {
    const lines = content.split('\n');
    const result: JSX.Element[] = [];
    const extractedHeadings: TocHeading[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Headers with anchor IDs for H2/H3
      if (line.startsWith('######')) {
        result.push(<h6 key={key++} className="text-sm font-semibold mt-4 mb-2 text-foreground">{line.slice(6).trim()}</h6>);
      } else if (line.startsWith('#####')) {
        result.push(<h5 key={key++} className="text-sm font-semibold mt-4 mb-2 text-foreground">{line.slice(5).trim()}</h5>);
      } else if (line.startsWith('####')) {
        result.push(<h4 key={key++} className="text-base font-semibold mt-5 mb-2 text-foreground">{line.slice(4).trim()}</h4>);
      } else if (line.startsWith('###')) {
        const text = line.slice(3).trim();
        const id = slugify(text);
        extractedHeadings.push({ id, text, level: 3 });
        result.push(
          <h3 key={key++} id={id} className="text-lg font-semibold mt-6 mb-3 text-foreground scroll-mt-20">
            {text}
          </h3>
        );
      } else if (line.startsWith('##')) {
        const text = line.slice(2).trim();
        const id = slugify(text);
        extractedHeadings.push({ id, text, level: 2 });
        result.push(
          <h2 key={key++} id={id} className="text-xl font-semibold mt-8 mb-4 text-foreground border-b border-border pb-2 scroll-mt-20">
            {text}
          </h2>
        );
      } else if (line.startsWith('#')) {
        result.push(<h1 key={key++} className="text-2xl font-bold mt-8 mb-4 text-foreground">{line.slice(1).trim()}</h1>);
      }
      // Horizontal rule
      else if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        result.push(<hr key={key++} className="my-6 border-border" />);
      }
      // Blockquote
      else if (line.startsWith('>')) {
        result.push(
          <blockquote key={key++} className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground">
            {renderInlineFormatting(line.slice(1).trim())}
          </blockquote>
        );
      }
      // Unordered list
      else if (line.match(/^(\s*)[-*+]\s/)) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const text = line.replace(/^(\s*)[-*+]\s/, '');
        result.push(
          <li key={key++} className="ml-4 mb-1 text-foreground" style={{ marginLeft: `${indent * 0.5 + 1}rem` }}>
            {renderInlineFormatting(text)}
          </li>
        );
      }
      // Ordered list
      else if (line.match(/^(\s*)\d+\.\s/)) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const text = line.replace(/^(\s*)\d+\.\s/, '');
        result.push(
          <li key={key++} className="ml-4 mb-1 text-foreground list-decimal" style={{ marginLeft: `${indent * 0.5 + 1.5}rem` }}>
            {renderInlineFormatting(text)}
          </li>
        );
      }
      // Code block (simple - fenced) with mobile overflow handling
      else if (line.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        result.push(
          <pre key={key++} className="bg-muted p-4 rounded-lg my-4 overflow-x-auto text-sm">
            <code className="text-foreground">{codeLines.join('\n')}</code>
          </pre>
        );
      }
      // Empty line
      else if (line.trim() === '') {
        result.push(<div key={key++} className="h-2" />);
      }
      // Paragraph
      else {
        result.push(
          <p key={key++} className="mb-3 text-foreground leading-relaxed">
            {renderInlineFormatting(line)}
          </p>
        );
      }
    }

    return { elements: result, headings: extractedHeadings };
  }, [content]);

  // Notify parent of extracted headings
  useMemo(() => {
    if (onHeadingsExtracted && headings.length > 0) {
      onHeadingsExtracted(headings);
    }
  }, [headings, onHeadingsExtracted]);

  return (
    <div className="prose-custom max-w-none overflow-x-hidden [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_p]:break-words [&_li]:break-words">
      {elements}
    </div>
  );
};

// Helper to render inline formatting (bold, italic, code, links)
function renderInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text** or __text__
    const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1]);
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[3]}</strong>);
      remaining = boldMatch[4];
      continue;
    }

    // Italic *text* or _text_
    const italicMatch = remaining.match(/^(.*?)(\*|_)([^*_]+)\2(.*)$/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(italicMatch[1]);
      parts.push(<em key={key++} className="italic">{italicMatch[3]}</em>);
      remaining = italicMatch[4];
      continue;
    }

    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(codeMatch[1]);
      parts.push(
        <code key={key++} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
    if (linkMatch) {
      if (linkMatch[1]) parts.push(linkMatch[1]);
      parts.push(
        <a
          key={key++}
          href={linkMatch[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {linkMatch[2]}
        </a>
      );
      remaining = linkMatch[4];
      continue;
    }

    // No more matches, push remaining text
    parts.push(remaining);
    break;
  }

  return parts.length === 1 ? parts[0] : parts;
}
