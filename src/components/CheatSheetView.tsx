import React, { useState, useEffect, useMemo } from 'react';
import { MistakeEntry, ExamSettings, Pattern, CanonicalTopic } from '../types';
import { db, DEFAULT_CANONICAL_TOPICS } from '../db/db';
import { renderFormattedContent } from './shared/QuestionRenderer';
import { Mascot } from './Mascot';
import {
  Printer,
  Search,
  Sparkles,
  BookOpen,
  Filter,
  AlertTriangle,
  Layers,
  Zap,
  CheckCircle2
} from 'lucide-react';

interface CheatSheetViewProps {
  mistakes: MistakeEntry[];
  settings: ExamSettings;
  patterns?: Pattern[];
}

export const CheatSheetView: React.FC<CheatSheetViewProps> = ({
  mistakes,
  settings,
  patterns: initialPatterns
}) => {
  const [patterns, setPatterns] = useState<Pattern[]>(initialPatterns || []);
  const [topics, setTopics] = useState<CanonicalTopic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'rules' | 'patterns'>('all');

  useEffect(() => {
    let isMounted = true;
    const fetchAuxData = async () => {
      try {
        const [dbPatterns, dbTopics] = await Promise.all([
          db.patterns.toArray(),
          db.topics.toArray()
        ]);
        if (isMounted) {
          if (!initialPatterns || initialPatterns.length === 0) {
            setPatterns(dbPatterns);
          }
          setTopics(dbTopics.length > 0 ? dbTopics : DEFAULT_CANONICAL_TOPICS);
        }
      } catch (e) {
        console.error('Failed to load aux cheat sheet data:', e);
      }
    };
    fetchAuxData();
    return () => {
      isMounted = false;
    };
  }, [initialPatterns]);

  const handlePrint = () => {
    window.print();
  };

  // Map topicId to Topic name
  const topicMap = useMemo(() => {
    const map = new Map<string, string>();
    topics.forEach((t) => {
      map.set(t.id, t.name);
      map.set(t.name.toLowerCase(), t.name);
    });
    return map;
  }, [topics]);

  // Extract valid mistakes with rules
  const validMistakesWithRules = useMemo(() => {
    return mistakes.filter((m) => m.ruleToRemember && m.ruleToRemember.trim().length > 0);
  }, [mistakes]);

  // Available topics for filter dropdown
  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();
    validMistakesWithRules.forEach((m) => {
      if (selectedSection === 'all' || m.sectionId === selectedSection) {
        if (m.topic) topicSet.add(m.topic);
      }
    });
    patterns.forEach((p) => {
      const name = topicMap.get(p.topicId) || p.topicId;
      topicSet.add(name);
    });
    return Array.from(topicSet).sort();
  }, [validMistakesWithRules, patterns, selectedSection, topicMap]);

  // Filtered mistakes
  const filteredMistakes = useMemo(() => {
    if (contentTypeFilter === 'patterns') return [];
    return validMistakesWithRules.filter((m) => {
      if (selectedSection !== 'all' && m.sectionId !== selectedSection) return false;
      if (selectedTopic !== 'all' && m.topic !== selectedTopic) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = `${m.ruleToRemember} ${m.topic} ${m.sectionName} ${m.subtopic || ''}`.toLowerCase();
        return match.includes(q);
      }
      return true;
    });
  }, [validMistakesWithRules, selectedSection, selectedTopic, searchQuery, contentTypeFilter]);

  // Filtered patterns
  const filteredPatterns = useMemo(() => {
    if (contentTypeFilter === 'rules') return [];
    return patterns.filter((p) => {
      const topicName = topicMap.get(p.topicId) || p.topicId;
      if (selectedTopic !== 'all' && topicName !== selectedTopic && p.topicId !== selectedTopic) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = `${p.title} ${p.description} ${p.trickOrTrap} ${topicName}`.toLowerCase();
        return match.includes(q);
      }
      return true;
    });
  }, [patterns, selectedTopic, searchQuery, topicMap, contentTypeFilter]);

  // Grouped mistakes by Section, then Topic
  const groupedRules = useMemo(() => {
    const grouped: Record<string, Record<string, MistakeEntry[]>> = {};
    for (const m of filteredMistakes) {
      const secName = m.sectionName || 'General';
      const topName = m.topic || 'General';
      if (!grouped[secName]) grouped[secName] = {};
      if (!grouped[secName][topName]) grouped[secName][topName] = [];
      grouped[secName][topName].push(m);
    }
    return grouped;
  }, [filteredMistakes]);

  // Grouped patterns by Topic
  const groupedPatternsByTopic = useMemo(() => {
    const grouped: Record<string, Pattern[]> = {};
    for (const p of filteredPatterns) {
      const topName = topicMap.get(p.topicId) || p.topicId || 'General';
      if (!grouped[topName]) grouped[topName] = [];
      grouped[topName].push(p);
    }
    return grouped;
  }, [filteredPatterns, topicMap]);

  const totalItemCount = filteredMistakes.length + filteredPatterns.length;

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
              Formula & Pattern Bank
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            All your "Rule to Remember" golden one-liners and Pattern Book archetypes grouped by section and topic. Formatted for high-contrast print revision.
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
              placeholder="Search formulas, traps, archetypes (e.g. 'DFA', 'CIDR', '2PL', 'cylinder')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
            />
          </div>

          <div className="flex rounded-xl bg-[var(--surface-tag)] border-2 border-[var(--ink-border)] p-1 text-xs font-bold">
            <button
              onClick={() => setContentTypeFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                contentTypeFilter === 'all'
                  ? 'bg-[var(--card-bg)] text-[var(--ink-border)] shadow-manga-sm'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              All ({validMistakesWithRules.length + patterns.length})
            </button>
            <button
              onClick={() => setContentTypeFilter('rules')}
              className={`px-3 py-1 rounded-lg transition-all ${
                contentTypeFilter === 'rules'
                  ? 'bg-[var(--card-bg)] text-[var(--ink-border)] shadow-manga-sm'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              Rules ({validMistakesWithRules.length})
            </button>
            <button
              onClick={() => setContentTypeFilter('patterns')}
              className={`px-3 py-1 rounded-lg transition-all ${
                contentTypeFilter === 'patterns'
                  ? 'bg-[var(--card-bg)] text-[var(--ink-border)] shadow-manga-sm'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              Patterns ({patterns.length})
            </button>
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
            Displaying <strong className="text-[var(--ink-border)]">{totalItemCount}</strong> reference items ({filteredMistakes.length} rules, {filteredPatterns.length} pattern archetypes)
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
          Compiled from {mistakes.length} logged exam mistakes and {patterns.length} Pattern Book question archetypes. Review each rule to prevent recurring negative marking penalties.
        </p>
      </div>

      {/* Content Rendering */}
      {totalItemCount === 0 ? (
        <div className="p-10 text-center bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-3">
          <div className="flex justify-center">
            <Mascot mood="reading" size="lg" />
          </div>
          <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
            No Cheat Sheet Rules or Patterns Found
          </h3>
          <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto leading-relaxed">
            Every time you record a mistake with a "Rule to Remember" golden takeaway or add an archetype to the Pattern Book, it will automatically populate here as a clean, printable revision guide.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Pattern Book Archetypes & Traps (Integrated Section) */}
          {filteredPatterns.length > 0 && (
            <div className="p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4 print:p-0 print:border-none print:shadow-none print:break-inside-avoid">
              <div className="border-b-2 border-[var(--ink-border)]/20 pb-2 print:border-b-2 print:border-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-display text-lg font-black text-amber-600 dark:text-amber-400 print:text-black">
                  Pattern Book — Standard Question Archetypes & Traps
                </h3>
              </div>

              <div className="space-y-6">
                {Object.entries(groupedPatternsByTopic).map(([topName, patList]) => (
                  <div key={topName} className="space-y-3">
                    <h4 className="font-display text-xs font-bold text-[var(--ink-border)] uppercase tracking-wider print:text-black">
                      {topName} ({patList.length})
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1">
                      {patList.map((pat) => (
                        <div
                          key={pat.id || pat.title}
                          className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-xs space-y-2 shadow-manga-sm print:bg-white print:border-gray-400 print:p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-bold text-sm text-[var(--ink-border)] print:text-black">
                              {pat.title}
                            </h5>
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold">
                              Archetype
                            </span>
                          </div>

                          {pat.description && (
                            <div className="text-[var(--ink-border)] print:text-black text-xs font-medium">
                              {renderFormattedContent(pat.description)}
                            </div>
                          )}

                          <div className="p-2.5 rounded-lg bg-[var(--card-bg)] border border-amber-500/30 print:bg-gray-100">
                            <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1 font-mono text-[11px] uppercase">
                              Standard Trick / Trap:
                            </span>
                            <div className="text-[var(--ink-border)] print:text-black font-semibold text-xs">
                              {renderFormattedContent(pat.trickOrTrap)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Rules to Remember by Section and Topic */}
          {filteredMistakes.length > 0 &&
            Object.entries(groupedRules).map(([secName, topicsMap]) => (
              <div
                key={secName}
                className="p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4 print:p-0 print:border-none print:shadow-none print:break-inside-avoid"
              >
                <div className="border-b-2 border-[var(--ink-border)]/20 pb-2 print:border-b-2 print:border-black flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[var(--accent-twilight)]" />
                  <h3 className="font-display text-lg font-black text-[var(--accent-twilight)] print:text-black">
                    {secName} — Rules to Remember
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
                              <div className="font-bold text-[var(--ink-border)] print:text-black leading-snug">
                                {renderFormattedContent(m.ruleToRemember)}
                              </div>
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
