import React, { useState, useEffect } from 'react';
import {
  ExamSettings,
  SectionConfig,
  ExamProfile,
  ExamStage,
  QuestionTypeMarkingRule,
  QuestionType
} from '../types';
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
  FolderOpen,
  Wrench,
  ExternalLink,
  Layers,
  Award,
  Check,
  ShieldCheck,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import { MangaIconSettings } from './MangaIcons';
import { planMistakeRepairs, RepairPlan } from '../utils/repairMistakes';

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
  const [profiles, setProfiles] = useState<ExamProfile[]>(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>(DEFAULT_PROFILES[0].id);
  const [activeStageId, setActiveStageId] = useState<string>('cbt');

  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<string>(form.sections[0]?.id || 'quant');
  const [newTopicText, setNewTopicText] = useState('');
  const [newErrorTypeText, setNewErrorTypeText] = useState('');
  const [confirmClearModal, setConfirmClearModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [repairPlan, setRepairPlan] = useState<RepairPlan | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);

  // Load profiles from db
  useEffect(() => {
    let isMounted = true;
    db.profiles
      .toArray()
      .then((profs) => {
        if (isMounted && profs && profs.length > 0) {
          setProfiles(profs);
          if (!profs.some((p) => p.id === activeProfileId)) {
            setActiveProfileId(profs[0].id);
            if (profs[0].stages?.[0]) {
              setActiveStageId(profs[0].stages[0].id);
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const currentProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const activeStage = currentProfile?.stages?.find((s) => s.id === activeStageId) || currentProfile?.stages?.[0];

  const handleStartRepairDryRun = async () => {
    try {
      const allMistakes = await db.mistakes.toArray();
      const plan = planMistakeRepairs(allMistakes);
      setRepairPlan(plan);
      setIsRepairModalOpen(true);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Dry run failed' });
    }
  };

  const handleApplyRepair = async () => {
    if (!repairPlan || repairPlan.affectedCount === 0) return;
    setIsRepairing(true);
    try {
      await exportAllDataAsJson();
      await db.mistakes.bulkPut(repairPlan.repairedRecords);
      setMessage({
        type: 'success',
        text: `Successfully repaired ${repairPlan.affectedCount} mistake record(s)! An automatic backup was saved.`
      });
      setIsRepairModalOpen(false);
      setRepairPlan(null);
      onDataResetOrLoaded();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Repair failed' });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      // 1. Save active form to settings
      await db.settings.put(form);
      // 2. Save all profiles to db.profiles
      await db.profiles.bulkPut(profiles);
      onSettingsSaved(form);
      setIsSavedAlert(true);
      setTimeout(() => setIsSavedAlert(false), 3000);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  // Profile modifications
  const handleUpdateProfile = (updates: Partial<ExamProfile>) => {
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id === currentProfile.id) {
          const updated = { ...p, ...updates, updatedAt: new Date().toISOString() };
          // If this is the active default profile, sync form
          if (p.id === 'gate-cs' || p.isDefault) {
            setForm((prevForm) => ({
              ...prevForm,
              examName: updated.examName || prevForm.examName,
              targetScore: updated.targetScore ?? prevForm.targetScore,
              overallCutoff: updated.overallCutoff ?? prevForm.overallCutoff,
              totalTimeMinutes: updated.totalTimeMinutes ?? prevForm.totalTimeMinutes
            }));
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleToggleUnverifiedField = (field: string) => {
    const list = currentProfile.unverifiedFields || [];
    const updated = list.includes(field)
      ? list.filter((f) => f !== field)
      : [...list, field];
    handleUpdateProfile({ unverifiedFields: updated });
  };

  // Stage modifications
  const handleUpdateStage = (stageId: string, updates: Partial<ExamStage>) => {
    const updatedStages = (currentProfile.stages || []).map((stg) =>
      stg.id === stageId ? { ...stg, ...updates } : stg
    );
    handleUpdateProfile({ stages: updatedStages });
  };

  const handleAddStage = () => {
    const newStageId = `stage-${Date.now()}`;
    const newStage: ExamStage = {
      id: newStageId,
      name: `New Exam Stage`,
      durationMinutes: 120,
      totalMarks: 100,
      cutoffMarks: 30,
      isUnverified: true,
      sections: [
        {
          id: `sec-1`,
          name: 'Core Technical Section',
          totalQuestions: 50,
          marksPerCorrect: 2,
          negativeMark: 0.5,
          timeLimitMinutes: 120,
          sectionalCutoff: 15,
          topics: ['Core Topic 1', 'Core Topic 2']
        }
      ],
      markingRules: [
        { questionType: 'MCQ', marks: 1, negativeMarks: 0.3333, allowPartialCredit: false },
        { questionType: 'MSQ', marks: 2, negativeMarks: 0, allowPartialCredit: false },
        { questionType: 'NAT', marks: 2, negativeMarks: 0, natTolerance: 0 }
      ]
    };

    handleUpdateProfile({ stages: [...(currentProfile.stages || []), newStage] });
    setActiveStageId(newStageId);
  };

  const handleDeleteStage = (stageId: string) => {
    if ((currentProfile.stages || []).length <= 1) {
      alert('An exam profile must have at least one stage.');
      return;
    }
    const updatedStages = currentProfile.stages.filter((s) => s.id !== stageId);
    handleUpdateProfile({ stages: updatedStages });
    setActiveStageId(updatedStages[0].id);
  };

  // Marking rule modifications
  const handleUpdateMarkingRule = (
    stageId: string,
    ruleIdx: number,
    updates: Partial<QuestionTypeMarkingRule>
  ) => {
    const stage = currentProfile.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const rules = [...stage.markingRules];
    rules[ruleIdx] = { ...rules[ruleIdx], ...updates };
    handleUpdateStage(stageId, { markingRules: rules });
  };

  const handleAddMarkingRule = (stageId: string) => {
    const stage = currentProfile.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const newRule: QuestionTypeMarkingRule = {
      questionType: 'MCQ',
      marks: 1,
      negativeMarks: 0.3333,
      allowPartialCredit: false
    };
    handleUpdateStage(stageId, { markingRules: [...stage.markingRules, newRule] });
  };

  const handleDeleteMarkingRule = (stageId: string, ruleIdx: number) => {
    const stage = currentProfile.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const rules = stage.markingRules.filter((_, idx) => idx !== ruleIdx);
    handleUpdateStage(stageId, { markingRules: rules });
  };

  // Section configuration
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

  const handleRemoveErrorType = (typeToRemove: string) => {
    if (form.errorTypes.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      errorTypes: prev.errorTypes.filter((t) => t !== typeToRemove)
    }));
  };

  const handleAddSection = () => {
    const newId = `custom_${Date.now()}`;
    const newSec: SectionConfig = {
      id: newId,
      name: 'New Custom Section',
      totalQuestions: 25,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 20,
      sectionalCutoff: 10,
      topics: ['Custom Topic 1', 'Custom Topic 2']
    };
    setForm((prev) => ({
      ...prev,
      sections: [...prev.sections, newSec]
    }));
    setActiveSectionTab(newId);
  };

  const handleRemoveSection = (sectionId: string) => {
    if (form.sections.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId)
    }));
    if (activeSectionTab === sectionId) {
      setActiveSectionTab(form.sections.find((s) => s.id !== sectionId)?.id || '');
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importDataFromJson(text);
      setMessage({ type: 'success', text: `Backup restored! Mocks: ${res.mocks}, Mistakes: ${res.mistakes}` });
      onDataResetOrLoaded();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Invalid backup file' });
    }
    e.target.value = '';
  };

  const handleClearAll = async () => {
    try {
      await clearAllUserData();
      setConfirmClearModal(false);
      setMessage({ type: 'success', text: 'All database data successfully wiped and re-initialized.' });
      onDataResetOrLoaded();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to clear data' });
    }
  };

  const activeSection = form.sections.find((s) => s.id === activeSectionTab) || form.sections[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--ink-border)] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--sakura)] text-[var(--ink)] flex items-center justify-center border-2 border-[var(--ink-border)] shadow-manga-sm">
            <SettingsIcon className="w-5 h-5 text-[var(--ink)]" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-[var(--ink)] dark:text-[var(--text-main)]">
              Exam Setup & Engine Settings
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Configure exam profiles, stages, marking rules, notification sources, and local database backups.
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

      {/* SECTION A: Exam Profiles & Verification Sources (SPEC A Item 1) */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--ink-border)] pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-2">
              <Award className="w-5 h-5 text-[var(--sakura)]" />
              <span>Exam Profiles & Verification Sources (SPEC A)</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Manage competitive exam targets, official recruitment notification URLs, and verify cutoff sources.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold">
            {profiles.length} Available Profiles
          </span>
        </div>

        {/* Profile Tabs */}
        <div className="flex flex-wrap gap-2 border-b-2 border-[var(--ink-border)] pb-3">
          {profiles.map((p) => {
            const isSelected = p.id === activeProfileId;
            const hasUnverified = (p.unverifiedFields || []).length > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProfileId(p.id);
                  if (p.stages?.[0]) setActiveStageId(p.stages[0].id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[var(--sakura-soft)] text-[var(--ink)] border-[var(--sakura)] shadow-manga-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-transparent hover:border-[var(--ink-border)]'
                }`}
              >
                <span>{p.name}</span>
                {hasUnverified && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Contains unverified fields" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Profile Configuration */}
        {currentProfile && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                  Profile Short Name
                </label>
                <input
                  type="text"
                  value={currentProfile.name}
                  onChange={(e) => handleUpdateProfile({ name: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                  Target Exam Year
                </label>
                <input
                  type="number"
                  value={currentProfile.targetYear || 2027}
                  onChange={(e) => handleUpdateProfile({ targetYear: Number(e.target.value) || 2027 })}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                />
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                    Official Notification Source URL
                  </label>
                  {currentProfile.sourceUrl && (
                    <a
                      href={currentProfile.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[var(--action-primary)] hover:underline"
                    >
                      <span>Test Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  placeholder="https://official-portal.ac.in"
                  value={currentProfile.sourceUrl || ''}
                  onChange={(e) => handleUpdateProfile({ sourceUrl: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                />
              </div>
            </div>

            {/* Unverified Badges & Confirmation Checklist */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[var(--action-primary)]" />
                  <span>Notification Verification Status</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  Toggle to mark confirmed vs provisional
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: 'cutoffMarks', label: 'Qualifying Cutoff' },
                  { id: 'examDates', label: 'Exam Dates / Schedule' },
                  { id: 'markingRules', label: 'Marking Rules / Penalty' }
                ].map((item) => {
                  const isUnverified = (currentProfile.unverifiedFields || []).includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleUnverifiedField(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 border transition-all ${
                        isUnverified
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {isUnverified ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>{item.label}: UNVERIFIED, confirm</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{item.label}: Verified</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION B: Stages Architecture & Question-Type Marking Rules (SPEC A Item 1) */}
      {currentProfile && (
        <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[var(--ink-border)] pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--sakura)]" />
                <span>Stage Architecture & Question-Type Marking Engine</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Configure exam stages (e.g. CBT, Phase 1, Phase 2, Prelims) and question-type marking rules (MCQ, MSQ, NAT, Descriptive).
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddStage}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--sakura)] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stage</span>
            </button>
          </div>

          {/* Stage Tabs */}
          <div className="flex flex-wrap gap-2 border-b-2 border-[var(--ink-border)] pb-3">
            {(currentProfile.stages || []).map((stage) => {
              const isSelected = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${
                    isSelected
                      ? 'bg-[var(--peach)] text-[var(--ink)] border-[var(--ink-border)] shadow-manga-sm'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-transparent hover:border-[var(--ink-border)]'
                  }`}
                >
                  <span>{stage.name}</span>
                </button>
              );
            })}
          </div>

          {activeStage && (
            <div className="space-y-5 pt-1">
              {/* Stage Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Stage Name
                  </label>
                  <input
                    type="text"
                    value={activeStage.name}
                    onChange={(e) => handleUpdateStage(activeStage.id, { name: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={activeStage.durationMinutes}
                    onChange={(e) =>
                      handleUpdateStage(activeStage.id, { durationMinutes: Number(e.target.value) || 60 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={activeStage.totalMarks}
                    onChange={(e) =>
                      handleUpdateStage(activeStage.id, { totalMarks: Number(e.target.value) || 100 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                      Stage Cutoff Marks
                    </label>
                    {(currentProfile.unverifiedFields || []).includes('cutoffMarks') && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                        UNVERIFIED, confirm
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={activeStage.cutoffMarks || 0}
                    onChange={(e) =>
                      handleUpdateStage(activeStage.id, { cutoffMarks: Number(e.target.value) || 0 })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-[var(--ink)] dark:text-[var(--text-main)]"
                  />
                </div>
              </div>

              {/* Question-Type Marking Rules Editor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                    Question-Type Marking Rules ({activeStage.markingRules?.length || 0} rules)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddMarkingRule(activeStage.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--sakura)] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Rule</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--bg-panel)] border-b-2 border-[var(--ink-border)] font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                      <tr>
                        <th className="p-2.5">Question Type</th>
                        <th className="p-2.5">Marks (+Correct)</th>
                        <th className="p-2.5">Negative (-Penalty)</th>
                        <th className="p-2.5">Partial Credit</th>
                        <th className="p-2.5">NAT Tolerance</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink-border)]">
                      {(activeStage.markingRules || []).map((rule, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5">
                            <select
                              value={rule.questionType}
                              onChange={(e) =>
                                handleUpdateMarkingRule(activeStage.id, idx, {
                                  questionType: e.target.value as QuestionType
                                })
                              }
                              className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] font-semibold"
                            >
                              <option value="MCQ">MCQ (Multiple Choice)</option>
                              <option value="MSQ">MSQ (Multiple Select - No Negative)</option>
                              <option value="NAT">NAT (Numerical Answer)</option>
                              <option value="descriptive">Descriptive</option>
                            </select>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.25"
                              value={rule.marks}
                              onChange={(e) =>
                                handleUpdateMarkingRule(activeStage.id, idx, {
                                  marks: Number(e.target.value) || 1
                                })
                              }
                              className="w-20 text-xs px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] font-mono font-bold"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.05"
                              value={rule.negativeMarks}
                              onChange={(e) =>
                                handleUpdateMarkingRule(activeStage.id, idx, {
                                  negativeMarks: Number(e.target.value) || 0
                                })
                              }
                              className="w-20 text-xs px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] font-mono font-bold"
                            />
                          </td>
                          <td className="p-2.5">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule.allowPartialCredit || false}
                                onChange={(e) =>
                                  handleUpdateMarkingRule(activeStage.id, idx, {
                                    allowPartialCredit: e.target.checked
                                  })
                                }
                                className="w-3.5 h-3.5 rounded border-[var(--ink-border)] text-[var(--action-primary)]"
                              />
                              <span className="text-[11px] text-[var(--text-muted)]">
                                {rule.questionType === 'MSQ' ? 'NO Partial Credit' : 'Allow Partial'}
                              </span>
                            </label>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.001"
                              placeholder="0"
                              value={rule.natTolerance ?? 0}
                              onChange={(e) =>
                                handleUpdateMarkingRule(activeStage.id, idx, {
                                  natTolerance: Number(e.target.value) || 0
                                })
                              }
                              className="w-20 text-xs px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] font-mono"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteMarkingRule(activeStage.id, idx)}
                              className="p-1 text-rose-500 hover:text-rose-700"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {currentProfile.stages.length > 1 && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteStage(activeStage.id)}
                    className="px-3 py-1.5 rounded-xl border border-rose-400 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                  >
                    Delete Stage
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Overall Exam Target & Constraints */}
        <div className="p-5 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
          <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
            Overall Exam Target & Constraints (Active Default)
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

      {/* Manga Icon & Tone Customization */}
      <MangaIconSettings />

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <button
            type="button"
            onClick={exportAllDataAsJson}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] hover:bg-[var(--sakura-soft)] text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-[var(--sakura)]" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] hover:bg-[var(--sakura-soft)] text-xs font-bold cursor-pointer transition-all shadow-manga-sm hover:-translate-y-0.5">
            <Upload className="w-4 h-4 text-[var(--sakura)]" />
            <span>Restore Backup</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleStartRepairDryRun}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--mint-soft)] hover:bg-[var(--mint)]/30 text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5"
            title="Scan database for duplicated or 9-option questions, preview dry-run, and repair options"
          >
            <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Repair Existing Mistakes</span>
          </button>

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

      {/* Repair Existing Mistakes Dry-Run Modal */}
      {isRepairModalOpen && repairPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--bg-panel)] rounded-2xl p-6 max-w-2xl w-full border-2 border-[var(--ink-border)] space-y-4 shadow-manga-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-[var(--ink-border)]">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  Repair Existing Mistakes (Dry Run)
                </h3>
              </div>
              <button onClick={() => setIsRepairModalOpen(false)} className="p-1 hover:opacity-75">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-[var(--ink-border)] flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-900 dark:text-stone-100">
                    Scanned {repairPlan.totalScanned} mistake record(s)
                  </div>
                  <div className="text-stone-500">
                    {repairPlan.affectedCount === 0
                      ? 'No affected records found. All questions have clean, valid 2–5 options!'
                      : `${repairPlan.affectedCount} record(s) will be repaired (duplicates removed, Devanagari Hindi stripped, labels normalized, answers remapped).`}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs ${
                  repairPlan.affectedCount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {repairPlan.affectedCount} affected
                </span>
              </div>

              {repairPlan.previews.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-stone-700 dark:text-stone-300">
                    Preview of Sample Changes (first {repairPlan.previews.length}):
                  </h4>
                  {repairPlan.previews.map((prev, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--bg-surface)] space-y-2">
                      <div className="flex items-center justify-between font-bold">
                        <span>{prev.mockName} — Q.{prev.questionNumber}</span>
                        <span className="text-[11px] font-mono text-stone-500">
                          {prev.before.optionsCount} options ➔ {prev.after.optionsCount} options
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
                          <span className="font-bold text-rose-700 dark:text-rose-300 block mb-1">Before:</span>
                          <div><strong>Correct:</strong> {prev.before.correctAnswer}</div>
                          <div><strong>Selected:</strong> {prev.before.myAnswer}</div>
                        </div>
                        <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 block mb-1">After:</span>
                          <div><strong>Correct:</strong> {prev.after.correctAnswer}</div>
                          <div><strong>Selected:</strong> {prev.after.myAnswer}</div>
                        </div>
                      </div>
                      {prev.needsReview && (
                        <div className="text-[11px] font-semibold text-amber-700">
                          ⚠️ Flagged for review: {prev.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--ink-border)] flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                Automatic JSON backup is exported before any database changes are saved. Safe to run repeatedly.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRepairModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--ink-border)] bg-[var(--bg-surface)] text-xs font-bold"
                >
                  Close
                </button>
                {repairPlan.affectedCount > 0 && (
                  <button
                    type="button"
                    disabled={isRepairing}
                    onClick={handleApplyRepair}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-manga-sm disabled:opacity-50"
                  >
                    {isRepairing ? 'Repairing...' : 'Backup & Apply Repairs'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
