import { AvailabilityPhase, MistakeEntry, PYQ, StudySessionType } from '../types';
import { addDaysToDate, getLocalDateStr } from './srs';

export type PhaseName = 'regular' | 'intensive' | 'last-month';

export interface PhasePreset {
  name: PhaseName;
  label: string;
  targetHoursPerWeek: number;
  description: string;
  dailyHoursAllocation: Record<string, number>;
  weekendMockSlotHours: number;
}

export const PHASE_PRESETS: Record<PhaseName, PhasePreset> = {
  regular: {
    name: 'regular',
    label: 'Regular Pace (15-20 hrs/week)',
    targetHoursPerWeek: 18,
    description: 'Consistent daily consistency with weekend deep work and mock simulations.',
    dailyHoursAllocation: {
      Monday: 2.0,
      Tuesday: 2.0,
      Wednesday: 2.0,
      Thursday: 2.0,
      Friday: 2.0,
      Saturday: 4.0,
      Sunday: 4.0
    },
    weekendMockSlotHours: 3.0
  },
  intensive: {
    name: 'intensive',
    label: 'Intensive Sprint (35-40 hrs/week)',
    targetHoursPerWeek: 38,
    description: 'Accelerated coverage with daily deep practice and full weekend mock regimen.',
    dailyHoursAllocation: {
      Monday: 5.0,
      Tuesday: 5.0,
      Wednesday: 5.0,
      Thursday: 5.0,
      Friday: 5.0,
      Saturday: 6.5,
      Sunday: 6.5
    },
    weekendMockSlotHours: 3.5
  },
  'last-month': {
    name: 'last-month',
    label: 'Last-Month Final Push (Full Time 50-60 hrs/week)',
    targetHoursPerWeek: 56,
    description: 'Full-time mock drills, rapid error revision, and formula sheet memorization.',
    dailyHoursAllocation: {
      Monday: 8.0,
      Tuesday: 8.0,
      Wednesday: 8.0,
      Thursday: 8.0,
      Friday: 8.0,
      Saturday: 8.0,
      Sunday: 8.0
    },
    weekendMockSlotHours: 4.0
  }
};

export type SessionStatus = 'pending' | 'completed' | 'missed';

export interface ScheduledStudySession {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  type: StudySessionType; // 'reading' | 'practice' | 'mock' | 'review'
  title: string;
  subject?: string;
  topic?: string;
  durationMinutes: number;
  status: SessionStatus;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  originalDate?: string;
}

export interface ScheduleGenerationOptions {
  phase: AvailabilityPhase | PhasePreset | PhaseName;
  startDate?: string;
  daysCount?: number;
  topics?: Array<{ id?: string; name: string; category?: string }>;
  mistakesDue?: MistakeEntry[];
  pyqs?: PYQ[];
  completedTopicNames?: string[];
}

export interface ScheduleDistribution {
  totalMinutes: number;
  totalHours: number;
  byType: Record<StudySessionType, { minutes: number; hours: number; percentage: number }>;
  completionRate: number;
  completedCount: number;
  totalSessions: number;
}

const DEFAULT_TOPICS = [
  { name: 'Computer Networks - Routing & Subnetting', category: 'Computer Science' },
  { name: 'Operating Systems - Virtual Memory & Page Tables', category: 'Computer Science' },
  { name: 'DBMS - Normalization & B+ Trees', category: 'Computer Science' },
  { name: 'Algorithms - Dynamic Programming & Graph Theory', category: 'Computer Science' },
  { name: 'Theory of Computation - Regular Expressions & Decidability', category: 'Computer Science' },
  { name: 'Digital Logic - K-Maps & Sequential Circuits', category: 'Computer Science' },
  { name: 'Engineering Mathematics - Linear Algebra & Calculus', category: 'Engineering Mathematics' }
];

