import React, { useState, useEffect } from 'react';
import {
  X,
  Swords,
  Flame,
  Heart,
  Shield,
  Zap,
  Award,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserXPState } from '../types';
import { awardXP, getXpState, saveXpState } from '../utils/xpEngine';

export interface BossQuestion {
  id: number;
  question: string;
  topic: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const DEFAULT_BOSS_QUESTIONS: BossQuestion[] = [
  {
    id: 1,
    topic: 'Algorithms',
    question: 'What is the worst-case time complexity of Bellman-Ford algorithm on a graph with V vertices and E edges?',
    options: ['O(V + E)', 'O(V * E)', 'O(E log V)', 'O(V^3)'],
    correctIndex: 1,
    explanation: 'Bellman-Ford relaxes all E edges (V - 1) times, resulting in O(V * E) time complexity.'
  },
  {
    id: 2,
    topic: 'Computer Networks',
    question: 'A subnet has mask 255.255.255.240 (/28). How many usable host IP addresses are available in this subnet?',
    options: ['16', '14', '30', '32'],
    correctIndex: 1,
    explanation: '2^(32 - 28) = 16 total IP addresses. Subtracting network address and broadcast address yields 14 usable hosts.'
  },
  {
    id: 3,
    topic: 'Operating Systems',
    question: 'In a paging system with 32-bit virtual addresses and 4 KB page size, how many bits represent the page offset?',
    options: ['10 bits', '12 bits', '20 bits', '16 bits'],
    correctIndex: 1,
    explanation: 'Page size of 4 KB = 2^12 bytes. Therefore, the lowest 12 bits represent the page offset.'
  },
  {
    id: 4,
    topic: 'DBMS',
    question: 'A relation R(A, B, C) has functional dependencies A -> B and B -> C. Which normal form is violated?',
    options: ['1NF', '2NF', '3NF', 'BCNF only'],
    correctIndex: 2,
    explanation: 'There is a transitive dependency A -> C via non-prime attribute B, which violates 3NF.'
  },
  {
    id: 5,
    topic: 'Digital Logic',
    question: 'How many 2-to-1 multiplexers are required to implement a 4-to-1 multiplexer?',
    options: ['2', '3', '4', '5'],
    correctIndex: 1,
    explanation: 'A 4-to-1 multiplexer requires 2 multiplexers in the first stage and 1 multiplexer in the second stage = 3 multiplexers.'
  },
  {
    id: 6,
    topic: 'Theory of Computation',
    question: 'Which of the following problems is decidable for Context-Free Languages (CFLs)?',
    options: ['Emptiness problem (Is L = ∅?)', 'Equivalence problem (Is L1 = L2?)', 'Universality problem (Is L = Σ*?)', 'Ambiguity problem'],
    correctIndex: 0,
    explanation: 'Emptiness and Finiteness are decidable for CFLs; Equivalence, Universality, and Ambiguity are undecidable.'
  },
  {
    id: 7,
    topic: 'Algorithms',
    question: 'In a connected undirected graph with distinct edge weights, the Minimum Spanning Tree (MST) is always:',
    options: ['Unique', 'Non-unique', 'Complete', 'Planar'],
    correctIndex: 0,
    explanation: 'If all edge weights in a connected undirected graph are strictly distinct, the MST is guaranteed to be unique.'
  },
  {
    id: 8,
    topic: 'Operating Systems',
    question: 'Banker’s algorithm for deadlock avoidance ensures the system remains in a:',
    options: ['Starvation-free state', 'Safe state', 'Preemptive state', 'Deadlocked state'],
    correctIndex: 1,
    explanation: 'Banker’s algorithm inspects resource allocations before granting them to ensure the system transitions only between safe states.'
  },
  {
    id: 9,
    topic: 'Computer Networks',
    question: 'In TCP congestion control, after a timeout occurs, the Congestion Window (cwnd) is reset to:',
    options: ['ssthresh / 2', '1 MSS', 'ssthresh', 'Half of previous cwnd'],
    correctIndex: 1,
    explanation: 'Upon a heavy retransmission timeout (RTO), TCP Tahoe/Reno drops cwnd back to 1 Maximum Segment Size (MSS).'
  },
  {
    id: 10,
    topic: 'DBMS',
    question: 'In a B+ tree of order p, what is the maximum number of child pointers an internal node can possess?',
    options: ['p - 1', 'p', '2p', 'p / 2'],
    correctIndex: 1,
    explanation: 'An internal node in a B+ tree of order p can hold up to p child pointers and at most (p - 1) search keys.'
  },
  {
    id: 11,
    topic: 'Computer Organization',
    question: 'In an instruction pipeline with 5 stages of 10ns each, what is the ideal throughput for 100 independent instructions?',
    options: ['1 instruction every 50ns', '1 instruction every 10ns', '100 instructions per 10ns', '5 instructions per 100ns'],
    correctIndex: 1,
    explanation: 'After filling the 5-stage pipeline, the ideal pipeline completes one instruction every clock cycle (10ns).'
  },
  {
    id: 12,
    topic: 'Theory of Computation',
    question: 'The language L = { a^n b^n c^n | n >= 1 } is:',
    options: ['Regular', 'Context-Free (CFL)', 'Context-Sensitive (CSL) but not CFL', 'Unrestricted'],
    correctIndex: 2,
    explanation: 'Pumping lemma for CFLs disproves context-freeness for 3 correlated counts; it is context-sensitive.'
  },
  {
    id: 13,
    topic: 'Operating Systems',
    question: 'What is the purpose of the Translation Lookaside Buffer (TLB)?',
    options: ['Disk cache', 'Fast hardware cache for Page Table Entries', 'Process scheduler queue', 'Virtual memory swap area'],
    correctIndex: 1,
    explanation: 'The TLB is an associative high-speed hardware cache that accelerates virtual-to-physical address translation.'
  },
  {
    id: 14,
    topic: 'Algorithms',
    question: 'What is the recurrence relation for Merge Sort?',
    options: ['T(n) = T(n-1) + O(1)', 'T(n) = 2T(n/2) + O(n)', 'T(n) = 2T(n/2) + O(1)', 'T(n) = T(n/2) + O(n)'],
    correctIndex: 1,
    explanation: 'Merge sort divides the array into 2 halves (2T(n/2)) and merges them in linear time (O(n)).'
  },
  {
    id: 15,
    topic: 'Engineering Mathematics',
    question: 'If matrix A has eigenvalues 2 and 5, what is the determinant of matrix A?',
    options: ['7', '10', '2.5', '3'],
    correctIndex: 1,
    explanation: 'The determinant of any square matrix is equal to the product of its eigenvalues: 2 * 5 = 10.'
  }
];

export interface BossBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVictory?: (xpAwarded: number) => void;
}

