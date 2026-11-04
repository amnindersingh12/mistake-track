import React, { useState } from 'react';
import { MistakeEntry, ExamSettings } from '../types';
import { Mascot } from './Mascot';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Sparkles,
  BookOpen,
  Filter,
  CheckCircle2
} from 'lucide-react';

interface CheatSheetViewProps {
  mistakes: MistakeEntry[];
  settings: ExamSettings;
}

export const CheatSheetView: React.FC<CheatSheetViewProps> = ({ mistakes, settings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  const handlePrint = () => {
    window.print();
  };

  // Extract unique rules (filtering out empty or duplicate rules)
  const validMistakesWithRules = mistakes.filter((m) => m.ruleToRemember && m.ruleToRemember.trim().length > 0);

  const availableTopics = Array.from(
    new Set(
      validMistakesWithRules
        .filter((m) => selectedSection === 'all' || m.sectionId === selectedSection)
        .map((m) => m.topic)
        .filter(Boolean)
    )
  ).sort();

  // Group by Section, then by Topic
  const groupedRules: Record<string, Record<string, MistakeEntry[]>> = {};

  for (const m of validMistakesWithRules) {
    if (selectedSection !== 'all' && m.sectionId !== selectedSection) continue;
    if (selectedTopic !== 'all' && m.topic !== selectedTopic) continue;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (m.ruleToRemember + ' ' + m.topic + ' ' + m.sectionName + ' ' + (m.subtopic || '')).toLowerCase();
      if (!match.includes(q)) continue;
    }

    if (!groupedRules[m.sectionName]) {
      groupedRules[m.sectionName] = {};
    }
    if (!groupedRules[m.sectionName][m.topic]) {
      groupedRules[m.sectionName][m.topic] = [];
    }
    groupedRules[m.sectionName][m.topic].push(m);
  }

  const totalRulesCount = Object.values(groupedRules).reduce(
    (acc, topics) => acc + Object.values(topics).reduce((tAcc, list) => tAcc + list.length, 0),
    0
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:p-0 print:max-w-none">
      {/* Top Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Revision Cheat Sheet
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-bold">
              Formula Bank
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            All your "Rule to Remember" golden one-liners grouped by section and topic. Formatted for high-contrast print revision.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] hover:bg-[var(--accent-sakura)]/80 text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Cheat Sheet</span>
          </button>
        </div>
      </div>

      {/* Search and Filters - Hidden on Print */}
      <div className="p-4 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search cheat sheet rules (e.g. 'successive', 'inversion', 'cylinder')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
            />
          </div>

          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setSelectedTopic('all');
            }}
            className="text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
          >
            <option value="all">All Sections</option>
            {settings.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
          >
            <option value="all">All Topics</option>
            {availableTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-[var(--ink-muted)] flex items-center justify-between font-mono">
          <span>
            Displaying <strong className="text-[var(--ink-border)]">{totalRulesCount}</strong> active rules
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[var(--accent-twilight)] font-bold hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-black text-black">{settings.examName} — Master Revision Cheat Sheet</h1>
        <p className="text-xs text-gray-700 mt-1">
          Compiled from {mistakes.length} logged exam mistakes. Review each rule to prevent recurring negative marking penalties.
        </p>
      </div>

      {/* Rules Content */}
      {totalRulesCount === 0 ? (
        <div className="p-10 text-center bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-3">
          <div className="flex justify-center">
            <Mascot mood="reading" size="lg" />
          </div>
          <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
            No Rules Logged Yet
          </h3>
          <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto leading-relaxed">
            Every time you record a mistake with a "Rule to Remember" golden takeaway, it will automatically populate here as a clean, printable revision guide.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRules).map(([secName, topicsMap]) => (
            <div
              key={secName}
              className="p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4 print:p-0 print:border-none print:shadow-none print:break-inside-avoid"
            >
              <div className="border-b-2 border-[var(--ink-border)]/20 pb-2 print:border-b-2 print:border-black">
                <h3 className="font-display text-lg font-black text-[var(--accent-twilight)] print:text-black">
                  {secName}
                </h3>
              </div>

              <div className="space-y-4">
                {Object.entries(topicsMap).map(([topicName, topicMistakes]) => (
                  <div key={topicName} className="space-y-2">
                    <h4 className="font-display text-xs font-bold text-[var(--ink-border)] uppercase tracking-wider print:text-black">
                      {topicName}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-1">
                      {topicMistakes.map((m) => (
                        <div
                          key={m.id}
                          className="p-3.5 rounded-xl bg-[var(--surface-tag)] border-2 border-[var(--ink-border)] shadow-manga-sm flex items-start gap-3 print:bg-white print:border-gray-400 print:p-2"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 print:hidden" />
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-[var(--ink-border)] print:text-black leading-snug">
                              {m.ruleToRemember}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--ink-muted)] print:text-gray-600 font-mono">
                              <span>From {m.mockName}</span>
                              {m.subtopic && <span>• {m.subtopic}</span>}
                              <span>• Q#{m.questionNumber}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
