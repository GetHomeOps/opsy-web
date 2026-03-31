import React from "react";

/**
 * Renders plain text with basic Markdown support: **bold**, *italic*, `code`, newlines.
 * No external dependencies.
 *
 * Do not pre-escape as HTML entities (e.g. &#039;): React text nodes show those literals.
 * Plain string children are escaped by React when rendered.
 */
/**
 * Parse markdown-like text into React elements.
 * Handles **bold**, *italic*, `code`, and newlines.
 */
function parseMarkdown(text) {
  if (!text || typeof text !== "string") return null;
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // **bold** (prefer over single *)
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // *italic* (not followed by another *)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Newline -> <br />
    if (remaining.startsWith("\n")) {
      parts.push(<br key={key++} />);
      remaining = remaining.slice(1);
      continue;
    }

    // Take until next special character or end
    const nextSpecial = remaining.search(/\*\*|\*[^*]|\*$|`|\n/);
    const chunk =
      nextSpecial >= 0 ? remaining.slice(0, nextSpecial) : remaining;
    if (chunk) parts.push(chunk);
    remaining = nextSpecial >= 0 ? remaining.slice(nextSpecial) : "";
  }

  return parts.length === 1 && typeof parts[0] === "string"
    ? parts[0]
    : parts;
}

function MarkdownText({ children, className = "" }) {
  const content = parseMarkdown(children);
  if (content == null) return null;
  return (
    <span className={className}>
      {Array.isArray(content)
        ? content.map((c, i) =>
            typeof c === "string" || typeof c === "number" ? (
              c
            ) : (
              <React.Fragment key={i}>{c}</React.Fragment>
            )
          )
        : content}
    </span>
  );
}

export default MarkdownText;
