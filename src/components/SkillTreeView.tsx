import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  Zap,
  BookOpen,
  Award,
  ChevronRight,
  TrendingUp,
  Cpu,
  Database,
  Network,
  Binary,
  GitBranch
} from 'lucide-react';
import { SkillTreeNode, UserXPState } from '../types';
import { db } from '../db/db';
import { getXpState, saveXpState, awardXP } from '../utils/xpEngine';

export interface SkillTreeViewProps {
  onStartTopicPractice?: (topicTitle: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const DEFAULT_SKILL_NODES: SkillTreeNode[] = [
  // Tier 1: Foundations
  {
    id: 'math-discrete',
    subject: 'Foundations',
    title: 'Discrete Mathematics & Graph Theory',
    level: 1,
    prerequisites: [],
    status: 'mastered'
  },
  {
    id: 'math-linear-prob',
    subject: 'Foundations',
    title: 'Linear Algebra & Probability',
    level: 1,
    prerequisites: [],
    status: 'mastered'
  },
  {
    id: 'digital-logic',
    subject: 'Hardware & Architecture',
    title: 'Digital Logic & Boolean Algebra',
    level: 1,
    prerequisites: [],
    status: 'mastered'
  },

  // Tier 2: Core Programming & Systems
  {
    id: 'prog-ds',
    subject: 'Software & Algorithms',
    title: 'C Programming & Linear Data Structures',
    level: 2,
    prerequisites: ['math-discrete'],
    status: 'mastered'
  },
  {
    id: 'coa-arch',
    subject: 'Hardware & Architecture',
    title: 'Computer Organization & Pipelining',
    level: 2,
    prerequisites: ['digital-logic'],
    status: 'in_progress'
  },
  {
    id: 'dbms-basics',
    subject: 'Data & Networks',
    title: 'DBMS ER-Model & SQL Queries',
    level: 2,
    prerequisites: ['math-discrete'],
    status: 'mastered'
  },

  // Tier 3: Advanced Core
  {
    id: 'algorithms-adv',
    subject: 'Software & Algorithms',
    title: 'Algorithms: Dynamic Programming & Greedy',
    level: 3,
    prerequisites: ['prog-ds'],
    status: 'in_progress'
  },
  {
    id: 'os-core',
    subject: 'Hardware & Architecture',
    title: 'Operating Systems: Virtual Memory & Sync',
    level: 3,
    prerequisites: ['coa-arch'],
    status: 'in_progress'
  },
  {
    id: 'dbms-transactions',
    subject: 'Data & Networks',
    title: 'Transactions, Serializability & B+ Trees',
    level: 3,
    prerequisites: ['dbms-basics'],
    status: 'unlocked'
  },
  {
    id: 'networks-transport',
    subject: 'Data & Networks',
    title: 'Computer Networks: Subnetting & TCP Flow',
    level: 3,
    prerequisites: ['math-discrete'],
    status: 'in_progress'
  },

  // Tier 4: Theoretical & Synthesis
  {
    id: 'toc-automata',
    subject: 'Theory of Computation',
    title: 'Theory of Computation: DFA, CFG & Decidability',
    level: 4,
    prerequisites: ['math-discrete', 'prog-ds'],
    status: 'unlocked'
  },
  {
    id: 'compiler-design',
    subject: 'Theory of Computation',
    title: 'Compiler Design: LL/LR Parsing & Syntax Translation',
    level: 4,
    prerequisites: ['toc-automata'],
    status: 'locked'
  },
  {
    id: 'system-synthesis',
    subject: 'Synthesis',
    title: 'Full CBT Grand Mock Mastery',
    level: 4,
    prerequisites: ['algorithms-adv', 'os-core', 'networks-transport'],
    status: 'locked'
  }
];

export const SkillTreeView: React.FC<SkillTreeViewProps> = ({
  onStartTopicPractice,
  onNavigateTab
}) => {
  const [nodes, setNodes] = useState<SkillTreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SkillTreeNode | null>(null);
  const [xpState, setXpState] = useState<UserXPState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadNodesAndXp();
  }, []);

  const loadNodesAndXp = async () => {
    try {
      const state = await getXpState();
      setXpState(state);

      const dbNodes = await db.skillTree.toArray();
      if (dbNodes.length > 0) {
        setNodes(dbNodes);
        setSelectedNode(dbNodes[0]);
      } else {
        await db.skillTree.bulkPut(DEFAULT_SKILL_NODES);
        setNodes(DEFAULT_SKILL_NODES);
        setSelectedNode(DEFAULT_SKILL_NODES[0]);
      }
    } catch {
      setNodes(DEFAULT_SKILL_NODES);
      setSelectedNode(DEFAULT_SKILL_NODES[0]);
    }
  };

