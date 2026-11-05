import { describe, it, expect } from 'vitest';
import {
  PHASE_PRESETS,
  getPhasePreset,
  generateSchedule,
  reallocateMissedSessions,
  calculateScheduleDistribution,
  getDayName,
  ScheduledStudySession
} from './scheduleGenerator';

describe('scheduleGenerator utility', () => {
  describe('Phase presets & availability', () => {
    it('defines regular (15-20h), intensive (35-40h), and last-month (50-60h)', () => {
      expect(PHASE_PRESETS.regular.targetHoursPerWeek).toBeGreaterThanOrEqual(15);
      expect(PHASE_PRESETS.regular.targetHoursPerWeek).toBeLessThanOrEqual(20);

      expect(PHASE_PRESETS.intensive.targetHoursPerWeek).toBeGreaterThanOrEqual(35);
      expect(PHASE_PRESETS.intensive.targetHoursPerWeek).toBeLessThanOrEqual(40);

      expect(PHASE_PRESETS['last-month'].targetHoursPerWeek).toBeGreaterThanOrEqual(50);
      expect(PHASE_PRESETS['last-month'].targetHoursPerWeek).toBeLessThanOrEqual(60);
    });

    it('returns regular preset as default when invalid name passed', () => {
      const preset = getPhasePreset('unknown' as any);
      expect(preset.name).toBe('regular');
    });

    it('normalizes custom AvailabilityPhase correctly', () => {
      const custom = {
        name: 'intensive',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        targetHoursPerWeek: 40,
        dailyHoursAllocation: { Sunday: 5, Monday: 5 },
        weekendMockSlotHours: 3.5
      };
      const preset = getPhasePreset(custom as any);
      expect(preset.targetHoursPerWeek).toBe(40);
      expect(preset.dailyHoursAllocation.Sunday).toBe(5);
    });
  });

  describe('generateSchedule', () => {
    it('generates 7-day balanced schedule starting from Monday', () => {
      // 2026-03-02 is a Monday
      const sessions = generateSchedule({
        phase: 'regular',
        startDate: '2026-03-02',
        daysCount: 7
      });

      expect(sessions.length).toBeGreaterThan(0);
      const dates = Array.from(new Set(sessions.map(s => s.date)));
      expect(dates).toHaveLength(7);

      // Check session types present
      const types = new Set(sessions.map(s => s.type));
      expect(types.has('reading')).toBe(true);
      expect(types.has('practice')).toBe(true);
      expect(types.has('review')).toBe(true);
      expect(types.has('mock')).toBe(true);

      // Check Sunday has mock
      // 2026-03-08 is Sunday
      const sundaySessions = sessions.filter(s => s.date === '2026-03-08');
      const mockSession = sundaySessions.find(s => s.type === 'mock');
      expect(mockSession).toBeDefined();
      expect(mockSession?.durationMinutes).toBe(180);
    });

    it('adapts to intensive phase with higher total volume', () => {
      const regularSessions = generateSchedule({ phase: 'regular', startDate: '2026-03-02', daysCount: 7 });
      const intensiveSessions = generateSchedule({ phase: 'intensive', startDate: '2026-03-02', daysCount: 7 });

      const regDist = calculateScheduleDistribution(regularSessions);
      const intDist = calculateScheduleDistribution(intensiveSessions);

      expect(intDist.totalMinutes).toBeGreaterThan(regDist.totalMinutes);
      expect(intDist.totalHours).toBeGreaterThanOrEqual(35);
    });
  });

  describe('Dynamic reallocation & rollover', () => {
    it('intelligently rolls over missed past sessions to future available days', () => {
      const mockPastSessions: ScheduledStudySession[] = [
        {
          id: 'past-mock',
          date: '2026-03-01',
          dayOfWeek: 'Sunday',
          type: 'mock',
          title: 'Full Mock Test',
          durationMinutes: 180,
          status: 'pending',
          priority: 'high'
        },
        {
          id: 'past-review',
          date: '2026-03-02',
          dayOfWeek: 'Monday',
          type: 'review',
          title: 'SRS Mistakes Review',
          durationMinutes: 30,
          status: 'pending',
          priority: 'high'
        },
        {
          id: 'future-reading',
          date: '2026-03-05',
          dayOfWeek: 'Thursday',
          type: 'reading',
          title: 'DBMS Normalization',
          durationMinutes: 60,
          status: 'pending',
          priority: 'medium'
        }
      ];

      const { reallocatedSessions, rolloverCount } = reallocateMissedSessions(
        mockPastSessions,
        '2026-03-04' // today is Wednesday March 4
      );

      expect(rolloverCount).toBe(2);
      // All pending sessions should now be on or after 2026-03-04
      const rolledMocks = reallocatedSessions.filter(s => s.id.includes('past-mock'));
      expect(rolledMocks.length).toBe(1);
      expect(rolledMocks[0].date >= '2026-03-04').toBe(true);
      expect(rolledMocks[0].notes).toContain('Rolled over');
    });

    it('returns zero rollovers if there are no pending past sessions', () => {
      const sessions: ScheduledStudySession[] = [
        {
          id: 'today-session',
          date: '2026-03-05',
          dayOfWeek: 'Thursday',
          type: 'reading',
          title: 'Reading',
          durationMinutes: 45,
          status: 'pending',
          priority: 'medium'
        }
      ];
      const { reallocatedSessions, rolloverCount } = reallocateMissedSessions(sessions, '2026-03-05');
      expect(rolloverCount).toBe(0);
      expect(reallocatedSessions).toHaveLength(1);
    });
  });

  describe('calculateScheduleDistribution', () => {
    it('computes breakdown percentages and completion rate correctly', () => {
      const sampleSessions: ScheduledStudySession[] = [
        { id: '1', date: '2026-03-02', dayOfWeek: 'Monday', type: 'reading', title: 'T1', durationMinutes: 60, status: 'completed', priority: 'medium' },
        { id: '2', date: '2026-03-02', dayOfWeek: 'Monday', type: 'practice', title: 'T2', durationMinutes: 60, status: 'completed', priority: 'medium' },
        { id: '3', date: '2026-03-02', dayOfWeek: 'Monday', type: 'review', title: 'T3', durationMinutes: 30, status: 'pending', priority: 'high' },
        { id: '4', date: '2026-03-02', dayOfWeek: 'Monday', type: 'mock', title: 'T4', durationMinutes: 90, status: 'pending', priority: 'high' }
      ];

      const dist = calculateScheduleDistribution(sampleSessions);
      expect(dist.totalMinutes).toBe(240);
      expect(dist.totalHours).toBe(4);
      expect(dist.completionRate).toBe(50); // 2 out of 4 completed
      expect(dist.byType.reading.percentage).toBe(25); // 60/240
      expect(dist.byType.practice.percentage).toBe(25);
      expect(dist.byType.review.percentage).toBe(13); // 30/240
      expect(dist.byType.mock.percentage).toBe(38); // 90/240
    });
  });

  describe('getDayName', () => {
    it('calculates correct day of week for given ISO date', () => {
      expect(getDayName('2026-03-01')).toBe('Sunday');
      expect(getDayName('2026-03-02')).toBe('Monday');
      expect(getDayName('2026-03-06')).toBe('Friday');
      expect(getDayName('2026-03-07')).toBe('Saturday');
    });
  });
});
