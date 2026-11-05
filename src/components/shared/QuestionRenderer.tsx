import React, { useState, useMemo, useEffect, Component, ErrorInfo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ZoomIn, ZoomOut, RotateCcw, X, Copy, Check, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { QuestionType } from '../../types';
import { normalizeOptions } from '../../utils/normalizeOptions';

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
  onNatAnswerChange?: (val: number | undefined) => void;
  isInteractive?: boolean;
}

// ==========================================
// Robust Math & Render Error Boundary
// ==========================================
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class QuestionRendererErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[QuestionRenderer] Caught rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-3 my-2 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs font-mono">
            <span>[Content render error: {this.state.error?.message || 'Unable to display formula'}]</span>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ==========================================
// NAT Answer Checking & Range Helper
// ==========================================
export interface NatCheckResult {
  isCorrect: boolean;
  userValue?: number;
  targetMin: number;
  targetMax: number;
  formattedRange: string;
}

export function checkNatAnswer(
  userVal: number | string | undefined,
  correctNatAnswer: { min: number; max: number } | number | undefined,
  tolerance: number = 0
): NatCheckResult | null {
  if (correctNatAnswer === undefined || correctNatAnswer === null) return null;

  let targetMin = 0;
  let targetMax = 0;
  let formattedRange = '';

  if (typeof correctNatAnswer === 'number') {
    const tol = Math.max(0, Number(tolerance) || 0);
    targetMin = correctNatAnswer - tol;
    targetMax = correctNatAnswer + tol;
    formattedRange = tol > 0
      ? `${correctNatAnswer} (±${tol}) → [${targetMin} to ${targetMax}]`
      : `${correctNatAnswer}`;
  } else if (typeof correctNatAnswer === 'object' && correctNatAnswer !== null) {
    targetMin = correctNatAnswer.min;
    targetMax = correctNatAnswer.max;
    formattedRange = `[${targetMin} to ${targetMax}]`;
  }

  const parsedUser = typeof userVal === 'number'
    ? userVal
    : userVal !== undefined && userVal !== '' && !isNaN(Number(userVal))
    ? Number(userVal)
    : undefined;

  const isCorrect = parsedUser !== undefined
    ? (parsedUser >= targetMin && parsedUser <= targetMax)
    : false;

  return {
    isCorrect,
    userValue: parsedUser,
    targetMin,
    targetMax,
    formattedRange
  };
}

// ==========================================
// Syntax Highlighting for CS Code Blocks
// ==========================================
const CS_KEYWORDS = new Set([
  'def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while', 'in', 'import', 'from',
  'as', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'break', 'continue', 'pass',
  'const', 'let', 'var', 'function', 'async', 'await', 'new', 'typeof', 'interface', 'type',
  'int', 'float', 'double', 'char', 'void', 'bool', 'boolean', 'struct', 'union', 'enum',
  'typedef', 'sizeof', 'public', 'private', 'protected', 'static', 'virtual', 'delete',
  'null', 'nullptr', 'undefined', 'true', 'false', 'None', 'True', 'False',
  'select', 'from', 'where', 'join', 'group', 'by', 'order', 'having', 'insert', 'update',
  'delete', 'create', 'table', 'drop', 'alter', 'and', 'or', 'not', 'distinct'
]);

