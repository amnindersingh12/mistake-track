import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Headphones,
  CheckCircle,
  FileEdit,
  Clock,
  Sparkles,
  Flame,
  BookOpen,
  HelpCircle,
  BarChart3,
  Calendar,
  Layers
} from 'lucide-react';
import { StudySession, StudySessionType, UserXPState } from '../types';
import { ambientAudio, AmbientSoundType } from '../utils/ambientAudio';
import { awardXP, getXpState, saveXpState, XPAction } from '../utils/xpEngine';
import { getLocalDateStr, addDaysToDate } from '../utils/srs';
import { db } from '../db/db';

export type TimerMode = 'pomodoro' | 'deep' | 'mock' | 'custom';

interface TimerPreset {
  id: TimerMode;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  description: string;
}

const TIMER_PRESETS: Record<TimerMode, TimerPreset> = {
  pomodoro: {
    id: 'pomodoro',
    name: '25 / 5 Pomodoro',
    focusMinutes: 25,
    breakMinutes: 5,
    description: 'Fast active recall sprint with short recovery break.'
  },
  deep: {
    id: 'deep',
    name: '50 / 10 Deep Work',
    focusMinutes: 50,
    breakMinutes: 10,
    description: 'Deep cognitive immersion for complex proofs and multi-step algorithms.'
  },
  mock: {
    id: 'mock',
    name: '180m CBT Mock Simulation',
    focusMinutes: 180,
    breakMinutes: 0,
    description: 'Strict uninterrupted 3-hour examination pressure simulation.'
  },
  custom: {
    id: 'custom',
    name: 'Custom Duration',
    focusMinutes: 45,
    breakMinutes: 5,
    description: 'User-configured timer block.'
  }
};

const SCRATCHPAD_KEY = 'studybridge_focus_scratchpad';

export interface FocusViewProps {
  initialSessionTitle?: string;
  initialSessionType?: StudySessionType;
  initialDurationMinutes?: number;
}

