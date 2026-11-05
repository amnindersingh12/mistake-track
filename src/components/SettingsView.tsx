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
import { MangaIconSettings } from './MangaIcons';

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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-panel)] p-5 rounded-2xl border-2 border-[var(--ink-border)] shadow-manga">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--sakura-soft)] text-[var(--sakura)] rounded-xl border border-[var(--ink-border)]">
            <MangaIconSettings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black tracking-tight text-[var(--ink)] dark:text-[var(--text-main)]">
              Exam Setup & Engine Settings
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Configure exam structure, marking rules, topic taxonomies, and local backup.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave()}
            className="manga-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sakura)] text-[var(--ink)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {isSavedAlert && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Settings successfully saved and applied to your analysis engine!</span>
        </div>
      )}

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between border-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200'
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
        {/* Global Exam Info */}
        <div className="p-5 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
          <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
            Overall Exam Target & Constraints
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                Exam Name
              </label>
              <input
                type="text"
                value={form.examName}
                onChange={(e) => setForm({ ...form, examName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                Total Time (Minutes)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={form.totalTimeMinutes}
                onChange={(e) => setForm({ ...form, totalTimeMinutes: Number(e.target.value) || 60 })}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                Overall Target Score
              </label>
              <input
                type="number"
                step="0.5"
                value={form.targetScore}
                onChange={(e) => setForm({ ...form, targetScore: Number(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                Overall Exam Cutoff
              </label>
              <input
                type="number"
                step="0.5"
                value={form.overallCutoff}
                onChange={(e) => setForm({ ...form, overallCutoff: Number(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                required
              />
            </div>
          </div>
        </div>

        {/* Sectional Configuration & Topic Taxonomies */}
        <div className="p-5 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              Section Settings & Topic Taxonomies
            </h3>
            <button
              type="button"
              onClick={handleAddSection}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--sakura)] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Section</span>
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex flex-wrap gap-2 border-b-2 border-[var(--ink-border)] pb-3">
            {form.sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionTab(sec.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${
                  activeSectionTab === sec.id
                    ? 'bg-[var(--peach)] text-[var(--ink)] border-[var(--ink-border)] shadow-manga-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-transparent hover:border-[var(--ink-border)]'
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
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    value={activeSection.name}
                    onChange={(e) => handleUpdateSection(activeSection.id, { name: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Total Questions
                  </label>
                  <input
                    type="number"
                    value={activeSection.totalQuestions}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { totalQuestions: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Time Limit (Minutes)
                  </label>
                  <input
                    type="number"
                    value={activeSection.timeLimitMinutes}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { timeLimitMinutes: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Marks per Correct Answer
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={activeSection.marksPerCorrect}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { marksPerCorrect: Number(e.target.value) || 1.0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Negative Penalty per Wrong
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={activeSection.negativeMark}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { negativeMark: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Sectional Cutoff
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={activeSection.sectionalCutoff}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { sectionalCutoff: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
              </div>

              {/* Topic List */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-2">
                  Topic Taxonomy for {activeSection.name} ({activeSection.topics.length} topics)
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]">
                  {activeSection.topics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--ink)] dark:text-[var(--text-main)] shadow-xs"
                    >
                      <span>{topic}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(activeSection.id, topic)}
                        className="text-[var(--text-muted)] hover:text-rose-500"
                        title="Remove topic"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new topic */}
                <div className="flex gap-2 mt-3">
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
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTopic(activeSection.id)}
                    className="manga-btn px-4 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--sakura)] border-2 border-[var(--ink-border)] text-[var(--ink)] dark:text-[var(--text-main)] text-xs font-bold transition-colors"
                  >
                    Add Topic
                  </button>
                  {form.sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(activeSection.id)}
                      className="px-3 py-2 rounded-xl border-2 border-rose-400 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors"
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
        <div className="p-5 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-3">
          <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
            Error-Type Taxonomy ({form.errorTypes.length} types)
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Used when logging mistakes to track root causes and generate targeted actionable insights.
          </p>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]">
            {form.errorTypes.map((err) => (
              <span
                key={err}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--ink)] dark:text-[var(--text-main)] shadow-xs"
              >
                <span>{err}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveErrorType(err)}
                  className="text-[var(--text-muted)] hover:text-rose-500"
                  title="Remove error type"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
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
              className="flex-1 text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
            />
            <button
              type="button"
              onClick={handleAddErrorType}
              className="manga-btn px-4 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--sakura)] border-2 border-[var(--ink-border)] text-[var(--ink)] dark:text-[var(--text-main)] text-xs font-bold transition-colors"
            >
              Add Error Type
            </button>
          </div>
        </div>
      </form>

      {/* Database Management & Backup */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--sakura)]" />
            <span>Local Storage & Data Integrity</span>
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold">
            IndexedDB v4 Atomic
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          All data remains strictly on your device. Export full JSON backups, import via CSV/JSON templates, or process raw files from your local drop folder.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Export JSON */}
          <button
            type="button"
            onClick={exportAllDataAsJson}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] hover:bg-[var(--sakura-soft)] text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-[var(--sakura)]" />
            <span>Export JSON Backup</span>
          </button>

          {/* Import JSON */}
          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] hover:bg-[var(--sakura-soft)] text-xs font-bold cursor-pointer transition-all shadow-manga-sm hover:-translate-y-0.5">
            <Upload className="w-4 h-4 text-[var(--sakura)]" />
            <span>Restore Backup</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          {/* Open Data Intake Modal */}
          {onOpenDataIntake && (
            <button
              type="button"
              onClick={onOpenDataIntake}
              className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--peach-soft)] hover:bg-[var(--peach)]/30 text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5"
            >
              <FileInput className="w-4 h-4 text-[var(--peach)]" />
              <span>Data Intake Hub (Paste / CSV)</span>
            </button>
          )}
        </div>

        {/* Local file drop folder info */}
        <div className="p-4 rounded-xl border-2 border-dashed border-[var(--ink-border)] bg-[var(--bg-surface)] flex items-start gap-3 text-xs">
          <FolderOpen className="w-5 h-5 text-[var(--peach)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-[var(--ink)] dark:text-[var(--text-main)]">File Drop Folder: <code>my-data/</code></div>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Drop mock PDFs, screenshots, or CSVs into the <code>/my-data</code> folder in your project directory. Run <code className="font-mono bg-[var(--bg-panel)] px-1.5 py-0.5 rounded border border-[var(--ink-border)]">npm run import-my-data</code> to automatically extract them and stage them for review.
            </p>
          </div>
        </div>

        {/* Danger Zone: Clear Data */}
        <div className="pt-3 border-t-2 border-[var(--ink-border)] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400">Clear Database</h4>
            <p className="text-[11px] text-[var(--text-muted)]">Permanently wipes all mocks, mistakes, and papers from this browser.</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClearModal(true)}
            className="px-4 py-2 rounded-xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold shadow-manga-sm"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--bg-panel)] rounded-2xl p-6 max-w-sm w-full border-2 border-[var(--ink-border)] space-y-4 shadow-manga-lg">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-500 flex items-center justify-center text-rose-600 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">Are you absolutely sure?</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                This will delete all your mock test entries, mistake records, and spaced repetition progress.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearModal(false)}
                className="flex-1 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-manga-sm"
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
