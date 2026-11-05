import { PYQ, QuestionType, CanonicalTopic } from '../types';
import { db } from '../db/db';

export type PYQAttemptFilter = 'all' | 'attempted' | 'unattempted' | 'first-correct' | 'first-incorrect';

export interface PYQFilterOptions {
  examId?: string;
  year?: number | 'all';
  stage?: string | 'all';
  topicId?: string | 'all';
  questionType?: QuestionType | 'all';
  attemptFilter?: PYQAttemptFilter;
  source?: 'all' | 'official' | 'memory-based';
  searchQuery?: string;
}

export interface TopicPYQStats {
  topicId: string;
  topicName?: string;
  total: number;
  attempted: number;
  unattempted: number;
  firstAttemptCorrect: number;
  firstAttemptIncorrect: number;
  coveragePercentage: number; // attempted / total * 100
  firstAttemptAccuracy: number; // firstAttemptCorrect / attempted * 100
}

export interface PYQBankSummary {
  total: number;
  attempted: number;
  unattempted: number;
  firstAttemptCorrect: number;
  firstAttemptAccuracy: number; // 0 - 100
  coveragePercentage: number; // 0 - 100
  byExam: Record<string, { total: number; attempted: number; accuracy: number }>;
  byYear: Record<number, { total: number; attempted: number }>;
  byQuestionType: Record<string, { total: number; attempted: number }>;
  byTopic: Record<string, TopicPYQStats>;
}

export interface AttemptResult {
  isCorrect: boolean;
  userAnswer: string | number | string[];
  feedback: string;
  pyq: PYQ;
}

/**
 * Evaluates whether a user's answer is correct for a given PYQ.
 */
export function evaluatePYQAnswer(
  pyq: PYQ,
  userAnswer: string | number | string[]
): boolean {
  if (pyq.questionType === 'NAT') {
    const num = typeof userAnswer === 'number' ? userAnswer : parseFloat(String(userAnswer).trim());
    if (isNaN(num)) return false;

    if (pyq.natAnswerRange) {
      return num >= pyq.natAnswerRange.min && num <= pyq.natAnswerRange.max;
    }
    const target = parseFloat(pyq.correctAnswer);
    if (!isNaN(target)) {
      return Math.abs(num - target) < 1e-4;
    }
    return false;
  }

  if (pyq.questionType === 'MSQ') {
    // Both user answer and correct answer are sets of options (e.g. ['A', 'C'] or 'A, C')
    const parseOptions = (val: string | string[]): Set<string> => {
      if (Array.isArray(val)) {
        return new Set(val.map(s => s.trim().toUpperCase()));
      }
      return new Set(
        String(val)
          .split(/[,; ]+/)
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
      );
    };

    const userSet = parseOptions(userAnswer as string | string[]);
    const correctSet = parseOptions(pyq.correctAnswer);

    if (userSet.size !== correctSet.size) return false;
    for (const opt of correctSet) {
      if (!userSet.has(opt)) return false;
    }
    return true;
  }

  // MCQ / descriptive: compare trimmed string
  const uStr = String(userAnswer).trim().toUpperCase();
  const cStr = pyq.correctAnswer.trim().toUpperCase();
  return uStr === cStr;
}

/**
 * Records an attempt on a PYQ, setting firstAttemptCorrect if this is the first attempt.
 */
export function recordPYQAttempt(
  pyq: PYQ,
  userAnswer: string | number | string[]
): AttemptResult {
  const isCorrect = evaluatePYQAnswer(pyq, userAnswer);
  const attemptedCount = (pyq.attemptedCount || 0) + 1;
  
  // Only set firstAttemptCorrect if not previously attempted / set
  const firstAttemptCorrect = pyq.firstAttemptCorrect !== undefined 
    ? pyq.firstAttemptCorrect 
    : isCorrect;

  const updatedPyq: PYQ = {
    ...pyq,
    attemptedCount,
    firstAttemptCorrect
  };

  return {
    isCorrect,
    userAnswer,
    feedback: isCorrect ? 'Correct! Well done.' : 'Incorrect. Review the solution below.',
    pyq: updatedPyq
  };
}

