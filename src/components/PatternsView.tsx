import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pattern, CanonicalTopic, MistakeEntry, PYQ } from '../types';
import { db, DEFAULT_CANONICAL_TOPICS } from '../db/db';
import { renderFormattedContent } from './shared/QuestionRenderer';
import { Mascot } from './Mascot';
import {
  Sparkles,
  Plus,
  Search,
  Edit3,
  Trash2,
  Link2,
  AlertTriangle,
  Layers,
  X,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const DEFAULT_PATTERN_ARCHETYPES: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'DFA minimal states with substring constraint',
    topicId: 'toc',
    description: 'Constructing the minimal Deterministic Finite Automaton (DFA) recognizing all strings containing a fixed pattern or substring $w$ over alphabet $\\Sigma = \\{0, 1\\}$.',
    trickOrTrap: 'For substring of length $k$, minimal DFA requires $k+1$ states where state $k$ is dead-accepting (absorbing). If constraint is "ends with $w$", state $k$ is accepting but NOT absorbing! Watch out for prefix-suffix overlaps in transitions.',
    linkedMistakeIds: [],
    linkedPyqIds: []
  },
  {
    title: '2PL serializability check',
    topicId: 'dbms',
    description: 'Testing if a concurrent transaction schedule is conflict serializable and whether it adheres to Basic 2PL, Strict 2PL, or Rigorous 2PL protocols.',
    trickOrTrap: 'Conflict serializable $\\subset$ View serializable. Rigorous 2PL guarantees conflict serializability and avoids cascading aborts without deadlocks. Never confuse lock release phase: in Strict 2PL only Exclusive locks are held until commit, while in Rigorous 2PL ALL locks (Shared + Exclusive) are held until commit.',
    linkedMistakeIds: [],
    linkedPyqIds: []
  },
  {
    title: 'Subnetting host calculation with CIDR',
    topicId: 'cn',
    description: 'Calculating valid host addresses, network ID, and broadcast address given an IPv4 prefix like $/26$ or $/28$.',
    trickOrTrap: 'Always subtract 2 for usable hosts: $2^{(32 - \\text{prefix})} - 2$ (excluding All-0s Network ID and All-1s Broadcast IP). Check if question asks for "total addresses" (without subtracting 2) or "usable host addresses" (subtract 2).',
    linkedMistakeIds: [],
    linkedPyqIds: []
  }
];

interface PatternsViewProps {
  initialTopicId?: string;
  onRefresh?: () => void;
}

