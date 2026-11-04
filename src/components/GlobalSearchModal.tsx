import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  CheckSquare,
  AlertOctagon,
  BookOpen,
  Target,
  ListTodo,
  ArrowRight,
  Sparkles,
  Command
} from 'lucide-react';
import { MockTest, MistakeEntry, PaperTest, StudyTask, ExamSettings } from '../types';
import { NavTab } from './Sidebar';

export interface SearchResultItem {
  id: string;
  type: 'mock' | 'mistake' | 'paper' | 'task' | 'topic';
  title: string;
  subtitle: string;
  badge: string;
  tab: NavTab;
  dataId?: number | string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab, targetId?: number | string) => void;
  mocks: MockTest[];
  mistakes: MistakeEntry[];
  papers: PaperTest[];
  tasks: StudyTask[];
  settings: ExamSettings;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  mocks,
  mistakes,
  papers,
  tasks,
  settings
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Aggregate searchable items
  const results: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: SearchResultItem[] = [];

    // Search Mocks
    mocks.forEach(m => {
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchSource = (m.source || '').toLowerCase().includes(q);
      const matchNotes = (m.notes || '').toLowerCase().includes(q);
      if (matchName || matchSource || matchNotes) {
        items.push({
          id: `mock-${m.id}`,
          type: 'mock',
          title: m.name,
          subtitle: `${m.date} • Score: ${m.totalNetScore} • Acc: ${m.overallAccuracy}%`,
          badge: m.attemptType ? m.attemptType.toUpperCase() : 'MOCK',
          tab: 'mocks',
          dataId: m.id
        });
      }
    });

    // Search Mistakes
    mistakes.forEach(m => {
      const matchText = (m.questionText || '').toLowerCase().includes(q);
      const matchTopic = (m.topic || '').toLowerCase().includes(q);
      const matchRule = (m.ruleToRemember || '').toLowerCase().includes(q);
      const matchWrong = (m.whatWentWrong || '').toLowerCase().includes(q);
      const matchTags = (m.tags || []).some(t => t.toLowerCase().includes(q));

      if (matchText || matchTopic || matchRule || matchWrong || matchTags) {
        items.push({
          id: `mistake-${m.id}`,
          type: 'mistake',
          title: m.questionText ? m.questionText.slice(0, 75) + (m.questionText.length > 75 ? '...' : '') : `Mistake #${m.id}`,
          subtitle: `${m.sectionName} > ${m.topic} • ${m.resultType} (${m.status})`,
          badge: 'MISTAKE',
          tab: 'mistakes',
          dataId: m.id
        });
      }
    });

    // Search Papers
    papers.forEach(p => {
      const matchName = (p.examName || '').toLowerCase().includes(q);
      const matchYear = String(p.year).includes(q);
      const matchShift = (p.shift || '').toLowerCase().includes(q);
      const matchQuestions = (p.questions || []).some(qItem => (qItem.text || '').toLowerCase().includes(q));

      if (matchName || matchYear || matchShift || matchQuestions) {
        items.push({
          id: `paper-${p.id}`,
          type: 'paper',
          title: `${p.examName} (${p.year}${p.shift ? ` - ${p.shift}` : ''})`,
          subtitle: `${p.isMemoryBased ? 'Memory-Based' : 'Official PYQ'} • ${p.questions?.length || 0} Questions`,
          badge: 'PAPER',
          tab: 'papers',
          dataId: p.id
        });
      }
    });

    // Search Study Tasks
    tasks.forEach(t => {
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchSubject = (t.subject || '').toLowerCase().includes(q);
      const matchTopic = (t.topic || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);

      if (matchTitle || matchSubject || matchTopic || matchDesc) {
        items.push({
          id: `task-${t.id}`,
          type: 'task',
          title: t.title,
          subtitle: `${t.subject}${t.topic ? ` > ${t.topic}` : ''} • Due: ${t.dueDate} • ${t.priority} Priority`,
          badge: t.isCompleted ? 'COMPLETED' : 'TASK',
          tab: 'planner',
          dataId: t.id
        });
      }
    });

    // Search Topics in Settings Taxonomy
    settings.sections.forEach(sec => {
      (sec.topics || []).forEach(topic => {
        if (topic.toLowerCase().includes(q)) {
          items.push({
            id: `topic-${sec.id}-${topic}`,
            type: 'topic',
            title: topic,
            subtitle: `${sec.name} Taxonomy Topic`,
            badge: 'TOPIC',
            tab: 'planner'
          });
        }
      });
    });

    return items.slice(0, 30);
  }, [query, mocks, mistakes, papers, tasks, settings]);

  // Adjust selection bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        const item = results[selectedIndex];
        onNavigate(item.tab, item.dataId);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-panel)] border-3 border-[var(--border-primary)] shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <Search className="w-5 h-5 text-[var(--action-primary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search mocks, mistakes, papers, study tasks, and topics..."
            className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-base font-medium outline-hidden"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-muted)]">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto flex-1 p-2 divide-y divide-[var(--border-subtle)]">
          {query.trim() === '' ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-[var(--action-primary)] opacity-70" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Quick Keyboard Search</p>
              <p className="text-xs mt-1">Search real mock scores, question error logs, exam papers, tasks, and topics.</p>
              <div className="flex justify-center gap-2 mt-4 text-[11px] font-mono text-[var(--text-secondary)]">
                <span className="px-2 py-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)]">↑ / ↓ to navigate</span>
                <span className="px-2 py-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)]">Enter to select</span>
                <span className="px-2 py-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)]">Esc to close</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">No matching results found</p>
              <p className="text-xs mt-1">Try searching by topic name, exam shift, error rule, or question text.</p>
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.tab, item.dataId);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--action-primary)] text-white'
                      : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)]'
                      }`}
                    >
                      {item.type === 'mock' && <CheckSquare className="w-4 h-4" />}
                      {item.type === 'mistake' && <AlertOctagon className="w-4 h-4" />}
                      {item.type === 'paper' && <BookOpen className="w-4 h-4" />}
                      {item.type === 'task' && <ListTodo className="w-4 h-4" />}
                      {item.type === 'topic' && <Target className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                        {item.title}
                      </p>
                      <p
                        className={`text-xs truncate ${
                          isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-sm font-bold uppercase ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{results.length} result(s) found</span>
            <span className="font-mono text-[11px]">Press Enter to open</span>
          </div>
        )}
      </div>
    </div>
  );
};

