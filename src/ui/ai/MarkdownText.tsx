import React from 'react';

function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|22G101[-\d]*[^\s，,。、）\]]{0,20})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith('**') && m.endsWith('**')) {
      result.push(
        <strong key={key++} className="font-semibold text-white/90">
          {m.slice(2, -2)}
        </strong>
      );
    } else if (m.startsWith('`') && m.endsWith('`')) {
      result.push(
        <code key={key++} className="bg-black/40 px-1 rounded text-[11px] font-mono text-primary-fixed-dim">
          {m.slice(1, -1)}
        </code>
      );
    } else {
      result.push(
        <span key={key++} className="bg-amber-900/30 border border-amber-700/30 px-1 rounded-sm text-amber-300/90 text-[11px] font-mono">
          {m}
        </span>
      );
    }
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

interface Props {
  content: string;
}

export function MarkdownText({ content }: Props) {
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;
  let key = 0;
  let listBuffer: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const { type, items } = listBuffer;
    elements.push(
      type === 'ul' ? (
        <ul key={key++} className="list-disc list-inside space-y-0.5 my-1 text-on-surface-variant">
          {items}
        </ul>
      ) : (
        <ol key={key++} className="list-decimal list-inside space-y-0.5 my-1 text-on-surface-variant">
          {items}
        </ol>
      )
    );
    listBuffer = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      flushList();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} className="bg-black/40 border border-white/10 rounded-lg p-2.5 my-2 overflow-x-auto">
          <code className="text-[11px] font-mono text-primary-fixed-dim/90 leading-relaxed">
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <p key={key++} className="font-semibold text-white/90 mt-2 mb-0.5 text-sm">
          {parseInline(line.slice(3))}
        </p>
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <p key={key++} className="font-medium text-white/80 mt-1.5 mb-0.5 text-xs">
          {parseInline(line.slice(4))}
        </p>
      );
      i++;
      continue;
    }

    if (line.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={key++} className="border-l-2 border-primary-fixed-dim/40 pl-2 text-on-surface-variant italic my-1 text-xs">
          {parseInline(line.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    const ulMatch = line.match(/^[-*] (.*)/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(<li key={listBuffer.items.length}>{parseInline(ulMatch[1])}</li>);
      i++;
      continue;
    }

    const olMatch = line.match(/^\d+\. (.*)/);
    if (olMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(<li key={listBuffer.items.length}>{parseInline(olMatch[1])}</li>);
      i++;
      continue;
    }

    if (line.trim() === '') {
      flushList();
      i++;
      continue;
    }

    flushList();
    elements.push(
      <p key={key++} className="leading-relaxed">
        {parseInline(line)}
      </p>
    );
    i++;
  }

  flushList();

  return (
    <div className="text-[13px] text-on-surface space-y-0.5">
      {elements}
    </div>
  );
}
