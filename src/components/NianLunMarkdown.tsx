import type { ReactNode } from "react";

function safeLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\x60[^\x60]+\x60|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const token = match[0];
    const key = keyPrefix + "-" + index++;
    if (token.startsWith("\x60")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = parts ? safeLink(parts[2]) : null;
      nodes.push(
        href ? (
          <a href={href} key={key} rel="noreferrer" target="_blank">
            {parts?.[1]}
          </a>
        ) : (
          <span key={key}>{parts?.[1] ?? token}</span>
        ),
      );
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function NianLunMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("\x60\x60\x60")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("\x60\x60\x60")) {
        code.push(lines[index++]);
      }
      index += 1;
      blocks.push(
        <pre key={"code-" + index} data-language={language}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[index + 1])
    ) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index++]));
      }
      blocks.push(
        <div className="nianlun-table-scroll" key={"table-" + index}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={cellIndex}>{inline(cell, "th-" + cellIndex)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{inline(cell, "td-" + rowIndex + "-" + cellIndex)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#{1,3}\s+/, "");
      blocks.push(
        level === 1 ? (
          <h3 key={"heading-" + index}>{inline(text, "h-" + index)}</h3>
        ) : (
          <h4 key={"heading-" + index}>{inline(text, "h-" + index)}</h4>
        ),
      );
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index++].replace(/^\s*[-*]\s+/, ""));
      }
      blocks.push(
        <ul key={"list-" + index}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item, "li-" + itemIndex)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={"quote-" + index}>
          {inline(line.slice(2), "quote-" + index)}
        </blockquote>,
      );
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3}\s|\x60\x60\x60|\s*[-*]\s+|> )/.test(lines[index])
    ) {
      if (lines[index].includes("|")) break;
      paragraph.push(lines[index++]);
    }
    blocks.push(
      <p key={"paragraph-" + index}>
        {inline(paragraph.join("\n"), "p-" + index)}
      </p>,
    );
  }

  return <div className="nianlun-markdown">{blocks}</div>;
}
