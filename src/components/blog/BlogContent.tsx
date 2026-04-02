import { Fragment } from "react";

interface BlogContentProps {
  content: string;
}

const inlineTokenPattern =
  /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;

const renderInline = (text: string) => {
  const parts = text.split(inlineTokenPattern).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!match) return <Fragment key={`${part}-${index}`}>{part}</Fragment>;

      return (
        <a
          key={`${part}-${index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          {match[1]}
        </a>
      );
    }

    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return (
        <em key={`${part}-${index}`} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
};

export const BlogContent = ({ content }: BlogContentProps) => {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const nodes: JSX.Element[] = [];

  let index = 0;
  let paragraphCount = 0;

  const nextNonEmptyLine = (start: number) => {
    let cursor = start;
    while (cursor < lines.length && lines[cursor].trim() === "") {
      cursor += 1;
    }
    return cursor < lines.length ? lines[cursor].trim() : "";
  };

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^---+$/.test(line)) {
      nodes.push(
        <div key={`divider-${index}`} className="py-3">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>,
      );

      index += 1;
      continue;
    }

    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#+\s*/, "");

      if (level <= 2) {
        nodes.push(
          <h2
            key={`heading-${index}`}
            className="mt-12 border-t border-border/60 pt-8 text-[1.9rem] font-display font-semibold tracking-tight text-foreground first:mt-0 first:border-t-0 first:pt-0"
          >
            {text}
          </h2>
        );
      } else {
        nodes.push(
          <h3
            key={`heading-${index}`}
            className="mt-10 text-[1.35rem] font-display font-semibold tracking-tight text-foreground"
          >
            {text}
          </h3>
        );
      }

      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();

        if (!current) {
          if (/^\d+\.\s+/.test(nextNonEmptyLine(index + 1))) {
            index += 1;
            continue;
          }
          break;
        }

        if (!/^\d+\.\s+/.test(current)) break;

        items.push(current.replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      nodes.push(
        <ol key={`ordered-${index}`} className="space-y-3 my-6">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="flex items-start gap-4">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {itemIndex + 1}
              </span>
              <span className="text-base leading-8 text-foreground/90">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );

      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();

        if (!current) {
          if (/^[-*]\s+/.test(nextNonEmptyLine(index + 1))) {
            index += 1;
            continue;
          }
          break;
        }

        if (!/^[-*]\s+/.test(current)) break;

        items.push(current.replace(/^[-*]\s+/, ""));
        index += 1;
      }

      nodes.push(
        <ul key={`unordered-${index}`} className="space-y-3 my-6">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="flex items-start gap-3">
              <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="text-base leading-8 text-foreground/90">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );

      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();
        if (!current) {
          index += 1;
          break;
        }

        if (!current.startsWith(">")) {
          break;
        }

        quoteLines.push(current.replace(/^>\s?/, ""));
        index += 1;
      }

      nodes.push(
        <blockquote
          key={`quote-${index}`}
          className="my-8 rounded-[1.75rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(20,184,166,0.08))] px-5 py-4 text-[1.02rem] font-medium leading-8 text-foreground/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-6"
        >
          {renderInline(quoteLines.join(" "))}
        </blockquote>
      );

      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        current.startsWith("#") ||
        current.startsWith(">") ||
        /^---+$/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        /^[-*]\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    const paragraphText = paragraphLines.join(" ");
    const calloutMatch = paragraphText.match(/^(Note|Tip|Reminder|Key takeaway):\s*(.+)$/i);

    if (calloutMatch) {
      nodes.push(
        <div
          key={`callout-${index}`}
          className="my-8 rounded-[1.75rem] border border-accent/20 bg-accent/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-foreground/80">
            {calloutMatch[1]}
          </p>
          <p className="mt-2 text-[1.01rem] leading-8 text-foreground/88">
            {renderInline(calloutMatch[2])}
          </p>
        </div>,
      );

      continue;
    }

    paragraphCount += 1;
    nodes.push(
      <p
        key={`paragraph-${index}`}
        className={
          paragraphCount === 1
            ? "text-[1.16rem] leading-8 text-foreground/92 sm:text-[1.22rem]"
            : "text-[1.02rem] leading-8 text-foreground/88"
        }
      >
        {renderInline(paragraphText)}
      </p>
    );
  }

  return <div className="space-y-5">{nodes}</div>;
};