export function getPhasePreset(nameOrPhase: PhaseName | AvailabilityPhase | PhasePreset): PhasePreset {
  if (typeof nameOrPhase === 'string') {
    return PHASE_PRESETS[nameOrPhase] || PHASE_PRESETS.regular;
  }
  if ('dailyHoursAllocation' in nameOrPhase && 'weekendMockSlotHours' in nameOrPhase) {
    const rawName = (nameOrPhase.name as PhaseName) || 'regular';
    const fallback = PHASE_PRESETS[rawName] || PHASE_PRESETS.regular;
    return {
      name: rawName,
      label: ('label' in nameOrPhase && typeof (nameOrPhase as any).label === 'string')
        ? (nameOrPhase as any).label
        : fallback.label,
      targetHoursPerWeek: nameOrPhase.targetHoursPerWeek || fallback.targetHoursPerWeek,
      description: fallback.description,
      dailyHoursAllocation: nameOrPhase.dailyHoursAllocation || fallback.dailyHoursAllocation,
      weekendMockSlotHours: nameOrPhase.weekendMockSlotHours || fallback.weekendMockSlotHours
    };
  }
  return PHASE_PRESETS.regular;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  return DAYS_OF_WEEK[date.getDay()];
}

/**
 * Generates an auto-balanced study schedule across the requested date window.
 * Balances new topics (reading), mistake reviews (review), PYQ practice (practice),
 * and weekend full mocks (mock).
 */