export const FocusView: React.FC<FocusViewProps> = ({
  initialSessionTitle = 'Computer Networks - Routing & Subnetting',
  initialSessionType = 'practice',
  initialDurationMinutes
}) => {
  // Mode & Timer states
  const [timerMode, setTimerMode] = useState<TimerMode>(() => {
    if (initialDurationMinutes === 180) return 'mock';
    if (initialDurationMinutes === 50) return 'deep';
    if (initialDurationMinutes === 25) return 'pomodoro';
    return 'pomodoro';
  });

  const [customMinutes, setCustomMinutes] = useState<number>(initialDurationMinutes || 45);
  const [isBreak, setIsBreak] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);

  const getPresetDuration = (mode: TimerMode, breakMode: boolean): number => {
    if (mode === 'custom') {
      return breakMode ? 5 * 60 : customMinutes * 60;
    }
    const preset = TIMER_PRESETS[mode];
    return breakMode ? preset.breakMinutes * 60 : preset.focusMinutes * 60;
  };

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    return (initialDurationMinutes ? initialDurationMinutes * 60 : 25 * 60);
  });

  // Task & Session states
  const [taskTitle, setTaskTitle] = useState<string>(initialSessionTitle);
  const [sessionType, setSessionType] = useState<StudySessionType>(initialSessionType);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);

  // Full screen mode
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Ambient Audio states
  const [activeSound, setActiveSound] = useState<AmbientSoundType>('none');
  const [soundVolume, setSoundVolume] = useState<number>(0.5);

  // Scratchpad
  const [scratchpadText, setScratchpadText] = useState<string>(() => {
    return localStorage.getItem(SCRATCHPAD_KEY) || '';
  });

  // Activity logs & Heatmap
  const [sessionsHistory, setSessionsHistory] = useState<StudySession[]>([]);
  const [xpState, setXpState] = useState<UserXPState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load XP state and past study sessions from Dexie
  useEffect(() => {
    getXpState().then(setXpState).catch(() => {});
    loadStudySessions();

    return () => {
      ambientAudio.stop();
    };
  }, []);

  const loadStudySessions = async () => {
    try {
      const records = await db.studySessions.toArray();
      setSessionsHistory(records.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    } catch {
      // Ignore
    }
  };

  // Timer countdown interval
  useEffect(() => {
    let timer: any = null;
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      handleTimerComplete();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isActive, timeLeft]);

  // Scratchpad auto-save
  useEffect(() => {
    localStorage.setItem(SCRATCHPAD_KEY, scratchpadText);
  }, [scratchpadText]);

  const handleStartTimer = () => {
    if (!isActive && !sessionStartTime) {
      setSessionStartTime(new Date().toISOString());
    }
    setIsActive(true);
  };

  const handlePauseTimer = () => {
    setIsActive(false);
  };

  const handleResetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft(getPresetDuration(timerMode, false));
    setSessionStartTime(null);
  };

  const handleModeChange = (mode: TimerMode) => {
    setTimerMode(mode);
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft(getPresetDuration(mode, false));
    setSessionStartTime(null);
  };

  const handleTimerComplete = async () => {
    setIsActive(false);

    if (!isBreak) {
      // Completed focus block!
      const totalSeconds = getPresetDuration(timerMode, false);
      const minutesSpent = Math.max(1, Math.round(totalSeconds / 60));

      // 1. Save session to Dexie
      const now = new Date().toISOString();
      const newSession: StudySession = {
        type: sessionType,
        durationMinutes: minutesSpent,
        startedAt: sessionStartTime || new Date(Date.now() - minutesSpent * 60000).toISOString(),
        endedAt: now,
        notes: `${taskTitle} (Focus block: ${timerMode})`
      };

      try {
        await db.studySessions.add(newSession);
        loadStudySessions();
      } catch {
        // Dexie error non-fatal
      }

      // 2. Award XP
      if (xpState) {
        let action: XPAction = 'review';
        if (sessionType === 'practice') action = 'pyq';
        else if (sessionType === 'mock') action = 'mock';
        else if (sessionType === 'reading') action = 'review';

        const award = awardXP(xpState, action);
        setXpState(award.nextState);
        await saveXpState(award.nextState);
        showToast(`Focus block complete! +${award.xpGained} XP awarded (${award.nextState.rankTitle})`);
      } else {
        showToast(`Focus block complete! Logged ${minutesSpent} minutes.`);
      }

      // Switch to break mode if preset has break
      const preset = TIMER_PRESETS[timerMode];
      if (preset && preset.breakMinutes > 0) {
        setIsBreak(true);
        setTimeLeft(preset.breakMinutes * 60);
      } else {
        handleResetTimer();
      }
    } else {
      // Break finished
      setIsBreak(false);
      setTimeLeft(getPresetDuration(timerMode, false));
      showToast('Break finished! Ready for next sprint?');
    }
  };

  // Ambient sound handlers
  const handleSoundSelect = async (sound: AmbientSoundType) => {
    if (activeSound === sound) {
      ambientAudio.stop();
      setActiveSound('none');
    } else {
      setActiveSound(sound);
      await ambientAudio.play(sound, soundVolume);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    ambientAudio.setVolume(vol);
  };

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Format MM:SS or HH:MM:SS
  const formatTime = (secs: number): string => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(mins)}:${pad(seconds)}`;
    }
    return `${pad(mins)}:${pad(seconds)}`;
  };

  // Compute 14-day heatmap data
  const heatmapData = React.useMemo(() => {
    const days: Array<{ date: string; dayName: string; minutes: number; hours: number }> = [];
    const today = getLocalDateStr();

    for (let i = 13; i >= 0; i--) {
      const d = addDaysToDate(today, -i);
      const [y, m, date] = d.split('-').map(Number);
      const dayObj = new Date(y, (m || 1) - 1, date || 1);
      const dayName = dayObj.toLocaleDateString('en-US', { weekday: 'short' });

      // Sum minutes from sessions History matching this date
      const totalMin = sessionsHistory
        .filter(s => s.startedAt?.startsWith(d) || s.endedAt?.startsWith(d))
        .reduce((sum, s) => sum + s.durationMinutes, 0);

      days.push({
        date: d,
        dayName,
        minutes: totalMin,
        hours: Math.round((totalMin / 60) * 10) / 10
      });
    }
    return days;
  }, [sessionsHistory]);

  const typeHoursBreakdown = React.useMemo(() => {
    const map: Record<StudySessionType, number> = {
      reading: 0,
      practice: 0,
      mock: 0,
      review: 0
    };
    for (const s of sessionsHistory) {
      if (map[s.type] !== undefined) {
        map[s.type] += s.durationMinutes;
      }
    }
    return {
      reading: Math.round((map.reading / 60) * 10) / 10,
      practice: Math.round((map.practice / 60) * 10) / 10,
      mock: Math.round((map.mock / 60) * 10) / 10,
      review: Math.round((map.review / 60) * 10) / 10,
      total: Math.round(((map.reading + map.practice + map.mock + map.review) / 60) * 10) / 10
    };
  }, [sessionsHistory]);

  const targetSec = getPresetDuration(timerMode, isBreak);
  const progressPercent = targetSec > 0 ? Math.min(100, Math.round(((targetSec - timeLeft) / targetSec) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      className={`space-y-6 max-w-7xl mx-auto pb-16 ${
        isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 p-8 overflow-y-auto' : ''
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/50 text-indigo-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Mode Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SPEC B • Focus & Time Tracking
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5" /> Web Audio Synthesizer Active
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-6 h-6 text-emerald-400" /> Deep Focus Mode & Ambient Synthesizer
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Distraction-free timer modes, pure Web Audio noise generation, live scratchpad, and automatic Dexie activity logging.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={toggleFullScreen}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
              title={isFullScreen ? 'Exit full screen' : 'Enter full screen focus'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFullScreen ? 'Exit Full Screen' : 'Distraction-Free Mode'}
            </button>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(TIMER_PRESETS) as TimerMode[]).map(mode => {
            const preset = TIMER_PRESETS[mode];
            const isSelected = timerMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-950/50'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70 text-slate-300'
                }`}
              >
                <div className="font-bold text-sm flex items-center justify-between">
                  <span>{preset.name}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Focus Console: Timer + Scratchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer Card (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          {/* Active Task Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
            <div className="w-full sm:w-2/3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Active Study Target:
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="What are you studying right now?"
                className="w-full bg-slate-800/80 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="shrink-0">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Session Type:
              </label>
              <select
                value={sessionType}
                onChange={e => setSessionType(e.target.value as StudySessionType)}
                className="bg-slate-800/80 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="practice">Practice (PYQ / NAT)</option>
                <option value="reading">Reading & Theory</option>
                <option value="review">SRS Mistake Review</option>
                <option value="mock">Full Mock Exam</option>
              </select>
            </div>
          </div>

          {/* Big Timer Display */}
          <div className="py-12 flex flex-col items-center justify-center">
            {isBreak && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-widest mb-3 animate-pulse">
                REST BREAK
              </span>
            )}

            <div className="relative flex items-center justify-center">
              {/* Radial or Big Monospace Timer */}
              <div className="text-6xl md:text-8xl font-black font-mono tracking-tight text-slate-100 drop-shadow-md">
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md bg-slate-800 h-2.5 rounded-full mt-6 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isBreak ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="text-xs text-slate-400 mt-2 font-medium">
              {progressPercent}% completed ({Math.round(timeLeft / 60)} min remaining)
            </div>

            {/* Timer Action Buttons */}
            <div className="flex items-center gap-3 mt-8">
              {!isActive ? (
                <button
                  onClick={handleStartTimer}
                  className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Focus
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  className="flex items-center gap-2 px-8 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-base shadow-lg shadow-amber-600/30 transition transform active:scale-95"
                >
                  <Pause className="w-5 h-5 fill-current" />
                  Pause
                </button>
              )}

              <button
                onClick={handleResetTimer}
                className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
                title="Reset Timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={handleTimerComplete}
                className="flex items-center gap-1.5 px-4 py-3.5 bg-slate-800 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-300 rounded-xl border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold transition"
                title="Finish early & log session (+XP)"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Finish Early
              </button>
            </div>
          </div>

          {/* Pure Web Audio Synthesizer Controls */}
          <div className="pt-5 border-t border-slate-800 bg-slate-950/40 p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Ambient Audio Synthesizer (Pure Web Audio API)
                </span>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 w-full sm:w-48">
                {soundVolume === 0 ? (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-400 font-mono w-8 text-right">
                  {Math.round(soundVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Synthesizer Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleSoundSelect('white')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                  activeSound === 'white'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span>White Noise</span>
                {activeSound === 'white' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
              </button>

              <button
                onClick={() => handleSoundSelect('brown')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                  activeSound === 'brown'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span>Brown Noise</span>
                {activeSound === 'brown' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
              </button>

              <button
                onClick={() => handleSoundSelect('binaural')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                  activeSound === 'binaural'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="200Hz / 240Hz stereo carriers for 40Hz gamma brainwave entrainment"
              >
                <span>40Hz Gamma Beats</span>
                {activeSound === 'binaural' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
              </button>

              <button
                onClick={() => handleSoundSelect('rain')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                  activeSound === 'rain'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span>Synthesized Rain</span>
                {activeSound === 'rain' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
              </button>
            </div>
          </div>
        </div>

        {/* Scratchpad Card (1 Col) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200">Study Scratchpad</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Auto-saved</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Jot formulas, calculation steps, or trick trap reminders while in flow.
            </p>
          </div>

          <textarea
            value={scratchpadText}
            onChange={e => setScratchpadText(e.target.value)}
            placeholder={`Example scratch notes:\n• CIDR /28 = 16 IPs (14 usable)\n• TCP 3-way handshake SYN, SYN-ACK, ACK\n• Page Table Size = 2^(VPN) * PTE`}
            className="w-full h-80 bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
          />

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{scratchpadText.length} characters</span>
            <button
              onClick={() => {
                setScratchpadText('');
                localStorage.removeItem(SCRATCHPAD_KEY);
              }}
              className="hover:text-rose-400 transition"
            >
              Clear pad
            </button>
          </div>
        </div>
      </div>

      {/* Activity Log & Heatmap Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Focus Activity Log & 14-Day Heatmap
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Visualizes logged focus sessions split by reading, practice, mock, and review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Total Logged: {typeHoursBreakdown.total} hrs
            </span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
            Last 14 Days Heatmap:
          </label>
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
            {heatmapData.map(d => {
              let bg = 'bg-slate-800/60 text-slate-400';
              if (d.hours >= 4) bg = 'bg-emerald-500 text-slate-950 font-bold';
              else if (d.hours >= 2) bg = 'bg-emerald-600/80 text-white';
              else if (d.hours >= 0.5) bg = 'bg-emerald-800/60 text-emerald-200';

              return (
                <div
                  key={d.date}
                  className={`p-2.5 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center transition ${bg}`}
                  title={`${d.date} (${d.dayName}): ${d.hours} hrs (${d.minutes} min)`}
                >
                  <span className="text-[10px] uppercase font-bold opacity-75">{d.dayName}</span>
                  <span className="text-xs font-extrabold mt-0.5">{d.hours}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-800 mb-6">
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/30">
            <div className="text-xs text-blue-400 font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Reading & Theory
            </div>
            <div className="text-xl font-bold text-blue-100 mt-1">{typeHoursBreakdown.reading} hrs</div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
            <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> PYQ Practice
            </div>
            <div className="text-xl font-bold text-emerald-100 mt-1">{typeHoursBreakdown.practice} hrs</div>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-900/30">
            <div className="text-xs text-purple-400 font-semibold flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> SRS Review
            </div>
            <div className="text-xl font-bold text-purple-100 mt-1">{typeHoursBreakdown.review} hrs</div>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/30">
            <div className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> Full Mock CBT
            </div>
            <div className="text-xl font-bold text-amber-100 mt-1">{typeHoursBreakdown.mock} hrs</div>
          </div>
        </div>

        {/* Recent Session History List */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Recent Logged Sessions:
          </label>
          {sessionsHistory.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl">
              No focus sessions logged yet. Complete a timer sprint above to automatically log your hours!
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {sessionsHistory.slice(0, 10).map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-semibold uppercase text-[10px]">
                      {s.type}
                    </span>
                    <span className="font-medium text-slate-200">{s.notes || 'Focus Session'}</span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-400">
                    <span className="font-semibold text-slate-300">{s.durationMinutes} min</span>
                    <span>{s.startedAt ? s.startedAt.split('T')[0] : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
