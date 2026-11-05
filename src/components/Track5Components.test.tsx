import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StudyPlannerView } from './StudyPlannerView';
import { FocusView } from './FocusView';
import { QuestsView } from './QuestsView';
import { SkillTreeView } from './SkillTreeView';
import { BossBattleModal } from './BossBattleModal';
import { HomeView } from './HomeView';

// Mock ResizeObserver for Recharts in JSDOM environment
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('Track 5 UI Components Rendering Suite', () => {
  it('renders StudyPlannerView with phase selector and target hours', () => {
    render(<StudyPlannerView />);
    expect(screen.getByText(/Study Planner & Availability/i)).toBeInTheDocument();
    expect(screen.getByText(/Regular Pace/i)).toBeInTheDocument();
    expect(screen.getByText(/Intensive Sprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Last-Month Final Push/i)).toBeInTheDocument();
  });

  it('renders FocusView with timer presets and web audio ambient controls', () => {
    render(<FocusView />);
    expect(screen.getByText(/Deep Focus Mode & Ambient Synthesizer/i)).toBeInTheDocument();
    expect(screen.getByText(/25 \/ 5 Pomodoro/i)).toBeInTheDocument();
    expect(screen.getByText(/50 \/ 10 Deep Work/i)).toBeInTheDocument();
    expect(screen.getByText(/180m CBT Mock Simulation/i)).toBeInTheDocument();
    expect(screen.getByText(/White Noise/i)).toBeInTheDocument();
    expect(screen.getByText(/40Hz Gamma Beats/i)).toBeInTheDocument();
  });

  it('renders QuestsView with Daily Quests and Weekly Bounties', () => {
    render(<QuestsView />);
    expect(screen.getByText(/Quest Board & Weekly Bounties/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Quests/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Weekly Bounties/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/The Algorithm Colossus/i)).toBeInTheDocument();
  });

  it('renders SkillTreeView with syllabus tiers and nodes', () => {
    render(<SkillTreeView />);
    expect(screen.getByText(/Syllabus Skill Tree/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier 1: Foundations/i)).toBeInTheDocument();
  });

  it('renders BossBattleModal with monster health bar when open', () => {
    const handleClose = vi.fn();
    render(<BossBattleModal isOpen={true} onClose={handleClose} />);
    expect(screen.getByText(/The Algorithm Colossus/i)).toBeInTheDocument();
    expect(screen.getByText(/Strike Boss!/i)).toBeInTheDocument();
  });

  it('renders HomeView with command center banner, next best action, and triggers', () => {
    const handleNavigate = vi.fn();
    const handleQuickAdd = vi.fn();
    render(
      <HomeView
        onNavigateTab={handleNavigate}
        onOpenQuickAdd={handleQuickAdd}
      />
    );
    expect(screen.getByText(/HOME COMMAND CENTER/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGHEST LEVERAGE NEXT ACTION/i)).toBeInTheDocument();
    expect(screen.getByText(/Today's Study Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Log Mistake/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Note/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Timer/i)).toBeInTheDocument();
  });
});