export function generateSchedule(options: ScheduleGenerationOptions): ScheduledStudySession[] {
  const phase = getPhasePreset(options.phase);
  const startDate = options.startDate || getLocalDateStr();
  const daysCount = Math.max(1, options.daysCount || 7);

  const availableTopics = options.topics && options.topics.length > 0 ? options.topics : DEFAULT_TOPICS;
  const mistakes = options.mistakesDue || [];
  const pyqs = options.pyqs || [];

  const sessions: ScheduledStudySession[] = [];
  let topicIndex = 0;
  let mistakeIndex = 0;
  let pyqIndex = 0;

  for (let i = 0; i < daysCount; i++) {
    const currentDate = addDaysToDate(startDate, i);
    const dayName = getDayName(currentDate);
    const dailyHours = phase.dailyHoursAllocation[dayName] || 2.0;
    const totalDailyMinutes = Math.round(dailyHours * 60);

    const isWeekend = dayName === 'Saturday' || dayName === 'Sunday';

    if (isWeekend && dayName === 'Sunday') {
      // Full mock day on Sunday
      const mockMinutes = Math.min(totalDailyMinutes, Math.round(phase.weekendMockSlotHours * 60));
      sessions.push({
        id: `session-${currentDate}-mock`,
        date: currentDate,
        dayOfWeek: dayName,
        type: 'mock',
        title: 'Full Length CBT Mock Exam Simulation',
        subject: 'Full Syllabus',
        durationMinutes: mockMinutes,
        status: 'pending',
        priority: 'high',
        notes: 'Strict exam environment: 180 min uninterrupted, scientific calculator only, review mistakes right after.'
      });

      const remainingAfterMock = totalDailyMinutes - mockMinutes;
      if (remainingAfterMock >= 45) {
        sessions.push({
          id: `session-${currentDate}-mock-review`,
          date: currentDate,
          dayOfWeek: dayName,
          type: 'review',
          title: 'Post-Mock Mistake Analysis & Categorization',
          subject: 'Mock Analysis',
          durationMinutes: remainingAfterMock,
          status: 'pending',
          priority: 'high',
          notes: 'Log all silly errors, concept gaps, and unattempted question traps into notebook.'
        });
      }
    } else if (isWeekend && dayName === 'Saturday') {
      // Weekend deep practice & heavy review
      const reviewMinutes = Math.min(90, Math.round(totalDailyMinutes * 0.35));
      const practiceMinutes = Math.min(120, Math.round(totalDailyMinutes * 0.45));
      const readingMinutes = Math.max(30, totalDailyMinutes - reviewMinutes - practiceMinutes);

      const activeTopic = availableTopics[topicIndex % availableTopics.length];
      topicIndex++;

      sessions.push({
        id: `session-${currentDate}-rev`,
        date: currentDate,
        dayOfWeek: dayName,
        type: 'review',
        title: mistakes.length > 0 ? `SRS Mistake Review (${Math.min(15, mistakes.length)} cards)` : 'Weekly Error Log Deep Revision',
        subject: activeTopic.category || 'CS Revision',
        durationMinutes: reviewMinutes,
        status: 'pending',
        priority: 'high',
        notes: 'Test recall before flipping solution card. Flag tricky patterns.'
      });

      sessions.push({
        id: `session-${currentDate}-prac`,
        date: currentDate,
        dayOfWeek: dayName,
        type: 'practice',
        title: `PYQ Drill: ${activeTopic.name}`,
        subject: activeTopic.category || 'Core Subject',
        topic: activeTopic.name,
        durationMinutes: practiceMinutes,
        status: 'pending',
        priority: 'medium',
        notes: 'Timed practice with speed penalty awareness.'
      });

      if (readingMinutes >= 30) {
        const nextTopic = availableTopics[topicIndex % availableTopics.length];
        topicIndex++;
        sessions.push({
          id: `session-${currentDate}-read`,
          date: currentDate,
          dayOfWeek: dayName,
          type: 'reading',
          title: `Concept Booster: ${nextTopic.name}`,
          subject: nextTopic.category || 'Core Subject',
          topic: nextTopic.name,
          durationMinutes: readingMinutes,
          status: 'pending',
          priority: 'medium',
          notes: 'Synthesize formula notes and standard textbook proofs.'
        });
      }
    } else {
      // Weekday balanced allocation:
      // ~35% Reading / New topics
      // ~35% Practice / PYQs
      // ~20% SRS Mistake reviews
      // ~10% Quick formula recap
      const reviewMinutes = Math.max(20, Math.round(totalDailyMinutes * 0.25));
      const remaining = totalDailyMinutes - reviewMinutes;
      const readingMinutes = Math.round(remaining * 0.5);
      const practiceMinutes = Math.max(20, remaining - readingMinutes);

      const currentTopic = availableTopics[topicIndex % availableTopics.length];
      topicIndex++;

      // 1. Reading
      sessions.push({
        id: `session-${currentDate}-read`,
        date: currentDate,
        dayOfWeek: dayName,
        type: 'reading',
        title: `Theory & Notes: ${currentTopic.name}`,
        subject: currentTopic.category || 'Core Subject',
        topic: currentTopic.name,
        durationMinutes: readingMinutes,
        status: 'pending',
        priority: 'medium',
        notes: 'Read core theory, definitions, and high-frequency algorithms.'
      });

      // 2. Practice (PYQ)
      const currentPyq = pyqs[pyqIndex % Math.max(1, pyqs.length)];
      pyqIndex++;
      sessions.push({
        id: `session-${currentDate}-prac`,
        date: currentDate,
        dayOfWeek: dayName,
        type: 'practice',
        title: `PYQ Practice: ${currentTopic.name}`,
        subject: currentTopic.category || 'Core Subject',
        topic: currentTopic.name,
        durationMinutes: practiceMinutes,
        status: 'pending',
        priority: 'high',
        notes: currentPyq ? `Target PYQs from ${currentPyq.year || 'GATE'} papers.` : 'Solve 5-8 previous year questions without peeking at answers.'
      });

      // 3. Mistake Review
      const dueCount = mistakes.length > 0 ? Math.min(8, mistakes.length - mistakeIndex) : 5;
      mistakeIndex += dueCount;
      sessions.push({
        id: `session-${currentDate}-rev`,
        date: currentDate,
        dayOfWeek: dayName,
        type: 'review',
        title: `Daily SRS Review (${dueCount > 0 ? dueCount : 5} due mistakes)`,
        subject: 'Error Notebook',
        durationMinutes: reviewMinutes,
        status: 'pending',
        priority: 'high',
        notes: 'Active recall spaced repetition review.'
      });
    }
  }

  return sessions;
}

/**
 * Intelligent Dynamic Reallocation:
 * When sessions before or on `todayStr` are missed, rolls them over to upcoming days
 * while respecting daily capacity limits.
 * Prioritizes Reviews (SRS) & Mocks over regular reading.
 */
