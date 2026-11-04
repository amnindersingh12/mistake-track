import React, { useState } from 'react';
import { ExamSettings, SectionConfig } from '../types';
import { db, clearAllUserData, DEFAULT_PROFILES } from '../db/db';
import { exportAllDataAsJson, importDataFromJson } from '../utils/exportImport';
import {
  Save,
  Download,
  Upload,
  Database,
  Trash2,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  FileInput,
  FolderOpen
} from 'lucide-react';

interface SettingsViewProps {
  settings: ExamSettings;
  onSettingsSaved: (newSettings: ExamSettings) => void;
  onDataResetOrLoaded: () => void;
  onOpenDataIntake?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsSaved,
  onDataResetOrLoaded,
  onOpenDataIntake
}) => {
  const [form, setForm] = useState<ExamSettings>(JSON.parse(JSON.stringify(settings)));
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<string>(form.sections[0]?.id || 'quant');
  const [newTopicText, setNewTopicText] = useState('');
  const [newErrorTypeText, setNewErrorTypeText] = useState('');
  const [confirmClearModal, setConfirmClearModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.settings.put(form);
    onSettingsSaved(form);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3000);
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<SectionConfig>) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => (sec.id === sectionId ? { ...sec, ...updates } : sec))
    }));
  };

  const handleAddTopic = (sectionId: string) => {
    if (!newTopicText.trim()) return;
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.id === sectionId) {
          if (sec.topics.includes(newTopicText.trim())) return sec;
          return { ...sec, topics: [...sec.topics, newTopicText.trim()] };
        }
        return sec;
      })
    }));
    setNewTopicText('');
  };

  const handleRemoveTopic = (sectionId: string, topicToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, topics: sec.topics.filter((t) => t !== topicToRemove) } : sec
      )
    }));
  };

  const handleAddErrorType = () => {
    if (!newErrorTypeText.trim()) return;
    if (!form.errorTypes.includes(newErrorTypeText.trim())) {
      setForm((prev) => ({
        ...prev,
        errorTypes: [...prev.errorTypes, newErrorTypeText.trim()]
      }));
    }
    setNewErrorTypeText('');
  };

  const handleRemoveErrorType = (errType: string) => {
    setForm((prev) => ({
      ...prev,
      errorTypes: prev.errorTypes.filter((e) => e !== errType)
    }));
  };

  const handleAddSection = () => {
    const newId = `sec_${Date.now()}`;
    const newSection: SectionConfig = {
      id: newId,
      name: 'New Section',
      totalQuestions: 30,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 20,
      sectionalCutoff: 10,
      topics: ['Topic 1', 'Topic 2']
    };
    setForm((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setActiveSectionTab(newId);
  };

  const handleRemoveSection = (sectionId: string) => {
    if (form.sections.length <= 1) {
      alert('You must have at least one section in the exam.');
      return;
    }
    const filtered = form.sections.filter((s) => s.id !== sectionId);
    setForm((prev) => ({ ...prev, sections: filtered }));
    if (activeSectionTab === sectionId) {
      setActiveSectionTab(filtered[0]?.id || '');
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importDataFromJson(text);
      setMessage({ type: 'success', text: `Restored ${res.mockCount} mocks and ${res.mistakeCount} mistakes!` });
      onDataResetOrLoaded();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' });
    }
    e.target.value = '';
  };

  const handleClearAll = async () => {
    await clearAllUserData();
    setConfirmClearModal(false);
    setMessage({ type: 'success', text: 'All data cleared and default exam settings restored.' });
    onDataResetOrLoaded();
  };

  const activeSection = form.sections.find((s) => s.id === activeSectionTab) || form.sections[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Exam Setup & Data Settings</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure exam structure, marking schemes, topic taxonomies, and manage database backup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {isSavedAlert && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Settings successfully saved and applied to your analysis engine!</span>
        </div>
      )}

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Exam Profile Presets */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Exam Profile Presets
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch exam structures and section marking rules instantly without losing your recorded mocks or mistakes.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEFAULT_PROFILES.map((profile) => {
              const isSelected = form.examName === profile.examName;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    setForm({
                      ...form,
                      examName: profile.examName,
                      totalTimeMinutes: profile.totalTimeMinutes,
                      targetScore: profile.targetScore,
                      overallCutoff: profile.overallCutoff,
                      sections: JSON.parse(JSON.stringify(profile.sections)),
                      errorTypes: [...profile.errorTypes]
                    });
                    setActiveSectionTab(profile.sections[0]?.id || 'quant');
                  }}
                  className={`p-3.5 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {profile.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                    <p>{profile.sections.length} Sections • {profile.totalTimeMinutes} mins</p>
                    <p>Target: {profile.targetScore} • Cutoff: {profile.overallCutoff}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Exam Info */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Overall Exam Target & Constraints</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Exam Name
              </label>
              <input
                type="text"
                value={form.examName}
                onChange={(e) => setForm({ ...form, examName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Total Time (Minutes)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={form.totalTimeMinutes}
                onChange={(e) => setForm({ ...form, totalTimeMinutes: Number(e.target.value) || 60 })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Overall Target Score
              </label>
              <input
                type="number"
                step="0.5"
                value={form.targetScore}
                onChange={(e) => setForm({ ...form, targetScore: Number(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Overall Exam Cutoff
              </label>
              <input
                type="number"
                step="0.5"
                value={form.overallCutoff}
                onChange={(e) => setForm({ ...form, overallCutoff: Number(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Sectional Configuration & Topic Taxonomies */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Section Settings & Topic Taxonomies
            </h3>
            <button
              type="button"
              onClick={handleAddSection}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Section</span>
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            {form.sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionTab(sec.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeSectionTab === sec.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sec.name} ({sec.topics.length} topics)
              </button>
            ))}
          </div>

          {activeSection && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    value={activeSection.name}
                    onChange={(e) => handleUpdateSection(activeSection.id, { name: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Total Questions
                  </label>
                  <input
                    type="number"
                    value={activeSection.totalQuestions}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { totalQuestions: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Time Limit (Minutes)
                  </label>
                  <input
                    type="number"
                    value={activeSection.timeLimitMinutes}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { timeLimitMinutes: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Marks per Correct Answer
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={activeSection.marksPerCorrect}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { marksPerCorrect: Number(e.target.value) || 1.0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Negative Penalty per Wrong
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={activeSection.negativeMark}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { negativeMark: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Sectional Cutoff
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={activeSection.sectionalCutoff}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { sectionalCutoff: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Topic List */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Topic Taxonomy for {activeSection.name} ({activeSection.topics.length} topics)
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                  {activeSection.topics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
                    >
                      <span>{topic}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(activeSection.id, topic)}
                        className="text-slate-400 hover:text-rose-500"
                        title="Remove topic"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new topic */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder={`New topic for ${activeSection.name}...`}
                    value={newTopicText}
                    onChange={(e) => setNewTopicText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTopic(activeSection.id);
                      }
                    }}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTopic(activeSection.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-medium"
                  >
                    Add Topic
                  </button>
                  {form.sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(activeSection.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium"
                    >
                      Delete Section
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Types Taxonomy */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Error-Type Taxonomy ({form.errorTypes.length} types)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Used when logging mistakes to track root causes and generate targeted actionable insights.
          </p>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            {form.errorTypes.map((err) => (
              <span
                key={err}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
              >
                <span>{err}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveErrorType(err)}
                  className="text-slate-400 hover:text-rose-500"
                  title="Remove error type"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add new custom error type..."
              value={newErrorTypeText}
              onChange={(e) => setNewErrorTypeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddErrorType();
                }
              }}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddErrorType}
              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              Add Error Type
            </button>
          </div>
        </div>
      </form>

      {/* Database Management & Backup */}
      <div className="p-6 bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[var(--ink-border)] flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--accent-twilight)]" />
            <span>Local Storage & Data Intake</span>
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-tag)] border border-[var(--ink-border)]">
            IndexedDB Local-First
          </span>
        </div>
        <p className="text-xs text-[var(--ink-muted)]">
          All data remains strictly on your device. Export full JSON backups, import via CSV/JSON templates, or process raw files from your local drop folder.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Export JSON */}
          <button
            type="button"
            onClick={exportAllDataAsJson}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] hover:bg-[var(--accent-sakura)]/20 text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-[var(--accent-twilight)]" />
            <span>Export JSON Backup</span>
          </button>

          {/* Import JSON */}
          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] hover:bg-[var(--accent-sakura)]/20 text-xs font-bold cursor-pointer transition-all shadow-manga-sm hover:-translate-y-0.5">
            <Upload className="w-4 h-4 text-[var(--accent-twilight)]" />
            <span>Restore Backup</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          {/* Open Data Intake Modal */}
          {onOpenDataIntake && (
            <button
              type="button"
              onClick={onOpenDataIntake}
              className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-peach)]/30 hover:bg-[var(--accent-peach)]/50 text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5"
            >
              <FileInput className="w-4 h-4 text-[var(--accent-twilight)]" />
              <span>Data Intake Hub (Paste / CSV)</span>
            </button>
          )}
        </div>

        {/* Local file drop folder info */}
        <div className="p-3.5 rounded-xl border-2 border-dashed border-[var(--ink-border)]/40 bg-[var(--surface-tag)]/50 flex items-start gap-3 text-xs">
          <FolderOpen className="w-5 h-5 text-[var(--accent-twilight)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-[var(--ink-border)]">File Drop Folder: <code>my-data/</code></div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Drop mock PDFs, screenshots, or CSVs into the <code>/my-data</code> folder in your project directory. Run <code className="font-mono bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--ink-border)]/40">npm run import-my-data</code> to automatically extract them and stage them for review.
            </p>
          </div>
        </div>

        {/* Danger Zone: Clear Data */}
        <div className="pt-3 border-t-2 border-[var(--ink-border)]/20 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400">Clear Database</h4>
            <p className="text-[11px] text-[var(--ink-muted)]">Permanently wipes all mocks, mistakes, and papers from this browser.</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClearModal(true)}
            className="px-3.5 py-1.5 rounded-xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold shadow-manga-sm"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Are you absolutely sure?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will delete all your mock test entries, mistake records, and spaced repetition progress.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearModal(false)}
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-xs"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

