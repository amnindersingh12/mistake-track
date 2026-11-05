import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { QuestionType } from '../../types';

export interface QuestionRendererProps {
  text: string;
  options?: string[];
  selectedOption?: string | string[];
  correctOption?: string | string[];
  questionType?: QuestionType;
  natAnswer?: number;
  correctNatAnswer?: { min: number; max: number } | number;
  natTolerance?: number;
  msqWrongOptions?: string[];
  msqMissedOptions?: string[];
  image?: string;
  solution?: string;
  showSolution?: boolean;
  className?: string;
  onOptionSelect?: (option: string) => void;
}

/**
 * Parses text containing inline $...$ or display $$...$$ math and code blocks.
 */
export function renderFormattedContent(raw: string): React.ReactNode {
  if (!raw) return null;

  // Split by code blocks first
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderTextWithMath(raw.substring(lastIndex, match.index), `txt-${lastIndex}`));
    }
    const lang = match[1] || 'code';
    const code = match[2];
    parts.push(
      <div key={`code-${match.index}`} className="my-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 p-3 overflow-x-auto font-mono text-sm">
        {lang && <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1">{lang}</div>}
        <pre className="whitespace-pre-wrap">{code}</pre>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push(renderTextWithMath(raw.substring(lastIndex), `txt-${lastIndex}`));
  }

  return parts;
}

function renderTextWithMath(text: string, keyPrefix: string): React.ReactNode {
  // Matches $$math$$ or $math$ or `inline code`
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|`[^`\n]+?`)/g;
  const tokens = text.split(tokenRegex);

  return (
    <span key={keyPrefix} className="whitespace-pre-wrap">
      {tokens.map((token, i) => {
        if (!token) return null;
        if (token.startsWith('$$') && token.endsWith('$$')) {
          const math = token.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <div key={`${keyPrefix}-${i}`} dangerouslySetInnerHTML={{ __html: html }} className="my-2 overflow-x-auto text-center" />;
          } catch {
            return <code key={`${keyPrefix}-${i}`} className="text-amber-400">{token}</code>;
          }
        }
        if (token.startsWith('$') && token.endsWith('$')) {
          const math = token.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={`${keyPrefix}-${i}`} dangerouslySetInnerHTML={{ __html: html }} className="inline-block px-0.5" />;
          } catch {
            return <code key={`${keyPrefix}-${i}`} className="text-amber-400">{token}</code>;
          }
        }
        if (token.startsWith('`') && token.endsWith('`')) {
          return (
            <code key={`${keyPrefix}-${i}`} className="px-1.5 py-0.5 mx-0.5 rounded bg-neutral-800 text-amber-300 font-mono text-xs">
              {token.slice(1, -1)}
            </code>
          );
        }
        return <span key={`${keyPrefix}-${i}`}>{token}</span>;
      })}
    </span>
  );
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  text,
  options = [],
  selectedOption,
  correctOption,
  questionType = 'MCQ',
  natAnswer,
  correctNatAnswer,
  natTolerance = 0,
  msqWrongOptions = [],
  msqMissedOptions = [],
  image,
  solution,
  showSolution = false,
  className = '',
  onOptionSelect
}) => {
  const selectedList = useMemo(() => {
    if (!selectedOption) return [];
    return Array.isArray(selectedOption) ? selectedOption : [selectedOption];
  }, [selectedOption]);

  const correctList = useMemo(() => {
    if (!correctOption) return [];
    return Array.isArray(correctOption) ? correctOption : [correctOption];
  }, [correctOption]);

  const formattedNatTarget = useMemo(() => {
    if (correctNatAnswer === undefined) return null;
    if (typeof correctNatAnswer === 'number') {
      if (natTolerance > 0) {
        return `${correctNatAnswer} (±${natTolerance})`;
      }
      return `${correctNatAnswer}`;
    }
    return `[${correctNatAnswer.min} to ${correctNatAnswer.max}]`;
  }, [correctNatAnswer, natTolerance]);

  return (
    <div className={`question-renderer flex flex-col gap-3 font-sans ${className}`}>
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-300">
          {questionType}
        </span>
        {questionType === 'MSQ' && (
          <span className="text-[11px] text-neutral-400 italic">Multiple choices may be correct (No partial marking)</span>
        )}
        {questionType === 'NAT' && (
          <span className="text-[11px] text-neutral-400 italic">Numerical Answer (Keypad entry)</span>
        )}
      </div>

      {/* Question Text */}
      <div className="text-base text-neutral-100 leading-relaxed font-medium">
        {renderFormattedContent(text)}
      </div>

      {/* Image if available */}
      {image && (
        <div className="my-2 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900/50 max-w-2xl">
          <img src={image} alt="Question Diagram" className="w-full h-auto object-contain max-h-96" />
        </div>
      )}

      {/* Options for MCQ / MSQ */}
      {(questionType === 'MCQ' || questionType === 'MSQ') && options.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {options.map((option, idx) => {
            const isSelected = selectedList.includes(option);
            const isCorrect = correctList.includes(option);
            const isWrongPick = msqWrongOptions.includes(option);
            const isMissed = msqMissedOptions.includes(option);

            let borderClass = 'border-neutral-700 bg-neutral-800/40 hover:bg-neutral-800/80';
            let badgeNode = null;

            if (showSolution) {
              if (isCorrect) {
                borderClass = 'border-emerald-500 bg-emerald-950/30 text-emerald-200';
                badgeNode = <span className="text-xs px-2 py-0.5 rounded bg-emerald-700 text-white font-bold ml-auto">Correct</span>;
              } else if (isSelected || isWrongPick) {
                borderClass = 'border-rose-500 bg-rose-950/30 text-rose-200';
                badgeNode = <span className="text-xs px-2 py-0.5 rounded bg-rose-700 text-white font-bold ml-auto">Wrong Pick</span>;
              }
            } else if (isSelected) {
              borderClass = 'border-blue-500 bg-blue-950/30 text-blue-200';
            }

            return (
              <div
                key={idx}
                onClick={() => onOptionSelect?.(option)}
                className={`p-3 rounded-lg border text-sm flex items-start gap-3 transition-colors ${onOptionSelect ? 'cursor-pointer' : ''} ${borderClass}`}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs bg-neutral-700 text-neutral-200 shrink-0">
                  {String.fromCharCode(65 + idx)}
                </div>
                <div className="flex-1 leading-snug pt-0.5">
                  {renderFormattedContent(option)}
                </div>
                {badgeNode}
                {showSolution && isMissed && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-700 text-white font-bold ml-auto">Missed</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* NAT Input / Results */}
      {questionType === 'NAT' && (
        <div className="my-2 p-3.5 rounded-lg border border-neutral-700 bg-neutral-800/50 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Your Answer:</span>
            <span className="font-mono text-sm font-bold text-neutral-100 px-3 py-1 bg-neutral-900 rounded border border-neutral-700">
              {natAnswer !== undefined ? natAnswer : selectedOption || 'Not entered'}
            </span>
          </div>
          {showSolution && formattedNatTarget && (
            <div className="flex items-center gap-3 pt-2 border-t border-neutral-700/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Correct Range:</span>
              <span className="font-mono text-sm font-bold text-emerald-300">
                {formattedNatTarget}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Solution Section */}
      {showSolution && solution && (
        <div className="mt-4 p-4 rounded-lg bg-neutral-900/90 border border-neutral-700/80">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
            <span>Solution & Explanation</span>
          </div>
          <div className="text-sm text-neutral-200 leading-relaxed">
            {renderFormattedContent(solution)}
          </div>
        </div>
      )}
    </div>
  );
};