export function reallocateMissedSessions(
  sessions: ScheduledStudySession[],
  todayStr: string,
  dailyMaxHours: Record<string, number> = PHASE_PRESETS.regular.dailyHoursAllocation
): { reallocatedSessions: ScheduledStudySession[]; rolloverCount: number } {
  const result: ScheduledStudySession[] = [];
  const missedQueue: ScheduledStudySession[] = [];

  // 1. Categorize sessions
  for (const session of sessions) {
    if (session.date < todayStr && session.status === 'pending') {
      missedQueue.push({
        ...session,
        status: 'pending',
        originalDate: session.originalDate || session.date
      });
    } else {
      result.push({ ...session });
    }
  }

  if (missedQueue.length === 0) {
    return { reallocatedSessions: result, rolloverCount: 0 };
  }

  // 2. Sort missed queue: mocks and reviews first (highest leverage)
  const typeWeight: Record<StudySessionType, number> = {
    mock: 4,
    review: 3,
    practice: 2,
    reading: 1
  };
  missedQueue.sort((a, b) => typeWeight[b.type] - typeWeight[a.type]);

  // 3. Calculate already allocated minutes for upcoming days
  const dayMinutesMap = new Map<string, number>();
  for (const s of result) {
    if (s.date >= todayStr && s.status !== 'missed') {
      dayMinutesMap.set(s.date, (dayMinutesMap.get(s.date) || 0) + s.durationMinutes);
    }
  }

  let rolloverCount = 0;
  // Look forward up to 14 days
  for (const missed of missedQueue) {
    let placed = false;
    for (let offset = 0; offset <= 14; offset++) {
      const targetDate = addDaysToDate(todayStr, offset);
      const dayName = getDayName(targetDate);
      const capHours = dailyMaxHours[dayName] || 2.0;
      // Allow slight 20% stretch for critical catchup
      const maxAllowed = Math.round(capHours * 60 * 1.2);
      const currentLoad = dayMinutesMap.get(targetDate) || 0;

      if (currentLoad + missed.durationMinutes <= maxAllowed) {
        placed = true;
        dayMinutesMap.set(targetDate, currentLoad + missed.durationMinutes);
        result.push({
          ...missed,
          id: `${missed.id}-rollover-${targetDate}`,
          date: targetDate,
          dayOfWeek: dayName,
          status: 'pending',
          notes: `${missed.notes || ''} [Rolled over from ${missed.originalDate}]`.trim()
        });
        rolloverCount++;
        break;
      }
    }

    if (!placed) {
      // If cannot fit without huge overload, place on tomorrow with reduced duration
      const fallbackDate = addDaysToDate(todayStr, 1);
      const fallbackDay = getDayName(fallbackDate);
      result.push({
        ...missed,
        id: `${missed.id}-rollover-${fallbackDate}`,
        date: fallbackDate,
        dayOfWeek: fallbackDay,
        durationMinutes: Math.max(20, Math.round(missed.durationMinutes * 0.75)),
        status: 'pending',
        notes: `${missed.notes || ''} [Compressed rollover from ${missed.originalDate}]`.trim()
      });
      rolloverCount++;
    }
  }

  // Sort chronologically by date
  result.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return typeWeight[b.type] - typeWeight[a.type];
  });

  return { reallocatedSessions: result, rolloverCount };
}

/**
 * Calculates distribution statistics and completion rate across a set of sessions.
 */
export function calculateScheduleDistribution(sessions: ScheduledStudySession[]): ScheduleDistribution {
  let totalMinutes = 0;
  let completedCount = 0;

  const byType: Record<StudySessionType, { minutes: number; hours: number; percentage: number }> = {
    reading: { minutes: 0, hours: 0, percentage: 0 },
    practice: { minutes: 0, hours: 0, percentage: 0 },
    mock: { minutes: 0, hours: 0, percentage: 0 },
    review: { minutes: 0, hours: 0, percentage: 0 }
  };

  for (const s of sessions) {
    totalMinutes += s.durationMinutes;
    if (s.status === 'completed') {
      completedCount++;
    }
    if (byType[s.type]) {
      byType[s.type].minutes += s.durationMinutes;
    }
  }

  for (const type of Object.keys(byType) as StudySessionType[]) {
    const min = byType[type].minutes;
    byType[type].hours = Math.round((min / 60) * 10) / 10;
    byType[type].percentage = totalMinutes > 0 ? Math.round((min / totalMinutes) * 100) : 0;
  }

  const completionRate = sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;

  return {
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    byType,
    completionRate,
    completedCount,
    totalSessions: sessions.length
  };
}