export const BossBattleModal: React.FC<BossBattleModalProps> = ({
  isOpen,
  onClose,
  onVictory
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [bossHp, setBossHp] = useState<number>(1000);
  const [playerLives, setPlayerLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(0);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [damageEffect, setDamageEffect] = useState<string | null>(null);
  const [isBossHurt, setIsBossHurt] = useState<boolean>(false);

  const [battleState, setBattleState] = useState<'fighting' | 'victory' | 'defeat'>('fighting');
  const [xpState, setXpState] = useState<UserXPState | null>(null);

  useEffect(() => {
    if (isOpen) {
      resetBattle();
      getXpState().then(setXpState).catch(() => {});
    }
  }, [isOpen]);

  const resetBattle = () => {
    setCurrentQuestionIndex(0);
    setBossHp(1000);
    setPlayerLives(3);
    setCombo(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setDamageEffect(null);
    setIsBossHurt(false);
    setBattleState('fighting');
  };

  if (!isOpen) return null;

  const currentQ = DEFAULT_BOSS_QUESTIONS[currentQuestionIndex];
  const maxBossHp = 1000;
  const hpPercent = Math.max(0, Math.min(100, Math.round((bossHp / maxBossHp) * 100)));

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted || battleState !== 'fighting') return;
    setSelectedOption(index);
  };

  const handleConfirmAnswer = async () => {
    if (selectedOption === null || isAnswerSubmitted || battleState !== 'fighting') return;

    setIsAnswerSubmitted(true);
    const isCorrect = selectedOption === currentQ.correctIndex;

    if (isCorrect) {
      // Calculate damage: Base 65 + combo bonus
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      const comboMultiplier = nextCombo >= 3 ? 1.5 : nextCombo >= 2 ? 1.25 : 1.0;
      const damage = Math.round(75 * comboMultiplier);

      const nextHp = Math.max(0, bossHp - damage);
      setBossHp(nextHp);

      // Trigger hit animation
      setIsBossHurt(true);
      setDamageEffect(`-${damage} HP! ${nextCombo >= 3 ? 'CRITICAL HIT! 🔥' : 'HIT!'}`);
      setTimeout(() => {
        setIsBossHurt(false);
        setDamageEffect(null);
      }, 1400);

      if (nextHp <= 0) {
        handleVictory();
        return;
      }
    } else {
      // Incorrect answer: Boss counterattacks!
      setCombo(0);
      const nextLives = playerLives - 1;
      setPlayerLives(nextLives);
      setDamageEffect('MISS! Boss Counterattacked! -1 Life 💔');
      setTimeout(() => setDamageEffect(null), 1400);

      if (nextLives <= 0) {
        setBattleState('defeat');
        return;
      }
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setDamageEffect(null);

    if (currentQuestionIndex + 1 < DEFAULT_BOSS_QUESTIONS.length) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Finished all 15 questions
      if (bossHp <= 150) {
        // If boss almost dead, award victory
        handleVictory();
      } else {
        setBattleState('defeat');
      }
    }
  };

  const handleVictory = async () => {
    setBattleState('victory');
    try {
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.5 }
      });
    } catch {
      // Non-fatal
    }

    if (xpState) {
      const award = awardXP(xpState, 'boss_defeat');
      setXpState(award.nextState);
      await saveXpState(award.nextState);
      if (onVictory) {
        onVictory(award.xpGained);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Victory Screen */}
        {battleState === 'victory' && (
          <div className="py-12 px-4 text-center space-y-6 my-auto animate-in zoom-in-95">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/20">
              👑
            </div>
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 uppercase tracking-widest">
                RAID CONQUERED
              </span>
              <h2 className="text-3xl font-black text-slate-100 mt-3">
                The Algorithm Colossus Has Fallen!
              </h2>
              <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto">
                Phenomenal execution! You neutralized all 15 exam traps and secured the weekly bounty.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 max-w-xs mx-auto">
              <div className="text-xs text-amber-300 font-semibold uppercase">Victory Bounty</div>
              <div className="text-3xl font-black text-amber-400 mt-1">+200 XP Awarded</div>
              <div className="text-xs text-slate-400 mt-1">Boss Slayer title earned</div>
            </div>

            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/30 transition"
            >
              Collect Rewards & Return
            </button>
          </div>
        )}

        {/* Defeat Screen */}
        {battleState === 'defeat' && (
          <div className="py-12 px-4 text-center space-y-6 my-auto animate-in zoom-in-95">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-4xl shadow-xl shadow-rose-500/20">
              💀
            </div>
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white uppercase tracking-widest">
                RAID FAILED
              </span>
              <h2 className="text-3xl font-black text-slate-100 mt-3">
                The Colossus Overwhelmed Your Defenses!
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                You ran out of lives. Review your weak topics in the Mistake Notebook and try again!
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={resetBattle}
                className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-600/30 transition"
              >
                <RotateCcw className="w-4 h-4" /> Try Raid Again
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
              >
                Retreat to Study
              </button>
            </div>
          </div>
        )}

        {/* Active Boss Fight Arena */}
        {battleState === 'fighting' && (
          <div className="space-y-5 overflow-y-auto pr-1">
            {/* Boss Header & Health Bar */}
            <div
              className={`p-4 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border transition-all ${
                isBossHurt ? 'border-rose-500 scale-[0.99] bg-rose-950/40' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-2xl">
                    👹
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-500 text-white uppercase">
                        WEEKLY RAID BOSS
                      </span>
                      {combo >= 2 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                          COMBO x{combo}!
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mt-0.5">
                      The Algorithm Colossus
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-rose-400">
                    {bossHp} / {maxBossHp} HP
                  </div>
                  <div className="text-[10px] text-slate-400">Q{currentQuestionIndex + 1} of 15</div>
                </div>
              </div>

              {/* Boss HP Bar */}
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden relative">
                <div
                  className="bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${hpPercent}%` }}
                />
              </div>

              {/* Damage Floating Effect */}
              {damageEffect && (
                <div className="text-center font-black text-sm text-amber-300 mt-1 animate-bounce">
                  {damageEffect}
                </div>
              )}
            </div>

            {/* Player Status Bar */}
            <div className="flex items-center justify-between px-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Candidate Health:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map(i => (
                    <Heart
                      key={i}
                      className={`w-4 h-4 ${
                        i <= playerLives
                          ? 'text-rose-500 fill-rose-500 animate-pulse'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">Domain:</span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 text-[10px]">
                  {currentQ.topic}
                </span>
              </div>
            </div>

            {/* Question Card */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                {currentQ.question}
              </p>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2.5 mt-4">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQ.correctIndex;

                  let optStyle = 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200';
                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      optStyle = 'bg-emerald-950/50 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500';
                    } else if (isSelected) {
                      optStyle = 'bg-rose-950/50 border-rose-500 text-rose-200 ring-1 ring-rose-500';
                    } else {
                      optStyle = 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60';
                    }
                  } else if (isSelected) {
                    optStyle = 'bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={isAnswerSubmitted}
                      className={`p-3.5 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${optStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswerSubmitted && isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {isAnswerSubmitted && isSelected && !isCorrect && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation on Answer Submitted */}
              {isAnswerSubmitted && (
                <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed animate-in fade-in">
                  <span className="font-bold text-indigo-300 block mb-1">Concept Insight:</span>
                  {currentQ.explanation}
                </div>
              )}
            </div>

            {/* Battle Footer Controls */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-medium">
                {playerLives} lives remaining • +200 XP upon victory
              </span>

              {!isAnswerSubmitted ? (
                <button
                  onClick={handleConfirmAnswer}
                  disabled={selectedOption === null}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition ${
                    selectedOption !== null
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Swords className="w-4 h-4" /> Strike Boss!
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
                >
                  Next Trap Question →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