function tokenizeLine(line: string): React.ReactNode[] {
  if (!line) return [' '];

  // Check for line comment
  const commentIdx = (() => {
    // Check //, #, --
    const doubleSlash = line.indexOf('//');
    const hash = line.indexOf('#');
    const dashDash = line.indexOf('--');
    const indices = [doubleSlash, hash, dashDash].filter(i => i !== -1);
    return indices.length > 0 ? Math.min(...indices) : -1;
  })();

  let codePart = line;
  let commentPart = '';
  if (commentIdx !== -1) {
    codePart = line.substring(0, commentIdx);
    commentPart = line.substring(commentIdx);
  }

  // Regex to split code part into words, numbers, strings, and operators
  const tokenRegex = /(".*?"|'.*?'|`.*?`|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_]\w*\b|[^\s\w"']+|\s+)/g;
  const parts: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(codePart)) !== null) {
    const token = match[0];
    const key = `t-${keyIdx++}`;

    if (/^["'`]/.test(token)) {
      // String literal
      parts.push(<span key={key} className="text-emerald-400">{token}</span>);
    } else if (/^\d/.test(token)) {
      // Number literal
      parts.push(<span key={key} className="text-amber-300 font-semibold">{token}</span>);
    } else if (CS_KEYWORDS.has(token.toLowerCase())) {
      // Keyword
      parts.push(<span key={key} className="text-sky-400 font-bold">{token}</span>);
    } else if (/^[a-zA-Z_]/.test(token) && codePart[match.index + token.length] === '(') {
      // Function call
      parts.push(<span key={key} className="text-indigo-300">{token}</span>);
    } else {
      parts.push(<span key={key}>{token}</span>);
    }
  }

  if (commentPart) {
    parts.push(
      <span key={`c-${keyIdx++}`} className="text-neutral-500 italic">
        {commentPart}
      </span>
    );
  }

  return parts;
}

