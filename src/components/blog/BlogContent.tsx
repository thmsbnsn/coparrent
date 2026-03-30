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

    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#+\s*/, "");

      if (level <= 2) {
        nodes.push(
          <h2 key={`heading-${index}`} className="text-2xl font-display font-semibold text-foreground mt-10 mb-4">
            {text}
          </h2>
        );
      } else {
        nodes.push(
          <h3 key={`heading-${index}`} className="text-xl font-display font-semibold text-foreground mt-8 mb-3">
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

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || current.startsWith("#") || /^\d+\.\s+/.test(current) || /^[-*]\s+/.test(current)) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="text-base leading-8 text-foreground/90">
        {renderInline(paragraphLines.join(" "))}
      </p>
    );
  }

  return <div className="space-y-1">{nodes}</div>;
};