/**
 * Filters a list of PYQs based on specified filter criteria.
 */
export function filterPYQs(pyqs: PYQ[], filters: PYQFilterOptions): PYQ[] {
  return pyqs.filter(q => {
    // Exam
    if (filters.examId && filters.examId !== 'all' && q.examId !== filters.examId) {
      return false;
    }

    // Year
    if (filters.year && filters.year !== 'all' && q.year !== Number(filters.year)) {
      return false;
    }

    // Stage
    if (filters.stage && filters.stage !== 'all' && q.stage !== filters.stage) {
      return false;
    }

    // Topic
    if (filters.topicId && filters.topicId !== 'all' && q.topicId !== filters.topicId) {
      return false;
    }

    // Question Type
    if (filters.questionType && filters.questionType !== 'all' && q.questionType !== filters.questionType) {
      return false;
    }

    // Source
    if (filters.source && filters.source !== 'all' && q.source !== filters.source) {
      return false;
    }

    // Attempt Filter
    if (filters.attemptFilter && filters.attemptFilter !== 'all') {
      const isAttempted = (q.attemptedCount || 0) > 0;
      if (filters.attemptFilter === 'attempted' && !isAttempted) return false;
      if (filters.attemptFilter === 'unattempted' && isAttempted) return false;
      if (filters.attemptFilter === 'first-correct' && (!isAttempted || q.firstAttemptCorrect !== true)) return false;
      if (filters.attemptFilter === 'first-incorrect' && (!isAttempted || q.firstAttemptCorrect !== false)) return false;
    }

    // Search query
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const query = filters.searchQuery.toLowerCase();
      const matchText = q.questionText?.toLowerCase().includes(query);
      const matchSolution = q.solutionText?.toLowerCase().includes(query);
      const matchTopic = q.topicId?.toLowerCase().includes(query);
      const matchSubtopic = q.subtopic?.toLowerCase().includes(query);
      if (!matchText && !matchSolution && !matchTopic && !matchSubtopic) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculates coverage and accuracy stats for a specific topic.
 */
export function calculateTopicPYQStats(
  pyqs: PYQ[],
  topicId: string,
  topicName?: string
): TopicPYQStats {
  const topicQuestions = pyqs.filter(q => q.topicId === topicId);
  const total = topicQuestions.length;
  const attempted = topicQuestions.filter(q => (q.attemptedCount || 0) > 0).length;
  const unattempted = total - attempted;
  const firstAttemptCorrect = topicQuestions.filter(q => q.firstAttemptCorrect === true).length;
  const firstAttemptIncorrect = topicQuestions.filter(q => q.firstAttemptCorrect === false).length;

  return {
    topicId,
    topicName: topicName || topicId,
    total,
    attempted,
    unattempted,
    firstAttemptCorrect,
    firstAttemptIncorrect,
    coveragePercentage: total > 0 ? Math.round((attempted / total) * 100) : 0,
    firstAttemptAccuracy: attempted > 0 ? Math.round((firstAttemptCorrect / attempted) * 100) : 0
  };
}

/**
 * Calculates aggregate stats across the entire PYQ bank.
 */
export function calculateOverallPYQStats(
  pyqs: PYQ[],
  canonicalTopics: CanonicalTopic[] = []
): PYQBankSummary {
  const total = pyqs.length;
  const attempted = pyqs.filter(q => (q.attemptedCount || 0) > 0).length;
  const unattempted = total - attempted;
  const firstAttemptCorrect = pyqs.filter(q => q.firstAttemptCorrect === true).length;

  const byExam: Record<string, { total: number; attempted: number; accuracy: number }> = {};
  const byYear: Record<number, { total: number; attempted: number }> = {};
  const byQuestionType: Record<string, { total: number; attempted: number }> = {};
  const byTopic: Record<string, TopicPYQStats> = {};

  // Build name map
  const topicNameMap = new Map<string, string>();
  for (const t of canonicalTopics) {
    topicNameMap.set(t.id, t.name);
  }

  for (const q of pyqs) {
    // By Exam
    if (!byExam[q.examId]) {
      byExam[q.examId] = { total: 0, attempted: 0, accuracy: 0 };
    }
    byExam[q.examId].total++;
    if ((q.attemptedCount || 0) > 0) {
      byExam[q.examId].attempted++;
    }

    // By Year
    if (!byYear[q.year]) {
      byYear[q.year] = { total: 0, attempted: 0 };
    }
    byYear[q.year].total++;
    if ((q.attemptedCount || 0) > 0) {
      byYear[q.year].attempted++;
    }

    // By Question Type
    if (!byQuestionType[q.questionType]) {
      byQuestionType[q.questionType] = { total: 0, attempted: 0 };
    }
    byQuestionType[q.questionType].total++;
    if ((q.attemptedCount || 0) > 0) {
      byQuestionType[q.questionType].attempted++;
    }
  }

  // Calculate per-exam accuracy
  for (const examId of Object.keys(byExam)) {
    const examQuestions = pyqs.filter(q => q.examId === examId && (q.attemptedCount || 0) > 0);
    const correctFirst = examQuestions.filter(q => q.firstAttemptCorrect === true).length;
    byExam[examId].accuracy = examQuestions.length > 0 
      ? Math.round((correctFirst / examQuestions.length) * 100) 
      : 0;
  }

  // Collect distinct topics from pyqs and canonicalTopics
  const allTopicIds = new Set<string>([
    ...pyqs.map(q => q.topicId),
    ...canonicalTopics.map(t => t.id)
  ]);

  for (const tid of allTopicIds) {
    byTopic[tid] = calculateTopicPYQStats(pyqs, tid, topicNameMap.get(tid));
  }

  return {
    total,
    attempted,
    unattempted,
    firstAttemptCorrect,
    firstAttemptAccuracy: attempted > 0 ? Math.round((firstAttemptCorrect / attempted) * 100) : 0,
    coveragePercentage: total > 0 ? Math.round((attempted / total) * 100) : 0,
    byExam,
    byYear,
    byQuestionType,
    byTopic
  };
}

/**
 * Initial curated set of authentic GATE CS, SEBI IT, and IBPS SO IT PYQs.
 * Spanning 2021-2024 with MCQ, MSQ, and NAT types, LaTeX equations, and complete solutions.
 */
export const INITIAL_PYQS: PYQ[] = [
  // GATE CS 2024 - MCQ Algorithms
  {
    examId: 'gate-cs',
    year: 2024,
    stage: 'cbt',
    shift: 'Shift 1',
    topicId: 'algorithms',
    subtopic: 'Asymptotic worst and average time complexity',
    questionNumber: 15,
    questionText: 'Consider the recurrence relation:\n$$T(n) = 2T(\\lfloor\\sqrt{n}\\rfloor) + \\log_2 n$$\nfor $n > 2$ and $T(2) = 1$. Which of the following is the asymptotic order $\\Theta$ of $T(n)$?',
    questionType: 'MCQ',
    marks: 2,
    negativeMarks: 0.6667,
    options: [
      'A) $\\Theta(\\log n \\log \\log n)$',
      'B) $\\Theta((\\log n)^2)$',
      'C) $\\Theta(n \\log n)$',
      'D) $\\Theta(\\sqrt{n})$'
    ],
    correctAnswer: 'A',
    solutionText: 'Substitute $m = \\log_2 n \\implies n = 2^m$.\nThen $T(2^m) = 2T(2^{m/2}) + m$.\nLet $S(m) = T(2^m)$, then $S(m) = 2S(m/2) + m$.\nBy Master Theorem Case 2: $a = 2, b = 2, k = 1$.\n$S(m) = \\Theta(m \\log m)$.\nSubstituting back $m = \\log_2 n$ gives $T(n) = \\Theta(\\log n \\log \\log n)$.',
    source: 'official',
    sourceUrl: 'https://gate2024.iisc.ac.in',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // GATE CS 2024 - NAT Computer Networks
  {
    examId: 'gate-cs',
    year: 2024,
    stage: 'cbt',
    shift: 'Shift 1',
    topicId: 'cn',
    subtopic: 'Network layer (routing algorithms, IPv4/IPv6, CIDR subnetting)',
    questionNumber: 32,
    questionText: 'An organization is allocated the IP block `192.168.16.0/20`. The administrator wants to create 8 equal-sized subnets. What is the subnet mask in prefix length notation (i.e. `/X`) for each subnet?',
    questionType: 'NAT',
    marks: 1,
    negativeMarks: 0,
    correctAnswer: '23',
    natAnswerRange: { min: 23, max: 23 },
    solutionText: 'To create 8 equal-sized subnets, we need $\\log_2(8) = 3$ additional subnet bits.\nOriginal prefix = $/20$.\nNew prefix = $20 + 3 = /23$.\nEach subnet contains $2^{32-23} = 512$ IP addresses (510 usable hosts).',
    source: 'official',
    sourceUrl: 'https://gate2024.iisc.ac.in',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // GATE CS 2023 - MSQ Operating Systems
  {
    examId: 'gate-cs',
    year: 2023,
    stage: 'cbt',
    shift: 'Shift 2',
    topicId: 'os',
    subtopic: 'CPU and process scheduling',
    questionNumber: 44,
    questionText: 'Which of the following statements is/are **TRUE** regarding CPU scheduling algorithms?',
    questionType: 'MSQ',
    marks: 2,
    negativeMarks: 0,
    options: [
      'A) Round Robin scheduling is inherently preemptive.',
      'B) Shortest Remaining Time First (SRTF) can cause starvation for longer processes.',
      'C) First-Come, First-Served (FCFS) minimizes average turnaround time for any set of processes.',
      'D) Multilevel Feedback Queue allows a process to move between queues.'
    ],
    correctAnswer: 'A, B, D',
    solutionText: '- Option A: Round Robin uses a fixed time quantum and is preemptive (True).\n- Option B: SRTF gives priority to short remaining burst times, starving longer jobs (True).\n- Option C: FCFS suffers from the convoy effect and does NOT minimize average turnaround time (SJF does) (False).\n- Option D: Multilevel Feedback Queue dynamically shifts processes based on CPU burst behaviors (True).',
    source: 'official',
    sourceUrl: 'https://gate2023.iitk.ac.in',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // GATE CS 2023 - MCQ Databases
  {
    examId: 'gate-cs',
    year: 2023,
    stage: 'cbt',
    shift: 'Shift 1',
    topicId: 'dbms',
    subtopic: 'Integrity constraints, normal forms (1NF to BCNF)',
    questionNumber: 22,
    questionText: 'Given relation $R(A, B, C, D, E)$ with functional dependencies:\n$$F = \\{ A \\to B,\\; BC \\to D,\\; E \\to C \\}$$\nWhich of the following is a candidate key for relation $R$?',
    questionType: 'MCQ',
    marks: 1,
    negativeMarks: 0.3333,
    options: [
      'A) $AE$',
      'B) $AC$',
      'C) $AB$',
      'D) $BE$'
    ],
    correctAnswer: 'A',
    solutionText: 'Compute closure of $(AE)^+$:\n1. $(AE)^+ = \\{A, E\\}$\n2. Using $A \\to B \\implies \\{A, B, E\\}$\n3. Using $E \\to C \\implies \\{A, B, C, E\\}$\n4. Using $BC \\to D \\implies \\{A, B, C, D, E\\}$.\nSince $(AE)^+$ determines all attributes of $R$, and neither $A^+$ nor $E^+$ is a key, $AE$ is a candidate key.',
    source: 'official',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // SEBI IT 2023 - MCQ Information Security
  {
    examId: 'sebi-it',
    year: 2023,
    stage: 'phase-2',
    topicId: 'info_sec',
    subtopic: 'Symmetric & Asymmetric Cryptography (AES, RSA)',
    questionNumber: 8,
    questionText: 'In RSA cryptosystem, if $p = 7$, $q = 11$, and the encryption key $e = 13$, what is the decryption key $d$?',
    questionType: 'MCQ',
    marks: 2,
    negativeMarks: 0.5,
    options: [
      'A) 37',
      'B) 17',
      'C) 23',
      'D) 29'
    ],
    correctAnswer: 'A',
    solutionText: '$n = p \\times q = 77$.\nEuler totient function $\\phi(n) = (p-1)(q-1) = 6 \\times 10 = 60$.\nWe need $d$ such that $(e \\times d) \\equiv 1 \\pmod{\\phi(n)}$.\n$13d \\equiv 1 \\pmod{60}$.\nTesting candidates: $13 \\times 37 = 481 = 8 \\times 60 + 1 \\equiv 1 \\pmod{60}$.\nTherefore, $d = 37$.',
    source: 'official',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // SEBI IT 2022 - MCQ Software Engineering
  {
    examId: 'sebi-it',
    year: 2022,
    stage: 'phase-2',
    topicId: 'software_engineering',
    subtopic: 'SDLC models (Waterfall, Agile, Scrum)',
    questionNumber: 14,
    questionText: 'In Scrum Agile methodology, what is the recommended duration of a standard Daily Scrum meeting?',
    questionType: 'MCQ',
    marks: 2,
    negativeMarks: 0.5,
    options: [
      'A) 15 minutes',
      'B) 30 minutes',
      'C) 45 minutes',
      'D) 60 minutes'
    ],
    correctAnswer: 'A',
    solutionText: 'According to the official Scrum Guide, the Daily Scrum is a 15-minute time-boxed event for the Developers of the Scrum Team held every day of the Sprint.',
    source: 'memory-based',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // IBPS SO IT 2023 - MCQ Databases
  {
    examId: 'ibps-so-it',
    year: 2023,
    stage: 'mains',
    topicId: 'dbms',
    subtopic: 'Transactions and concurrency control (ACID, 2PL)',
    questionNumber: 12,
    questionText: 'Which property of ACID guarantees that database transactions are executed reliably and recorded in non-volatile storage even in the event of a system crash or power outage?',
    questionType: 'MCQ',
    marks: 1,
    negativeMarks: 0.25,
    options: [
      'A) Atomicity',
      'B) Consistency',
      'C) Isolation',
      'D) Durability'
    ],
    correctAnswer: 'D',
    solutionText: 'Durability ensures that once a transaction has been committed, it will remain committed even in the case of a system failure (e.g., power outage or crash), usually guaranteed via Write-Ahead Logging (WAL).',
    source: 'memory-based',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  },
  // IBPS SO IT 2022 - MCQ Computer Networks
  {
    examId: 'ibps-so-it',
    year: 2022,
    stage: 'mains',
    topicId: 'cn',
    subtopic: 'Transport layer (TCP, UDP, congestion control)',
    questionNumber: 27,
    questionText: 'Which protocol operates at the Transport layer to provide connectionless, best-effort message delivery without acknowledgments or flow control?',
    questionType: 'MCQ',
    marks: 1,
    negativeMarks: 0.25,
    options: [
      'A) TCP',
      'B) UDP',
      'C) ICMP',
      'D) ARP'
    ],
    correctAnswer: 'B',
    solutionText: 'User Datagram Protocol (UDP) is a lightweight, connectionless transport protocol with minimal overhead and no flow/congestion control guarantees.',
    source: 'official',
    attemptedCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z'
  }
];

/**
 * Seeds initial curated PYQs into the database if the table is empty.
 */
export async function seedInitialPYQsIfEmpty(dbInstance = db): Promise<number> {
  const count = await dbInstance.pyqs.count();
  if (count === 0) {
    await dbInstance.pyqs.bulkPut(INITIAL_PYQS);
    return INITIAL_PYQS.length;
  }
  return 0;
}
