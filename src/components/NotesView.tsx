import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StudyNote, CanonicalTopic, MistakeEntry, PYQ, Pattern } from '../types';
import { db, DEFAULT_CANONICAL_TOPICS } from '../db/db';
import { renderFormattedContent } from './shared/QuestionRenderer';
import { Mascot } from './Mascot';
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Trash2,
  Link2,
  Check,
  X,
  Tag,
  Sparkles,
  Code,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  Eye,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface NotesViewProps {
  initialTopicId?: string;
  onRefresh?: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({ initialTopicId, onRefresh }) => {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [topics, setTopics] = useState<CanonicalTopic[]>([]);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [pyqs, setPyqs] = useState<PYQ[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & selection
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopicId || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);

  // Editor Modal / Panel
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<'write' | 'preview' | 'split'>('split');
  const [editingNote, setEditingNote] = useState<Partial<StudyNote>>({
    title: '',
    topicId: '',
    subtopic: '',
    content: '',
    tags: [],
    linkedMistakeIds: [],
    linkedPyqIds: [],
    linkedPatternIds: []
  });
  const [tagInput, setTagInput] = useState<string>('');

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dbNotes, dbTopics, dbMistakes, dbPyqs, dbPatterns] = await Promise.all([
        db.notes.toArray(),
        db.topics.toArray(),
        db.mistakes.toArray(),
        db.pyqs.toArray(),
        db.patterns.toArray()
      ]);

      setNotes(dbNotes);
      setTopics(dbTopics.length > 0 ? dbTopics : DEFAULT_CANONICAL_TOPICS);
      setMistakes(dbMistakes);
      setPyqs(dbPyqs);
      setPatterns(dbPatterns);

      if (dbNotes.length > 0 && !activeNoteId) {
        setActiveNoteId(dbNotes[0].id || null);
      }
    } catch (err) {
      console.error('Failed to load notes data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeNoteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Topic lookup map
  const topicMap = useMemo(() => {
    const map = new Map<string, CanonicalTopic>();
    topics.forEach((t) => map.set(t.id, t));
    return map;
  }, [topics]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedTopicId !== 'all' && n.topicId !== selectedTopicId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const topicName = topicMap.get(n.topicId)?.name || '';
        const match = `${n.title} ${n.content} ${topicName} ${n.subtopic || ''} ${n.tags.join(' ')}`.toLowerCase();
        return match.includes(q);
      }
      return true;
    });
  }, [notes, selectedTopicId, searchQuery, topicMap]);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || filteredNotes[0] || null;
  }, [notes, activeNoteId, filteredNotes]);

  // Handle open editor for new note
  const handleOpenNewNote = () => {
    const defaultTopic = selectedTopicId !== 'all' ? selectedTopicId : (topics[0]?.id || 'discrete_math');
    setEditingNote({
      title: '',
      topicId: defaultTopic,
      subtopic: '',
      content: '## Summary\n\nKey formula:\n$$E = mc^2$$\n\n```python\n# implementation\n```',
      tags: [],
      linkedMistakeIds: [],
      linkedPyqIds: [],
      linkedPatternIds: []
    });
    setTagInput('');
    setIsEditing(true);
  };

  // Handle open editor for existing note
  const handleOpenEditNote = (note: StudyNote) => {
    setEditingNote({ ...note });
    setTagInput(note.tags.join(', '));
    setIsEditing(true);
  };

  // Two-way save handler
  const handleSaveNote = async () => {
    if (!editingNote.title?.trim() || !editingNote.topicId) {
      alert('Please provide a title and select a topic.');
      return;
    }

    const now = new Date().toISOString();
    const parsedTags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const noteToSave: StudyNote = {
      title: editingNote.title.trim(),
      topicId: editingNote.topicId,
      subtopic: editingNote.subtopic?.trim() || undefined,
      content: editingNote.content || '',
      tags: parsedTags.length > 0 ? parsedTags : (editingNote.tags || []),
      linkedMistakeIds: editingNote.linkedMistakeIds || [],
      linkedPyqIds: editingNote.linkedPyqIds || [],
      linkedPatternIds: editingNote.linkedPatternIds || [],
      createdAt: editingNote.createdAt || now,
      updatedAt: now
    };

    let savedId: number;
    if (editingNote.id) {
      noteToSave.id = editingNote.id;
      await db.notes.put(noteToSave);
      savedId = editingNote.id;
    } else {
      savedId = (await db.notes.add(noteToSave)) as number;
    }

    // Two-way linking persistence: update mistakes
    if (noteToSave.linkedMistakeIds.length > 0) {
      for (const mId of noteToSave.linkedMistakeIds) {
        const m = await db.mistakes.get(mId);
        if (m) {
          const noteIds = new Set(m.linkedNoteIds || []);
          noteIds.add(savedId);
          await db.mistakes.update(mId, { linkedNoteIds: Array.from(noteIds) });
        }
      }
    }

    setIsEditing(false);
    await loadData();
    setActiveNoteId(savedId);
    if (onRefresh) onRefresh();
  };

  // Delete note
  const handleDeleteNote = async (id: number) => {
    if (!confirm('Are you sure you want to delete this study note?')) return;
    await db.notes.delete(id);
    await loadData();
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
    if (onRefresh) onRefresh();
  };

  // Toggle linked mistake
  const toggleLinkMistake = (mistakeId: number) => {
    const current = new Set(editingNote.linkedMistakeIds || []);
    if (current.has(mistakeId)) {
      current.delete(mistakeId);
    } else {
      current.add(mistakeId);
    }
    setEditingNote({ ...editingNote, linkedMistakeIds: Array.from(current) });
  };

  // Toggle linked PYQ
  const toggleLinkPyq = (pyqId: number) => {
    const current = new Set(editingNote.linkedPyqIds || []);
    if (current.has(pyqId)) {
      current.delete(pyqId);
    } else {
      current.add(pyqId);
    }
    setEditingNote({ ...editingNote, linkedPyqIds: Array.from(current) });
  };

  // Toggle linked Pattern
  const toggleLinkPattern = (patternId: number) => {
    const current = new Set(editingNote.linkedPatternIds || []);
    if (current.has(patternId)) {
      current.delete(patternId);
    } else {
      current.add(patternId);
    }
    setEditingNote({ ...editingNote, linkedPatternIds: Array.from(current) });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-[var(--ink-border)]">
              Topic Notes & Formulas
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
              KaTeX & Markdown
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Topic-wise revision notes with rich math formulas, code blocks, and two-way links to mistakes and PYQs.
          </p>
        </div>

        <button
          onClick={handleOpenNewNote}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] hover:bg-[var(--accent-sakura)]/80 text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search notes by title, formula, code, or tags..."
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
          <option value="all">All Topics ({notes.length} notes)</option>
          {topics.map((t) => {
            const count = notes.filter((n) => n.topicId === t.id).length;
            return (
              <option key={t.id} value={t.id}>
                {t.name} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* Main Notes Layout: Two Columns (Note list + Active Note Detail) */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
          <div className="flex justify-center">
            <Mascot mood="reading" size="xl" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--ink-border)]">
              {notes.length === 0 ? 'No Topic Notes Yet' : 'No Notes Match Your Filter'}
            </h3>
            <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto mt-1">
              {notes.length === 0
                ? 'Create rich markdown notes with KaTeX math equations ($E = mc^2$) and link them to your exam mistakes.'
                : 'Try clearing your search query or switching to another topic.'}
            </p>
          </div>
          <button
            onClick={handleOpenNewNote}
            className="px-5 py-2.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 transition-all"
          >
            Create First Topic Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Notes Sidebar List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--ink-muted)] px-1">
              <span>{filteredNotes.length} Notes</span>
            </div>

            <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {filteredNotes.map((note) => {
                const isSelected = activeNote?.id === note.id;
                const topic = topicMap.get(note.topicId);
                return (
                  <div
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id || null)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[var(--ink-border)] bg-[var(--accent-sakura)]/20 shadow-manga'
                        : 'border-[var(--ink-border)] bg-[var(--card-bg)] hover:bg-[var(--surface-tag)] shadow-manga-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs text-[var(--ink-border)] line-clamp-1">
                        {note.title}
                      </h4>
                      {note.linkedMistakeIds.length > 0 && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 border border-amber-500/30">
                          {note.linkedMistakeIds.length} mistakes
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--ink-muted)] font-mono">
                      <span className="font-bold text-[var(--accent-twilight)]">
                        {topic?.name || note.topicId}
                      </span>
                      {note.subtopic && <span>• {note.subtopic}</span>}
                    </div>

                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[var(--surface-tag)] border border-[var(--ink-border)]/20 text-[var(--ink-muted)]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Note Preview Panel (8 cols) */}
          <div className="lg:col-span-8">
            {activeNote && (
              <div className="p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-6">
                {/* Note Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-[var(--ink-border)]/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-black">
                        {topicMap.get(activeNote.topicId)?.name || activeNote.topicId}
                      </span>
                      {activeNote.subtopic && (
                        <span className="text-xs text-[var(--ink-muted)] font-bold">
                          {activeNote.subtopic}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-xl font-black text-[var(--ink-border)]">
                      {activeNote.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditNote(activeNote)}
                      className="px-3 py-1.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] hover:bg-[var(--accent-sakura)]/50 text-[var(--ink-border)] text-xs font-bold shadow-manga-sm flex items-center gap-1.5 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {activeNote.id && (
                      <button
                        onClick={() => handleDeleteNote(activeNote.id!)}
                        className="p-1.5 rounded-xl border-2 border-[var(--ink-border)] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-xs font-bold shadow-manga-sm transition-all"
                        title="Delete Note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Markdown + KaTeX Formatted Content */}
                <div className="prose dark:prose-invert max-w-none text-xs text-[var(--ink-border)] leading-relaxed space-y-3">
                  {renderFormattedContent(activeNote.content)}
                </div>

                {/* Two-Way Linked Mistakes Section */}
                {activeNote.linkedMistakeIds.length > 0 && (
                  <div className="pt-4 border-t-2 border-[var(--ink-border)]/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-display font-black text-[var(--ink-border)]">
                      <Link2 className="w-4 h-4 text-amber-500" />
                      <span>Linked Mistakes ({activeNote.linkedMistakeIds.length})</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeNote.linkedMistakeIds.map((mId) => {
                        const m = mistakes.find((item) => item.id === mId);
                        if (!m) return null;
                        return (
                          <div
                            key={mId}
                            className="p-3 rounded-xl bg-[var(--surface-tag)] border-2 border-[var(--ink-border)] text-xs space-y-1 shadow-manga-sm"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                              <span className="font-bold">{m.mockName} • Q#{m.questionNumber}</span>
                              <span className="text-rose-500 font-bold">{m.resultType}</span>
                            </div>
                            <p className="font-bold text-[var(--ink-border)] line-clamp-2">
                              {m.questionText}
                            </p>
                            {m.ruleToRemember && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                <strong>Rule:</strong> {m.ruleToRemember}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Two-Way Linked PYQs Section */}
                {activeNote.linkedPyqIds.length > 0 && (
                  <div className="pt-4 border-t-2 border-[var(--ink-border)]/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-display font-black text-[var(--ink-border)]">
                      <Layers className="w-4 h-4 text-purple-500" />
                      <span>Linked PYQs ({activeNote.linkedPyqIds.length})</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeNote.linkedPyqIds.map((pyqId) => {
                        const p = pyqs.find((item) => item.id === pyqId);
                        if (!p) return null;
                        return (
                          <div
                            key={pyqId}
                            className="p-3 rounded-xl bg-[var(--surface-tag)] border-2 border-[var(--ink-border)] text-xs space-y-1 shadow-manga-sm"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                              <span className="font-bold">{p.examId.toUpperCase()} {p.year} • Q#{p.questionNumber}</span>
                              <span className="text-purple-600 font-bold">{p.marks} marks</span>
                            </div>
                            <p className="font-bold text-[var(--ink-border)] line-clamp-2">
                              {p.questionText}
                            </p>
                            {p.correctAnswer && (
                              <span className="text-[10px] font-mono text-emerald-600 block">
                                Ans: {p.correctAnswer}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Linked Pattern Book Archetypes */}
                {activeNote.linkedPatternIds.length > 0 && (
                  <div className="pt-4 border-t-2 border-[var(--ink-border)]/20 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-display font-black text-[var(--ink-border)]">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span>Linked Question Patterns ({activeNote.linkedPatternIds.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeNote.linkedPatternIds.map((patId) => {
                        const pat = patterns.find((item) => item.id === patId);
                        if (!pat) return null;
                        return (
                          <span
                            key={patId}
                            className="px-2.5 py-1 rounded-lg border-2 border-[var(--ink-border)] bg-[var(--accent-mint)]/20 text-xs font-bold text-[var(--ink-border)]"
                          >
                            {pat.title}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] w-full max-w-4xl max-h-[90vh] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-[var(--surface-tag)] border-b-2 border-[var(--ink-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--accent-twilight)]" />
                <h3 className="font-display font-black text-sm text-[var(--ink-border)]">
                  {editingNote.id ? 'Edit Study Note' : 'Create New Topic Note'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg hover:bg-black/10 text-[var(--ink-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                    Note Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dijkstra vs Bellman-Ford Shortest Paths"
                    value={editingNote.title || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                    Canonical Topic *
                  </label>
                  <select
                    value={editingNote.topicId || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, topicId: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                    Subtopic (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fibonacci Heap Optimization"
                    value={editingNote.subtopic || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, subtopic: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink-border)] mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. dijkstra, time-complexity, gate-cs"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
                  />
                </div>
              </div>

              {/* Two-Way Links Section */}
              <div className="p-4 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] space-y-3">
                <span className="text-xs font-display font-black text-[var(--ink-border)] block">
                  Two-Way References (Link to Mistakes & PYQs)
                </span>

                {/* Link Mistakes */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--ink-muted)] mb-1">
                    Link Logged Mistakes ({editingNote.linkedMistakeIds?.length || 0} selected)
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-[var(--card-bg)] rounded-xl border border-[var(--ink-border)]">
                    {mistakes.length === 0 ? (
                      <span className="text-[11px] text-[var(--ink-muted)]">No mistakes logged yet.</span>
                    ) : (
                      mistakes.map((m) => {
                        const checked = (editingNote.linkedMistakeIds || []).includes(m.id!);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center gap-2 text-xs p-1 hover:bg-[var(--surface-tag)] rounded cursor-pointer"
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

                {/* Link PYQs */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--ink-muted)] mb-1">
                    Link PYQ Questions ({editingNote.linkedPyqIds?.length || 0} selected)
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-[var(--card-bg)] rounded-xl border border-[var(--ink-border)]">
                    {pyqs.length === 0 ? (
                      <span className="text-[11px] text-[var(--ink-muted)]">No PYQs found in database.</span>
                    ) : (
                      pyqs.map((p) => {
                        const checked = (editingNote.linkedPyqIds || []).includes(p.id!);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 text-xs p-1 hover:bg-[var(--surface-tag)] rounded cursor-pointer"
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

              {/* Content Editor Toolbar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-[var(--ink-border)]">
                      Markdown & Math Content *
                    </label>
                    <span className="text-[10px] text-[var(--ink-muted)] font-mono">
                      (Inline math: $x$, Block math: $$, Code: ```lang)
                    </span>
                  </div>

                  <div className="flex p-0.5 rounded-lg bg-[var(--surface-tag)] border border-[var(--ink-border)] text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setEditMode('write')}
                      className={`px-2 py-0.5 rounded ${editMode === 'write' ? 'bg-[var(--card-bg)] shadow-xs' : 'text-[var(--ink-muted)]'}`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode('split')}
                      className={`px-2 py-0.5 rounded ${editMode === 'split' ? 'bg-[var(--card-bg)] shadow-xs' : 'text-[var(--ink-muted)]'}`}
                    >
                      Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode('preview')}
                      className={`px-2 py-0.5 rounded ${editMode === 'preview' ? 'bg-[var(--card-bg)] shadow-xs' : 'text-[var(--ink-muted)]'}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                <div className={`grid gap-4 ${editMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {editMode !== 'preview' && (
                    <textarea
                      rows={12}
                      value={editingNote.content || ''}
                      onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                      placeholder="Write markdown here with $O(V \log V)$ KaTeX formulas and ```python code blocks..."
                      className="w-full text-xs font-mono p-3 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] shadow-manga-sm leading-relaxed"
                    />
                  )}

                  {editMode !== 'write' && (
                    <div className="p-3 max-h-[300px] overflow-y-auto rounded-xl bg-[var(--surface-tag)] border-2 border-[var(--ink-border)] text-xs text-[var(--ink-border)] shadow-manga-sm">
                      <span className="text-[10px] font-mono font-bold text-[var(--ink-muted)] block mb-2 uppercase">
                        Live KaTeX Preview
                      </span>
                      {renderFormattedContent(editingNote.content || '')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                onClick={handleSaveNote}
                className="px-6 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] hover:bg-[var(--accent-sakura)]/80 text-xs font-bold text-[var(--ink-border)] shadow-manga hover:-translate-y-0.5 transition-all"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