export const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang = 'code' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = useMemo(() => code.split('\n'), [code]);

  return (
    <div className="my-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-neutral-900 border-b border-neutral-800 text-xs">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors px-2 py-0.5 rounded bg-neutral-800/80 hover:bg-neutral-800 cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto font-mono text-xs sm:text-sm leading-relaxed">
        <div className="table w-full">
          {lines.map((line, idx) => (
            <div key={idx} className="table-row">
              <span className="table-cell select-none pr-4 text-right text-neutral-600 text-[11px] font-mono align-top w-8">
                {idx + 1}
              </span>
              <span className="table-cell whitespace-pre align-top text-neutral-200">
                {tokenizeLine(line)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Formatted Content: KaTeX Math + Code Blocks
// ==========================================
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
    parts.push(<CodeBlock key={`cb-${match.index}`} code={code} lang={lang} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push(renderTextWithMath(raw.substring(lastIndex), `txt-${lastIndex}`));
  }

  return <QuestionRendererErrorBoundary>{parts}</QuestionRendererErrorBoundary>;
}

function renderTextWithMath(text: string, keyPrefix: string): React.ReactNode {
  // Matches $$math$$ or $math$ or `inline code`
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|`[^`\n]+?`)/g;
  const tokens = text.split(tokenRegex);

  return (
    <span key={keyPrefix} className="whitespace-pre-wrap leading-relaxed">
      {tokens.map((token, i) => {
        if (!token) return null;
        const subKey = `${keyPrefix}-${i}`;

        // Display math: $$...$$
        if (token.startsWith('$$') && token.endsWith('$$') && token.length >= 4) {
          const math = token.slice(2, -2).trim();
          try {
            const html = katex.renderToString(math, {
              displayMode: true,
              throwOnError: false
            });
            return (
              <div
                key={subKey}
                dangerouslySetInnerHTML={{ __html: html }}
                className="my-3 overflow-x-auto py-1 text-center text-base sm:text-lg select-text text-neutral-100"
              />
            );
          } catch (err) {
            return (
              <code key={subKey} className="text-amber-400 font-mono text-xs px-1.5 py-0.5 rounded bg-neutral-900 border border-amber-500/30">
                {token}
              </code>
            );
          }
        }

        // Inline math: $...$
        if (token.startsWith('$') && token.endsWith('$') && token.length >= 2) {
          const math = token.slice(1, -1).trim();
          try {
            const html = katex.renderToString(math, {
              displayMode: false,
              throwOnError: false
            });
            return (
              <span
                key={subKey}
                dangerouslySetInnerHTML={{ __html: html }}
                className="inline-block px-0.5 align-middle select-text text-neutral-100"
              />
            );
          } catch (err) {
            return (
              <code key={subKey} className="text-amber-400 font-mono text-xs px-1 py-0.2 rounded bg-neutral-900 border border-amber-500/30">
                {token}
              </code>
            );
          }
        }

        // Inline code: `...`
        if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
          return (
            <code
              key={subKey}
              className="px-1.5 py-0.5 mx-0.5 rounded-md bg-neutral-800 text-amber-300 font-mono text-xs border border-neutral-700/60 inline-block font-semibold"
            >
              {token.slice(1, -1)}
            </code>
          );
        }

        return <span key={subKey}>{token}</span>;
      })}
    </span>
  );
}

// Option matching helper
function isOptionMatched(optText: string, optIndex: number, candidates: string[]): boolean {
  if (!candidates || candidates.length === 0) return false;
  const label = String.fromCharCode(65 + optIndex).toLowerCase(); // 'a', 'b', ...
  const optClean = optText.trim().toLowerCase();

  return candidates.some((cand) => {
    const c = (cand || '').trim().toLowerCase();
    if (!c) return false;
    if (c === optClean) return true;
    if (c === label) return true;
    if (c === `option ${label}`) return true;
    if (c === `(${label})`) return true;
    if (c === `${label}.`) return true;
    if (optClean.includes(c) || c.includes(optClean)) return true;
    return false;
  });
}

// ==========================================
// Main QuestionRenderer Component
// ==========================================
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
  onOptionSelect,
  onNatAnswerChange,
  isInteractive = false
}) => {
  // Lightbox Zoom state for question diagrams
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Close zoom modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomOpen) {
        setIsZoomOpen(false);
        setZoomLevel(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen]);

  // Normalize options (2 to 5 options) via normalizeOptions
  const normalizedOptions = useMemo(() => {
    if (!options || options.length === 0) return [];
    const normalized = normalizeOptions(options);
    return normalized.options;
  }, [options]);

  const selectedList = useMemo(() => {
    if (!selectedOption) return [];
    return Array.isArray(selectedOption) ? selectedOption : [selectedOption];
  }, [selectedOption]);

  const correctList = useMemo(() => {
    if (!correctOption) return [];
    return Array.isArray(correctOption) ? correctOption : [correctOption];
  }, [correctOption]);

  // NAT evaluation
  const natCheck = useMemo(() => {
    if (questionType !== 'NAT' || correctNatAnswer === undefined) return null;
    const userVal = natAnswer !== undefined ? natAnswer : selectedOption;
    return checkNatAnswer(userVal as any, correctNatAnswer, natTolerance);
  }, [questionType, correctNatAnswer, natTolerance, natAnswer, selectedOption]);

  // MSQ computed wrong & missed options
  const computedMsqWrong = useMemo(() => {
    if (questionType !== 'MSQ') return [];
    if (msqWrongOptions && msqWrongOptions.length > 0) return msqWrongOptions;
    // Calculate wrong picks from selectedList that are not in correctList
    return selectedList.filter(
      (sel) => !normalizedOptions.some((opt, idx) => isOptionMatched(opt, idx, [sel]) && isOptionMatched(opt, idx, correctList))
    );
  }, [questionType, msqWrongOptions, selectedList, correctList, normalizedOptions]);

  const computedMsqMissed = useMemo(() => {
    if (questionType !== 'MSQ') return [];
    if (msqMissedOptions && msqMissedOptions.length > 0) return msqMissedOptions;
    // Calculate missed picks from correctList that are not in selectedList
    return correctList.filter(
      (corr) => !normalizedOptions.some((opt, idx) => isOptionMatched(opt, idx, [corr]) && isOptionMatched(opt, idx, selectedList))
    );
  }, [questionType, msqMissedOptions, selectedList, correctList, normalizedOptions]);

  return (
    <QuestionRendererErrorBoundary>
      <div className={`question-renderer flex flex-col gap-3 font-sans ${className}`}>
        {/* Question Type & Guidance Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-200 shadow-sm">
            {questionType === 'MCQ' && 'MCQ (Single Choice)'}
            {questionType === 'MSQ' && 'MSQ (Multiple Select)'}
            {questionType === 'NAT' && 'NAT (Numerical Answer)'}
            {questionType === 'descriptive' && 'Descriptive / Subjective'}
          </span>

          {questionType === 'MSQ' && (
            <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>One or more options correct • No partial marking</span>
            </span>
          )}

          {questionType === 'NAT' && (
            <span className="text-[11px] text-sky-400 font-medium">
              Virtual keypad numeric value • Checked within tolerance
            </span>
          )}
        </div>

        {/* Question Statement Text (with KaTeX & Code Blocks) */}
        <div className="text-sm sm:text-base text-neutral-100 leading-relaxed font-medium">
          {renderFormattedContent(text)}
        </div>

        {/* Question Diagram with Zoom Preview Capability */}
        {image && (
          <div className="relative group my-2 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950/60 max-w-2xl">
            <img
              src={image}
              alt="Question Diagram"
              className="w-full h-auto object-contain max-h-96 rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setIsZoomOpen(true);
                }}
                className="pointer-events-auto px-3.5 py-2 rounded-xl bg-neutral-900/90 text-white font-bold text-xs border border-neutral-600 shadow-lg flex items-center gap-2 hover:bg-neutral-800 cursor-pointer"
                title="Zoom Diagram"
              >
                <ZoomIn className="w-4 h-4 text-sky-400" />
                <span>Click to Zoom Diagram</span>
              </button>
            </div>
          </div>
        )}

        {/* Options for MCQ and MSQ */}
        {(questionType === 'MCQ' || questionType === 'MSQ') && normalizedOptions.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {normalizedOptions.map((option, idx) => {
              const optLabel = String.fromCharCode(65 + idx);
              const isSelected = isOptionMatched(option, idx, selectedList);
              const isCorrect = isOptionMatched(option, idx, correctList);
              const isWrongPick = isOptionMatched(option, idx, computedMsqWrong) || (questionType === 'MCQ' && isSelected && !isCorrect);
              const isMissed = isOptionMatched(option, idx, computedMsqMissed) || (questionType === 'MSQ' && isCorrect && !isSelected);

              let containerClass = 'border-neutral-700 bg-neutral-800/40 hover:bg-neutral-800/70 text-neutral-200';
              let badgeNode: React.ReactNode = null;

              if (showSolution) {
                if (questionType === 'MSQ') {
                  if (isSelected && isCorrect) {
                    // Correctly picked
                    containerClass = 'border-emerald-500 bg-emerald-950/40 text-emerald-100 shadow-sm';
                    badgeNode = (
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white font-bold flex items-center gap-1 shrink-0 ml-auto">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Correct Pick</span>
                      </span>
                    );
                  } else if (isWrongPick) {
                    // Wrongly selected by candidate
                    containerClass = 'border-rose-500 bg-rose-950/40 text-rose-100 shadow-sm';
                    badgeNode = (
                      <span className="text-xs px-2.5 py-1 rounded bg-rose-600 text-white font-bold flex items-center gap-1 shrink-0 ml-auto">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Wrong Pick</span>
                      </span>
                    );
                  } else if (isMissed) {
                    // Correct option missed by candidate
                    containerClass = 'border-amber-500 bg-amber-950/40 text-amber-100 shadow-sm';
                    badgeNode = (
                      <span className="text-xs px-2.5 py-1 rounded bg-amber-600 text-white font-bold flex items-center gap-1 shrink-0 ml-auto">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Missed Option</span>
                      </span>
                    );
                  } else {
                    containerClass = 'border-neutral-800 bg-neutral-900/30 text-neutral-400 opacity-80';
                  }
                } else {
                  // MCQ
                  if (isCorrect) {
                    containerClass = 'border-emerald-500 bg-emerald-950/40 text-emerald-100 shadow-sm';
                    badgeNode = (
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white font-bold flex items-center gap-1 shrink-0 ml-auto">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Correct</span>
                      </span>
                    );
                  } else if (isSelected) {
                    containerClass = 'border-rose-500 bg-rose-950/40 text-rose-100 shadow-sm';
                    badgeNode = (
                      <span className="text-xs px-2.5 py-1 rounded bg-rose-600 text-white font-bold flex items-center gap-1 shrink-0 ml-auto">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Wrong Pick</span>
                      </span>
                    );
                  } else {
                    containerClass = 'border-neutral-800 bg-neutral-900/30 text-neutral-400 opacity-80';
                  }
                }
              } else if (isSelected) {
                containerClass = 'border-sky-500 bg-sky-950/40 text-sky-100 shadow-sm';
              }

              return (
                <div
                  key={optLabel}
                  onClick={() => onOptionSelect?.(option)}
                  className={`p-3 rounded-xl border text-sm flex items-start gap-3 transition-colors ${
                    onOptionSelect ? 'cursor-pointer hover:border-neutral-500' : ''
                  } ${containerClass}`}
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                      isCorrect && showSolution
                        ? 'bg-emerald-600 text-white'
                        : isWrongPick && showSolution
                        ? 'bg-rose-600 text-white'
                        : isSelected
                        ? 'bg-sky-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                    }`}
                  >
                    {optLabel}
                  </div>
                  <div className="flex-1 leading-snug pt-0.5">
                    {renderFormattedContent(option)}
                  </div>
                  {badgeNode}
                </div>
              );
            })}
          </div>
        )}

        {/* NAT Numerical Answer Section with Tolerance Checking */}
        {questionType === 'NAT' && (
          <div className="my-2 p-4 rounded-xl border border-neutral-700 bg-neutral-900/70 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Your Answer:
                </span>
                {isInteractive && onNatAnswerChange ? (
                  <input
                    type="number"
                    step="any"
                    value={natAnswer !== undefined ? natAnswer : ''}
                    onChange={(e) => onNatAnswerChange(e.target.value !== '' ? Number(e.target.value) : undefined)}
                    placeholder="Enter numerical value"
                    className="font-mono text-sm font-bold text-neutral-100 px-3 py-1 bg-neutral-950 rounded border border-neutral-700 w-44 focus:outline-none focus:border-sky-500"
                  />
                ) : (
                  <span className="font-mono text-sm font-bold text-neutral-100 px-3 py-1 bg-neutral-950 rounded border border-neutral-700">
                    {natAnswer !== undefined ? natAnswer : selectedOption || 'Not entered'}
                  </span>
                )}
              </div>

              {showSolution && natCheck && (
                <div>
                  {natCheck.isCorrect ? (
                    <span className="text-xs px-3 py-1 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Within Acceptable Range (Correct)</span>
                    </span>
                  ) : (
                    <span className="text-xs px-3 py-1 rounded-full bg-rose-600/30 text-rose-300 border border-rose-500/50 font-bold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Outside Tolerance Range (Incorrect)</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {showSolution && (natCheck || correctNatAnswer !== undefined) && (
              <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-neutral-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Correct Target & Tolerance Range:
                </span>
                <span className="font-mono text-sm font-bold text-emerald-300 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-800/60">
                  {natCheck ? natCheck.formattedRange : `${correctNatAnswer}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Descriptive / Subjective Response */}
        {questionType === 'descriptive' && selectedOption && (
          <div className="my-2 p-3.5 rounded-xl border border-neutral-700 bg-neutral-900/60 space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Candidate Response:</span>
            <div className="text-sm text-neutral-200 leading-relaxed">
              {renderFormattedContent(Array.isArray(selectedOption) ? selectedOption.join('\n') : selectedOption)}
            </div>
          </div>
        )}

        {/* Solution & Explanation Breakdown */}
        {showSolution && solution && (
          <div className="mt-3 p-4 rounded-xl bg-neutral-900/90 border border-neutral-700/80 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Verified Solution & Explanation</span>
            </div>
            <div className="text-sm text-neutral-200 leading-relaxed font-sans">
              {renderFormattedContent(solution)}
            </div>
          </div>
        )}

        {/* Lightbox Zoom Modal for Question Diagram */}
        {isZoomOpen && image && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            onClick={() => {
              setIsZoomOpen(false);
              setZoomLevel(1);
            }}
          >
            <div
              className="relative max-w-5xl max-h-[90vh] bg-neutral-900 border-2 border-neutral-700 rounded-2xl p-4 shadow-2xl flex flex-col items-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                <span className="font-bold text-neutral-200 flex items-center gap-2">
                  <ZoomIn className="w-4 h-4 text-sky-400" />
                  <span>Diagram Zoom Preview ({Math.round(zoomLevel * 100)}%)</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsZoomOpen(false);
                      setZoomLevel(1);
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-900/60 text-neutral-200 border border-neutral-700 ml-2"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full overflow-auto max-h-[75vh] flex items-center justify-center p-4">
                <img
                  src={image}
                  alt="Enlarged Question Diagram"
                  style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                  className="max-w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </QuestionRendererErrorBoundary>
  );
};
