import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_CANONICAL_TOPICS } from '../db/db';
import { CanonicalTopic, TopicCategory } from '../types';
import {
  SUPPORTED_EXAMS,
  getOverlapTaxonomySummary,
  computeAllTopicsMastery,
  computeCombinedTopicMastery,
  CombinedTopicMastery
} from '../utils/topicGraph';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  BookOpen,
  HelpCircle,
  X,
  Share2,
  FileText
} from 'lucide-react';

export interface OverlapMapProps {
  onNavigate?: (tab: string, filter?: { topic?: string; topicId?: string; examId?: string }) => void;
  onSelectTopic?: (topic: CanonicalTopic) => void;
  className?: string;
}

export const OverlapMap: React.FC<OverlapMapProps> = ({
  onNavigate,
  onSelectTopic,
  className = ''
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | TopicCategory>('All');
  const [examFilter, setExamFilter] = useState<'all' | 'gate-cs' | 'sebi-it' | 'ibps-so-it' | 'overlap-only' | 'golden-core'>('all');

  // Live queries from Dexie database
  const liveTopics = useLiveQuery(() => db.topics.toArray(), []);
  const liveProgress = useLiveQuery(() => db.syllabusProgress.toArray(), []);
  const liveMistakes = useLiveQuery(() => db.mistakes.toArray(), []);
  const livePyqs = useLiveQuery(() => db.pyqs.toArray(), []);

  const topics = useMemo(() => {
    return liveTopics && liveTopics.length > 0 ? liveTopics : DEFAULT_CANONICAL_TOPICS;
  }, [liveTopics]);

  const summary = useMemo(() => {
    return getOverlapTaxonomySummary(topics);
  }, [topics]);

  const allMasteryMap = useMemo(() => {
    const list = computeAllTopicsMastery(topics, liveProgress || [], liveMistakes || []);
    const map = new Map<string, CombinedTopicMastery>();
    for (const item of list) {
      map.set(item.topicId, item);
    }
    return map;
  }, [topics, liveProgress, liveMistakes]);

  // Selected topic details
  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return topics.find(t => t.id === selectedTopicId) || null;
  }, [selectedTopicId, topics]);

  const selectedMastery = useMemo(() => {
    if (!selectedTopic) return null;
    return computeCombinedTopicMastery(selectedTopic, liveProgress || [], liveMistakes || []);
  }, [selectedTopic, liveProgress, liveMistakes]);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter(t => {
      // Category filter
      if (categoryFilter !== 'All' && t.category !== categoryFilter) {
        return false;
      }

      const tested = t.overlapExams?.length ? t.overlapExams : t.examTags;

      // Exam filter
      if (examFilter === 'golden-core') {
        const isGolden = Object.keys(SUPPORTED_EXAMS).every(e => tested.includes(e));
        if (!isGolden) return false;
      } else if (examFilter === 'overlap-only') {
        if (tested.length <= 1) return false;
      } else if (examFilter !== 'all') {
        if (!tested.includes(examFilter)) return false;
      }

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = t.name.toLowerCase().includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        const matchSub = t.subtopics.some(s => s.toLowerCase().includes(q));
        if (!matchName && !matchId && !matchSub) return false;
      }

      return true;
    });
  }, [topics, categoryFilter, examFilter, searchQuery]);

  // Group filtered topics by category
  const groupedTopics = useMemo(() => {
    const groups: Record<TopicCategory, CanonicalTopic[]> = {
      'Core CS': [],
      'IT-officer': [],
      'Common': []
    };
    for (const t of filteredTopics) {
      if (groups[t.category]) {
        groups[t.category].push(t);
      }
    }
    return groups;
  }, [filteredTopics]);

  const handleCardClick = (topic: CanonicalTopic) => {
    setSelectedTopicId(topic.id);
    if (onSelectTopic) {
      onSelectTopic(topic);
    }
  };

  // Stats calculation
  const totalMasteredCount = useMemo(() => {
    let count = 0;
    allMasteryMap.forEach(m => {
      if (m.status === 'Mastered') count++;
    });
    return count;
  }, [allMasteryMap]);

  return (
    <div className={`overlap-map flex flex-col gap-6 text-neutral-100 ${className}`}>
      {/* Header & Overview Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Layers className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">Cross-Exam Syllabus Overlap & Topic Graph</h1>
            </div>
            <p className="text-xs text-neutral-400">
              Taxonomy map aligning <span className="text-indigo-400 font-medium">GATE CS</span>,{' '}
              <span className="text-emerald-400 font-medium">SEBI IT</span>, and{' '}
              <span className="text-amber-400 font-medium">IBPS SO IT</span> syllabus requirements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded-full border border-neutral-700">
              {topics.length} Canonical Topics
            </span>
            <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
              {totalMasteredCount} Mastered
            </span>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">Core CS Foundation</div>
            <div className="text-xl font-bold text-indigo-400 mt-1">{summary.categoryCounts['Core CS']} Topics</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">High GATE & IT-officer overlap</div>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">3-Way Golden Core</div>
            <div className="text-xl font-bold text-amber-400 mt-1">{summary.allThreeCount} Topics</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">100% synergy across all 3 exams</div>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">IT-Officer Specifics</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{summary.categoryCounts['IT-officer']} Topics</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Security, Cloud, Testing, AI</div>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">Aptitude & Common</div>
            <div className="text-xl font-bold text-cyan-400 mt-1">{summary.categoryCounts['Common']} Topics</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Quant, Reasoning, English, GA</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search topics or subtopics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Category Filter */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            {(['All', 'Core CS', 'IT-officer', 'Common'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  categoryFilter === cat
                    ? 'bg-neutral-800 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {cat === 'All' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          {/* Exam Scope Filter */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setExamFilter('all')}
              className={`px-2 py-1 rounded-md transition-colors ${
                examFilter === 'all'
                  ? 'bg-neutral-800 text-white font-medium'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Exams
            </button>
            <button
              onClick={() => setExamFilter('golden-core')}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                examFilter === 'golden-core'
                  ? 'bg-amber-950 text-amber-300 font-medium border border-amber-800'
                  : 'text-neutral-400 hover:text-amber-300'
              }`}
              title="Topics tested in GATE CS, SEBI IT, and IBPS SO IT"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              Golden Core
            </button>
            <button
              onClick={() => setExamFilter('overlap-only')}
              className={`px-2 py-1 rounded-md transition-colors ${
                examFilter === 'overlap-only'
                  ? 'bg-indigo-950 text-indigo-300 font-medium border border-indigo-800'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Overlap (2+)
            </button>
            <button
              onClick={() => setExamFilter('gate-cs')}
              className={`px-2 py-1 rounded-md transition-colors ${
                examFilter === 'gate-cs'
                  ? 'bg-indigo-950 text-indigo-300 font-medium'
                  : 'text-neutral-400 hover:text-indigo-300'
              }`}
            >
              GATE
            </button>
            <button
              onClick={() => setExamFilter('sebi-it')}
              className={`px-2 py-1 rounded-md transition-colors ${
                examFilter === 'sebi-it'
                  ? 'bg-emerald-950 text-emerald-300 font-medium'
                  : 'text-neutral-400 hover:text-emerald-300'
              }`}
            >
              SEBI
            </button>
            <button
              onClick={() => setExamFilter('ibps-so-it')}
              className={`px-2 py-1 rounded-md transition-colors ${
                examFilter === 'ibps-so-it'
                  ? 'bg-amber-950 text-amber-300 font-medium'
                  : 'text-neutral-400 hover:text-amber-300'
              }`}
            >
              IBPS SO
            </button>
          </div>
        </div>
      </div>

      {/* Main Topic Grid grouped by Category */}
      {(['Core CS', 'IT-officer', 'Common'] as TopicCategory[]).map(category => {
        const catTopics = groupedTopics[category];
        if (catTopics.length === 0) return null;

        const categoryTitle =
          category === 'Core CS'
            ? 'Core Computer Science'
            : category === 'IT-officer'
            ? 'IT-Officer Stream Additions'
            : 'Common Aptitude & General Awareness';

        const categoryDesc =
          category === 'Core CS'
            ? 'Foundational theoretical and systems subjects tested in GATE CS and officer-level technical papers.'
            : category === 'IT-officer'
            ? 'Applied software engineering, infosec, testing, and modern cloud technologies.'
            : 'Sectional non-technical papers tested in SEBI Grade A (Phase 1) and IBPS SO (Prelims).';

        return (
          <div key={category} className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <div>
                <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                  <span>{categoryTitle}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-normal">
                    {catTopics.length}
                  </span>
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">{categoryDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catTopics.map(topic => {
                const mastery = allMasteryMap.get(topic.id);
                const tested = topic.overlapExams?.length ? topic.overlapExams : topic.examTags;
                const isSelected = selectedTopicId === topic.id;
                const isGolden = Object.keys(SUPPORTED_EXAMS).every(e => tested.includes(e));

                return (
                  <div
                    key={topic.id}
                    onClick={() => handleCardClick(topic)}
                    className={`group relative rounded-xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-neutral-850 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850'
                    }`}
                  >
                    {/* Top Row: Title + Golden Core tag */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm text-neutral-100 group-hover:text-indigo-300 transition-colors">
                        {topic.name}
                      </h3>
                      {isGolden && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 shrink-0">
                          <Sparkles className="w-2.5 h-2.5" />
                          Golden
                        </span>
                      )}
                    </div>

                    {/* Exam Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {tested.map(examId => {
                        const meta = SUPPORTED_EXAMS[examId];
                        if (!meta) return null;
                        return (
                          <span
                            key={examId}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${meta.badgeBg} ${meta.badgeText} ${meta.border}`}
                          >
                            {meta.shortName}
                          </span>
                        );
                      })}
                      <span className="text-[10px] text-neutral-500 ml-auto">
                        {tested.length === 3
                          ? 'All 3 Exams'
                          : tested.length === 2
                          ? '2 Exams Overlap'
                          : 'Single Exam'}
                      </span>
                    </div>

                    {/* Subtopics snippet */}
                    <div className="text-[11px] text-neutral-400 mb-3 line-clamp-2">
                      {topic.subtopics.join(' • ')}
                    </div>

                    {/* Bottom Row: Combined Mastery Bar & Status */}
                    <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        {mastery?.status === 'Mastered' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : mastery?.status === 'In progress' ? (
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        )}
                        <span
                          className={`text-[11px] font-medium ${
                            mastery?.status === 'Mastered'
                              ? 'text-emerald-400'
                              : mastery?.status === 'In progress'
                              ? 'text-amber-400'
                              : 'text-neutral-500'
                          }`}
                        >
                          {mastery?.status || 'Not started'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {mastery && mastery.activeMistakes > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-950/60 border border-red-900/60 text-red-400">
                            {mastery.activeMistakes} active error{mastery.activeMistakes > 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-neutral-300">
                          {mastery?.masteryScore || 0}%
                        </span>
                      </div>
                    </div>

                    {/* Mastery mini meter */}
                    <div className="w-full bg-neutral-800 h-1 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          (mastery?.masteryScore || 0) >= 80
                            ? 'bg-emerald-500'
                            : (mastery?.masteryScore || 0) >= 40
                            ? 'bg-amber-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${mastery?.masteryScore || 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredTopics.length === 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-neutral-300">No topics match your filter</h3>
          <p className="text-xs text-neutral-500 mt-1">Try resetting search keywords or selecting "All Exams".</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('All');
              setExamFilter('all');
            }}
            className="mt-3 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Interactive Topic Detail Drawer / Modal */}
      {selectedTopic && selectedMastery && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase tracking-wider">
                    {selectedTopic.category}
                  </span>
                  {selectedTopic.subtopics.length > 0 && (
                    <span className="text-[11px] text-neutral-500">
                      {selectedTopic.subtopics.length} subtopics
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedTopic.name}</h2>
                <div className="text-xs font-mono text-neutral-500">ID: {selectedTopic.id}</div>
              </div>

              <button
                onClick={() => setSelectedTopicId(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-5 py-4">
              {/* Where Else is this Tested? */}
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                    Cross-Exam Presence & Overlap
                  </h4>
                  <span className="text-xs font-semibold text-neutral-400">
                    {selectedMastery.testedExams.length} of 3 Exams
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  {Object.entries(SUPPORTED_EXAMS).map(([examId, meta]) => {
                    const isTested = selectedMastery.testedExams.includes(examId);
                    const status = selectedMastery.syllabusStatuses[examId];

                    return (
                      <div
                        key={examId}
                        className={`p-3 rounded-lg border flex flex-col justify-between ${
                          isTested
                            ? `${meta.badgeBg} ${meta.border}`
                            : 'bg-neutral-900/40 border-neutral-800/60 opacity-40'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-neutral-200">{meta.shortName}</div>
                          <div className="text-[10px] text-neutral-400">{meta.name}</div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px]">
                          <span className={isTested ? 'text-neutral-300' : 'text-neutral-500'}>
                            {isTested ? 'Tested in syllabus' : 'Not tested'}
                          </span>
                          {isTested && status && (
                            <span
                              className={`font-semibold capitalize ${
                                status === 'mastered'
                                  ? 'text-emerald-400'
                                  : status === 'in_progress'
                                  ? 'text-amber-400'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {status.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Combined Mastery Status */}
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Combined Topic Mastery Level
                  </h4>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      selectedMastery.status === 'Mastered'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : selectedMastery.status === 'In progress'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    {selectedMastery.status}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-3xl font-extrabold font-mono text-white">
                    {selectedMastery.masteryScore}%
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          selectedMastery.masteryScore >= 80
                            ? 'bg-emerald-500'
                            : selectedMastery.masteryScore >= 40
                            ? 'bg-amber-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${selectedMastery.masteryScore}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">{selectedMastery.reason}</p>
                  </div>
                </div>

                {/* Evidence Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-neutral-800 text-center">
                  <div className="bg-neutral-900/60 p-2 rounded-lg">
                    <div className="text-[10px] text-neutral-400">Total Mistakes</div>
                    <div className="text-sm font-bold text-neutral-200 mt-0.5">
                      {selectedMastery.totalMistakes}
                    </div>
                    <div className="text-[9px] text-neutral-500">
                      {selectedMastery.activeMistakes} active / {selectedMastery.masteredMistakes} mastered
                    </div>
                  </div>

                  <div className="bg-neutral-900/60 p-2 rounded-lg">
                    <div className="text-[10px] text-neutral-400">PYQs Solved</div>
                    <div className="text-sm font-bold text-neutral-200 mt-0.5">
                      {selectedMastery.pyqsSolved} / {selectedMastery.totalPyqs}
                    </div>
                    <div className="text-[9px] text-neutral-500">across exams</div>
                  </div>

                  <div className="bg-neutral-900/60 p-2 rounded-lg">
                    <div className="text-[10px] text-neutral-400">Avg Confidence</div>
                    <div className="text-sm font-bold text-neutral-200 mt-0.5">
                      {selectedMastery.confidenceAvg}%
                    </div>
                    <div className="text-[9px] text-neutral-500">self-assessment</div>
                  </div>
                </div>
              </div>

              {/* Subtopics Detailed Breakdown */}
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  Canonical Subtopics ({selectedTopic.subtopics.length})
                </h4>
                <div className="flex flex-col gap-1.5 mt-2 max-h-44 overflow-y-auto pr-1">
                  {selectedTopic.subtopics.map((sub, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-neutral-300 bg-neutral-900/80 px-2.5 py-1.5 rounded-lg border border-neutral-800/80 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span>{sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions / Jump Links */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedTopicId(null);
                    onNavigate?.('syllabus', { topicId: selectedTopic.id });
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  Track in Syllabus
                </button>

                <button
                  onClick={() => {
                    setSelectedTopicId(null);
                    onNavigate?.('pyqs', { topicId: selectedTopic.id });
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Practice PYQs
                </button>

                <button
                  onClick={() => {
                    setSelectedTopicId(null);
                    onNavigate?.('mistakes', { topic: selectedTopic.name });
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1.5 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  Mistakes ({selectedMastery.totalMistakes})
                </button>
              </div>

              <button
                onClick={() => setSelectedTopicId(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