  const handleUpdateStatus = async (
    nodeId: string,
    newStatus: 'locked' | 'unlocked' | 'in_progress' | 'mastered'
  ) => {
    const updated = nodes.map(n => (n.id === nodeId ? { ...n, status: newStatus } : n));
    setNodes(updated);
    setSelectedNode(prev => (prev?.id === nodeId ? { ...prev, status: newStatus } : prev));

    try {
      await db.skillTree.update(nodeId, { status: newStatus });
    } catch {
      // Non-fatal
    }

    if (newStatus === 'mastered' && xpState) {
      const award = awardXP(xpState, 'topic_mastered');
      setXpState(award.nextState);
      await saveXpState(award.nextState);
      showToast(`Topic Mastered! +${award.xpGained} XP awarded!`);
    } else {
      showToast(`Updated status to: ${newStatus.replace('_', ' ')}`);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Group by level (Tiers 1 to 4)
  const tiers = useMemo(() => {
    const map = new Map<number, SkillTreeNode[]>();
    for (let lvl = 1; lvl <= 4; lvl++) {
      map.set(lvl, []);
    }
    for (const node of nodes) {
      const list = map.get(node.level) || [];
      list.push(node);
      map.set(node.level, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [nodes]);

  const stats = useMemo(() => {
    const total = nodes.length;
    const mastered = nodes.filter(n => n.status === 'mastered').length;
    const inProgress = nodes.filter(n => n.status === 'in_progress').length;
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, inProgress, percent };
  }, [nodes]);

  const getNodeIcon = (subject: string) => {
    switch (subject) {
      case 'Hardware & Architecture':
        return <Cpu className="w-4 h-4" />;
      case 'Data & Networks':
        return <Network className="w-4 h-4" />;
      case 'Theory of Computation':
        return <Binary className="w-4 h-4" />;
      case 'Software & Algorithms':
        return <Database className="w-4 h-4" />;
      default:
        return <GitBranch className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                SPEC B • Gamification Loop
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5" /> RPG Skill Constellation
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-purple-400" /> Syllabus Skill Tree
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Watch nodes illuminate in gold as you conquer syllabus topics, unlock dependent domains, and gain mastery bonuses.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
            <div>
              <div className="text-[11px] text-slate-400">Mastery Coverage</div>
              <div className="text-xl font-black text-emerald-400">
                {stats.mastered} / {stats.total} ({stats.percent}%)
              </div>
            </div>
            <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Skill Tree Map (2 Cols) + Node Inspector (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree Canvas */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-8 shadow-xl">
          {tiers.map(([tierNum, tierNodes]) => (
            <div key={tierNum} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px]">
                    {tierNum}
                  </span>
                  Tier {tierNum}:{' '}
                  {tierNum === 1
                    ? 'Foundations'
                    : tierNum === 2
                    ? 'Core Programming & Logic'
                    : tierNum === 3
                    ? 'Systems & Networks'
                    : 'Grand Synthesis'}
                </span>
                <span className="text-[11px] text-slate-500">{tierNodes.length} Nodes</span>
              </div>

              {/* Node Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {tierNodes.map(node => {
                  const isSelected = selectedNode?.id === node.id;
                  const isMastered = node.status === 'mastered';
                  const isInProgress = node.status === 'in_progress';
                  const isLocked = node.status === 'locked';

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-950/40'
                          : ''
                      } ${
                        isMastered
                          ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/50 shadow-md shadow-amber-500/10'
                          : isInProgress
                          ? 'bg-slate-900/90 border-blue-500/50 ring-1 ring-blue-500/20'
                          : isLocked
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                          : 'bg-slate-900/70 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {/* Glow indicator for mastered nodes */}
                      {isMastered && (
                        <div className="absolute top-0 right-0 w-12 h-12 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
                      )}

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            {getNodeIcon(node.subject)}
                            {node.subject}
                          </span>

                          {isMastered ? (
                            <span className="p-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          ) : isInProgress ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
                              ACTIVE
                            </span>
                          ) : isLocked ? (
                            <span className="p-1 rounded-full bg-slate-800 text-slate-500">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-1 rounded-full bg-slate-800 text-slate-400">
                              <Unlock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-xs font-bold leading-snug line-clamp-2 ${
                            isMastered
                              ? 'text-amber-200'
                              : isInProgress
                              ? 'text-blue-100'
                              : isLocked
                              ? 'text-slate-500'
                              : 'text-slate-200'
                          }`}
                        >
                          {node.title}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                        <span
                          className={`font-semibold capitalize ${
                            isMastered
                              ? 'text-amber-400'
                              : isInProgress
                              ? 'text-blue-400'
                              : isLocked
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {node.status.replace('_', ' ')}
                        </span>
                        {isMastered && <span className="font-bold text-amber-400">+50 XP</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Node Detail Inspector Panel */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          {selectedNode ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                    Tier {selectedNode.level} • {selectedNode.subject}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      selectedNode.status === 'mastered'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : selectedNode.status === 'in_progress'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedNode.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-100">{selectedNode.title}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Conquer this syllabus node by reviewing connected mistake cards, solving PYQs, and locking in your conceptual clarity.
                </p>
              </div>

              {/* Prerequisites check */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Prerequisites:
                </label>
                {selectedNode.prerequisites.length === 0 ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> No prerequisites required (Root Node)
                  </span>
                ) : (
                  <div className="space-y-1.5">
                    {selectedNode.prerequisites.map(prereqId => {
                      const prereq = nodes.find(n => n.id === prereqId);
                      const isPrereqDone = prereq?.status === 'mastered';
                      return (
                        <div
                          key={prereqId}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900 border border-slate-800"
                        >
                          <span className="text-slate-300">{prereq?.title || prereqId}</span>
                          {isPrereqDone ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Met
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                              <Lock className="w-3.5 h-3.5" /> Required
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status Update Controls */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Update Node Status:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedNode.id, 'in_progress')}
                    className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition"
                  >
                    Set In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedNode.id, 'mastered')}
                    className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    <Award className="w-3.5 h-3.5" /> Master (+50 XP)
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedNode.id, 'unlocked')}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Unlock
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedNode.id, 'locked')}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold transition"
                  >
                    Lock
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    if (onStartTopicPractice) {
                      onStartTopicPractice(selectedNode.title);
                    } else if (onNavigateTab) {
                      onNavigateTab('focus');
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4" /> Practice This Topic in Focus Mode
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select a skill node from the constellation map to inspect and unlock.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