export const PatternsView: React.FC<PatternsViewProps> = ({ initialTopicId, onRefresh }) => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [topics, setTopics] = useState<CanonicalTopic[]>([]);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [pyqs, setPyqs] = useState<PYQ[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editor Modal
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingPattern, setEditingPattern] = useState<Partial<Pattern>>({
    title: '',
    topicId: '',
    description: '',
    trickOrTrap: '',
    linkedMistakeIds: [],
    linkedPyqIds: []
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dbPatterns, dbTopics, dbMistakes, dbPyqs] = await Promise.all([
        db.patterns.toArray(),
        db.topics.toArray(),
        db.mistakes.toArray(),
        db.pyqs.toArray()
      ]);

      setPatterns(dbPatterns);
      setTopics(dbTopics.length > 0 ? dbTopics : DEFAULT_CANONICAL_TOPICS);
      setMistakes(dbMistakes);
      setPyqs(dbPyqs);
    } catch (err) {
      console.error('Failed to load patterns data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topicMap = useMemo(() => {
    const map = new Map<string, CanonicalTopic>();
    topics.forEach((t) => map.set(t.id, t));
    return map;
  }, [topics]);

  // Seed default archetypes if pattern book is empty
  const handleSeedArchetypes = async () => {
    const now = new Date().toISOString();
    const toInsert: Pattern[] = DEFAULT_PATTERN_ARCHETYPES.map((p) => ({
      ...p,
      createdAt: now,
      updatedAt: now
    }));
    await db.patterns.bulkAdd(toInsert);
    await loadData();
    if (onRefresh) onRefresh();
  };

  const filteredPatterns = useMemo(() => {
    return patterns.filter((p) => {
      if (selectedTopicId !== 'all' && p.topicId !== selectedTopicId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const topicName = topicMap.get(p.topicId)?.name || '';
        const match = `${p.title} ${p.description} ${p.trickOrTrap} ${topicName}`.toLowerCase();
        return match.includes(q);
      }
      return true;
    });
  }, [patterns, selectedTopicId, searchQuery, topicMap]);

  const handleOpenNew = () => {
    const defaultTopic = selectedTopicId !== 'all' ? selectedTopicId : (topics[0]?.id || 'discrete_math');
    setEditingPattern({
      title: '',
      topicId: defaultTopic,
      description: '',
      trickOrTrap: '',
      linkedMistakeIds: [],
      linkedPyqIds: []
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (pattern: Pattern) => {
    setEditingPattern({ ...pattern });
    setIsEditing(true);
  };

  const handleSavePattern = async () => {
    if (!editingPattern.title?.trim() || !editingPattern.topicId || !editingPattern.trickOrTrap?.trim()) {
      alert('Please fill out the Title, Topic, and Standard Trick/Trap.');
      return;
    }

    const now = new Date().toISOString();
    const patternToSave: Pattern = {
      title: editingPattern.title.trim(),
      topicId: editingPattern.topicId,
      description: editingPattern.description?.trim() || '',
      trickOrTrap: editingPattern.trickOrTrap.trim(),
      linkedMistakeIds: editingPattern.linkedMistakeIds || [],
      linkedPyqIds: editingPattern.linkedPyqIds || [],
      createdAt: editingPattern.createdAt || now,
      updatedAt: now
    };

    let savedId: number;
    if (editingPattern.id) {
      patternToSave.id = editingPattern.id;
      await db.patterns.put(patternToSave);
      savedId = editingPattern.id;
    } else {
      savedId = (await db.patterns.add(patternToSave)) as number;
    }

    // Two-way link to mistakes
    if (patternToSave.linkedMistakeIds.length > 0) {
      for (const mId of patternToSave.linkedMistakeIds) {
        const m = await db.mistakes.get(mId);
        if (m) {
          const patIds = new Set(m.linkedPatternIds || []);
          patIds.add(savedId);
          await db.mistakes.update(mId, { linkedPatternIds: Array.from(patIds) });
        }
      }
    }

    setIsEditing(false);
    await loadData();
    if (onRefresh) onRefresh();
  };

  const handleDeletePattern = async (id: number) => {
    if (!confirm('Are you sure you want to delete this archetype from the Pattern Book?')) return;
    await db.patterns.delete(id);
    await loadData();
    if (onRefresh) onRefresh();
  };

  const toggleLinkMistake = (mId: number) => {
    const current = new Set(editingPattern.linkedMistakeIds || []);
    if (current.has(mId)) {
      current.delete(mId);
    } else {
      current.add(mId);
    }
    setEditingPattern({ ...editingPattern, linkedMistakeIds: Array.from(current) });
  };

  const toggleLinkPyq = (pyqId: number) => {
    const current = new Set(editingPattern.linkedPyqIds || []);
    if (current.has(pyqId)) {
      current.delete(pyqId);
    } else {
      current.add(pyqId);
    }
    setEditingPattern({ ...editingPattern, linkedPyqIds: Array.from(current) });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-[var(--ink-border)]">
              Pattern Book
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-amber-600 font-bold">
              Archetypes & Traps
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Capture recurring question patterns, common exam twists, standard formulas, and links to your past mistakes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {patterns.length === 0 && (
            <button
              onClick={handleSeedArchetypes}
              className="px-3.5 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] hover:bg-[var(--accent-sakura)]/50 text-[var(--ink-border)] text-xs font-bold shadow-manga-sm transition-all"
            >
              Load Common Archetypes
            </button>
          )}

          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] hover:bg-[var(--accent-sakura)]/80 text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Pattern</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search archetypes, tricks, or traps (e.g. 'DFA', '2PL', 'CIDR')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
          />
        </div>

        <select
          value={selectedTopicId}
          onChange={(e) => setSelectedTopicId(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
        >
          <option value="all">All Topics ({patterns.length} patterns)</option>
          {topics.map((t) => {
            const count = patterns.filter((p) => p.topicId === t.id).length;
            return (
              <option key={t.id} value={t.id}>
                {t.name} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* Patterns Grid */}
      {filteredPatterns.length === 0 ? (
        <div className="p-12 text-center bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
          <div className="flex justify-center">
            <Mascot mood="reading" size="xl" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--ink-border)]">
              {patterns.length === 0 ? 'No Archetypes in Pattern Book' : 'No Patterns Match Your Search'}
            </h3>
            <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto mt-1">
              {patterns.length === 0
                ? 'Store reusable exam archetypes like "DFA minimal states with substring constraint" or "2PL serializability check" to never fall for the same trap twice.'
                : 'Try adjusting your search query or selecting All Topics.'}
            </p>
          </div>
          {patterns.length === 0 ? (
            <button
              onClick={handleSeedArchetypes}
              className="px-5 py-2.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 transition-all"
            >
              Load Common Archetypes (DFA, 2PL, CIDR)
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTopicId('all');
              }}
              className="px-4 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] text-xs font-bold"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPatterns.map((pat) => {
            const topic = topicMap.get(pat.topicId);
            return (
              <div
                key={pat.id}
                className="p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Topic Pill & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-black">
                      {topic?.name || pat.topicId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(pat)}
                        className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--surface-tag)] hover:bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs transition-all"
                        title="Edit Pattern"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {pat.id && (
                        <button
                          onClick={() => handleDeletePattern(pat.id!)}
                          className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-xs transition-all"
                          title="Delete Pattern"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-base font-black text-[var(--ink-border)]">
                    {pat.title}
                  </h3>

                  {/* Archetype Description */}
                  {pat.description && (
                    <div className="text-xs text-[var(--ink-border)] font-medium leading-relaxed">
                      {renderFormattedContent(pat.description)}
                    </div>
                  )}

                  {/* Standard Trick / Trap Box */}
                  <div className="p-3.5 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-display font-black text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Standard Trick / Trap:</span>
                    </div>
                    <div className="text-[var(--ink-border)] font-semibold leading-relaxed">
                      {renderFormattedContent(pat.trickOrTrap)}
                    </div>
                  </div>
                </div>

                {/* Linked Mistakes & PYQs Footer */}
                <div className="pt-3 border-t-2 border-[var(--ink-border)]/20 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-[var(--ink-muted)]">
                      <Link2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>{pat.linkedMistakeIds.length} Linked Mistakes</span>
                    </span>
                    <span className="flex items-center gap-1 text-[var(--ink-muted)]">
                      <Layers className="w-3.5 h-3.5 text-purple-500" />
                      <span>{pat.linkedPyqIds.length} Linked PYQs</span>
                    </span>
                  </div>

                  {/* Preview of linked mistakes if any */}
                  {pat.linkedMistakeIds.length > 0 && (
                    <div className="space-y-1">
                      {pat.linkedMistakeIds.slice(0, 2).map((mId) => {
                        const m = mistakes.find((item) => item.id === mId);
                        if (!m) return null;
                        return (
                          <div
                            key={mId}
                            className="p-1.5 rounded-lg bg-[var(--surface-tag)] text-[10px] text-[var(--ink-muted)] truncate font-mono"
                          >
                            <strong className="text-[var(--ink-border)]">Q#{m.questionNumber}</strong> ({m.mockName}): {m.questionText}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Pattern Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] w-full max-w-2xl max-h-[90vh] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga flex flex-col overflow-hidden">
            <div className="p-4 bg-[var(--surface-tag)] border-b-2 border-[var(--ink-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-black text-sm text-[var(--ink-border)]">
                  {editingPattern.id ? 'Edit Question Pattern' : 'Add Question Archetype'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg hover:bg-black/10 text-[var(--ink-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                  Archetype Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Subnetting host calculation with CIDR"
                  value={editingPattern.title || ''}
                  onChange={(e) => setEditingPattern({ ...editingPattern, title: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                  Topic *
                </label>
                <select
                  value={editingPattern.topicId || ''}
                  onChange={(e) => setEditingPattern({ ...editingPattern, topicId: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                  Pattern Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the question archetype, formula, or structure (supports KaTeX $math$)..."
                  value={editingPattern.description || ''}
                  onChange={(e) => setEditingPattern({ ...editingPattern, description: e.target.value })}
                  className="w-full text-xs p-3 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] shadow-manga-sm leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">
                  Standard Trick / Trap *
                </label>
                <textarea
                  rows={3}
                  placeholder="What is the common trap, edge case, or twist the examiner uses? (e.g. $2^{n} - 2$, off-by-one, prefix vs substring)..."
                  value={editingPattern.trickOrTrap || ''}
                  onChange={(e) => setEditingPattern({ ...editingPattern, trickOrTrap: e.target.value })}
                  className="w-full text-xs p-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/50 text-[var(--ink-border)] font-medium shadow-manga-sm leading-relaxed"
                />
              </div>

              {/* Linking mistakes */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--ink-border)]">
                  Link Past Mistakes ({editingPattern.linkedMistakeIds?.length || 0})
                </label>
                <div className="max-h-28 overflow-y-auto p-2 bg-[var(--surface-tag)] rounded-xl border border-[var(--ink-border)] space-y-1">
                  {mistakes.length === 0 ? (
                    <span className="text-[11px] text-[var(--ink-muted)]">No mistakes found.</span>
                  ) : (
                    mistakes.map((m) => {
                      const checked = (editingPattern.linkedMistakeIds || []).includes(m.id!);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-xs p-1 hover:bg-[var(--card-bg)] rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLinkMistake(m.id!)}
                            className="rounded border-[var(--ink-border)]"
                          />
                          <span className="font-bold">[{m.mockName} Q#{m.questionNumber}]</span>
                          <span className="text-[var(--ink-muted)] truncate max-w-sm">{m.questionText}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Linking PYQs */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--ink-border)]">
                  Link PYQs ({editingPattern.linkedPyqIds?.length || 0})
                </label>
                <div className="max-h-28 overflow-y-auto p-2 bg-[var(--surface-tag)] rounded-xl border border-[var(--ink-border)] space-y-1">
                  {pyqs.length === 0 ? (
                    <span className="text-[11px] text-[var(--ink-muted)]">No PYQs found.</span>
                  ) : (
                    pyqs.map((p) => {
                      const checked = (editingPattern.linkedPyqIds || []).includes(p.id!);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 text-xs p-1 hover:bg-[var(--card-bg)] rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLinkPyq(p.id!)}
                            className="rounded border-[var(--ink-border)]"
                          />
                          <span className="font-bold">[{p.examId.toUpperCase()} {p.year} Q#{p.questionNumber}]</span>
                          <span className="text-[var(--ink-muted)] truncate max-w-sm">{p.questionText}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--surface-tag)] border-t-2 border-[var(--ink-border)] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--ink-border)] shadow-manga-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePattern}
                className="px-6 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] hover:bg-[var(--accent-sakura)]/80 text-xs font-bold text-[var(--ink-border)] shadow-manga hover:-translate-y-0.5 transition-all"
              >
                Save Pattern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
