import { MistakeEntry } from '../types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes a field for CSV according to RFC 4180.
 * If field contains quotes, commas, or newlines, wraps in quotes and doubles inner quotes.
 */
export function escapeCsvField(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Generates Anki Front field containing:
 * - Section & Topic heading
 * - Question prompt (formatted with math/code)
 * - Diagram / image (if present)
 */
export function formatAnkiFront(m: MistakeEntry): string {
  const parts: string[] = [];
  const header = `[${m.sectionName || 'General'} • ${m.topic || 'General'}]`;
  parts.push(`<p><strong>${escapeHtml(header)}</strong></p>`);

  // Extract code blocks first to protect them from newline-to-br replacement
  const codeBlocks: string[] = [];
  let raw = escapeHtml(m.questionText || '');
  raw = raw.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return `___CODE_BLOCK_${idx}___`;
  });

  raw = raw.replace(/\n/g, '<br/>');

  // Restore code blocks
  codeBlocks.forEach((cb, idx) => {
    raw = raw.replace(`___CODE_BLOCK_${idx}___`, cb);
  });

  parts.push(`<div>${raw}</div>`);

  if (m.questionImage) {
    parts.push(`<div><img src="${m.questionImage}" alt="Question Image" /></div>`);
  }

  return parts.join('\n');
}

/**
 * Generates Anki Back field containing:
 * - Correct answer
 * - Detailed solution
 * - Better approach / shortcut
 * - Rule to remember
 */
export function formatAnkiBack(m: MistakeEntry): string {
  const parts: string[] = [];

  if (m.correctAnswer) {
    parts.push(`<div><strong>Correct Answer:</strong> ${escapeHtml(m.correctAnswer)}</div>`);
  }
  if (m.correctSolution) {
    const codeBlocks: string[] = [];
    let sol = escapeHtml(m.correctSolution);
    sol = sol.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_m, _l, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
      return `___CODE_BLOCK_${idx}___`;
    });
    sol = sol.replace(/\n/g, '<br/>');
    codeBlocks.forEach((cb, idx) => {
      sol = sol.replace(`___CODE_BLOCK_${idx}___`, cb);
    });
    parts.push(`<div style="margin-top:8px;"><strong>Solution:</strong><br/>${sol}</div>`);
  }
  if (m.betterApproach) {
    const app = escapeHtml(m.betterApproach).replace(/\n/g, '<br/>');
    parts.push(`<div style="margin-top:8px;"><strong>Approach / Shortcut:</strong><br/>${app}</div>`);
  }
  if (m.ruleToRemember) {
    parts.push(`<div style="margin-top:8px; color:#d97706;"><strong>Rule to Remember:</strong> ${escapeHtml(m.ruleToRemember)}</div>`);
  }

  return parts.join('\n');
}

/**
 * Exports review queue mistakes to Anki-compatible CSV string.
 * Columns: Front, Back, Tags.
 */
export function exportMistakesToAnkiCsv(mistakes: MistakeEntry[]): string {
  const headers = ['Front', 'Back', 'Tags'];
  const rows = [headers.map(escapeCsvField).join(',')];

  for (const m of mistakes) {
    const front = formatAnkiFront(m);
    const back = formatAnkiBack(m);
    const rawTags = ['StudyBridge', m.sectionName, m.topic, ...(m.tags || [])]
      .filter(Boolean)
      .map((t) => t.replace(/\s+/g, '_'));
    const tags = Array.from(new Set(rawTags)).join(' ');

    rows.push([escapeCsvField(front), escapeCsvField(back), escapeCsvField(tags)].join(','));
  }

  return rows.join('\r\n');
}

/**
 * Triggers a browser file download of the exported Anki CSV.
 */
export function downloadAnkiCsv(mistakes: MistakeEntry[], filename = 'studybridge-anki-deck.csv'): void {
  const csvContent = exportMistakesToAnkiCsv(mistakes);
  if (typeof window === 'undefined' || !window.Blob) return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
