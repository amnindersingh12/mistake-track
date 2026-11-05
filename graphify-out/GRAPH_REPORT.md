# Graph Report - proj-track5  (2026-11-05)

## Corpus Check
- 106 files · ~112,676 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 2, .plist 2)

## Summary
- 767 nodes · 1869 edges · 45 communities (35 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `85ece5f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- App Routing & Views
- Scrapling FastAPI Service
- Data Intake & Parsing Modal
- Planner & Strategy View
- ref_fs
- Core Runtime Dependencies
- Full Mock Scanner Script
- Safari Extension Manifest
- Build & Testing Tooling
- macOS Swift Container App
- package.json
- Testbook DOM Adapter
- xpEngine.ts
- Mock Data Cleaning Scripts
- In-Page Testbook Exporter
- mockValidation.ts
- exportImport.ts
- NPM Lifecycle Scripts
- Extension Icon Generator
- Extension Popup Logic
- Oliveboard Solution Extractor
- My-Data Import Script
- StudyBridge E2E Tests
- React Testing Infrastructure
- Core Application Architecture
- Vite Bundler Configuration
- Reconciliation E2E Testing
- Flow Verification Scripts
- Testbook Content Adapter
- @testing-library/react
- Puppeteer Browser Automation
- ScreenshotInput.tsx
- AmbientAudioSynthesizer
- QuestionRenderer.tsx
- package.json
- React DOM Types
- Safari Extension Build Script
- Scripts Package Metadata
- @testing-library/user-event@^14.6.8

## God Nodes (most connected - your core abstractions)
1. `MistakeEntry` - 39 edges
2. `react` - 36 edges
3. `ExamSettings` - 34 edges
4. `MockTest` - 28 edges
5. `getTodayDateStr()` - 27 edges
6. `vitest` - 25 edges
7. `lucide-react` - 24 edges
8. `App()` - 23 edges
9. `Mascot()` - 23 edges
10. `db` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Oliveboard Mock Test Exporter` --exports_compatible_json_for--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  docs/scraper_guide.md → README.md
- `StudyBridge Safari Extension` --delivers_data_to--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  safari-extension/README.md → README.md
- `KeyboardShortcutsModal()` --calls--> `Mascot()`  [EXTRACTED]
  src/components/KeyboardShortcutsModal.tsx → src/components/Mascot.tsx
- `SettingsViewProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/SettingsView.tsx → src/types/index.ts
- `MockCsvParseResult` --references--> `MockTest`  [EXTRACTED]
  src/utils/dataIntake.ts → src/types/index.ts

## Import Cycles
- None detected.

## Communities (45 total, 10 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.06
Nodes (73): lucide-react, react, @testing-library/react, CheatSheetViewProps, DashboardViewProps, GlobalSearchModalProps, SearchResultItem, MascotMood (+65 more)

### Community 1 - "App Routing & Views"
Cohesion: 0.09
Nodes (50): CheatSheetView(), DashboardView(), DataIntakeModal(), DataIntakeModalProps, TabType, ERROR_TYPE_SHORTCUTS, ImportInboxView(), ImportInboxViewProps (+42 more)

### Community 2 - "Scrapling FastAPI Service"
Cohesion: 0.11
Nodes (20): extract_question_paper(), extract_solution(), extract_summary(), health(), HtmlPayload, PaperQuestion, parse_question_paper(), QuestionOption (+12 more)

### Community 3 - "Data Intake & Parsing Modal"
Cohesion: 0.09
Nodes (39): App(), CheatSheetView, DashboardView, DataIntakeModal, GlobalSearchModal, ImportInboxView, KeyboardShortcutsModal, MistakesView (+31 more)

### Community 4 - "Planner & Strategy View"
Cohesion: 0.14
Nodes (29): PlannerView(), AccuracyVsAttemptsPoint, calculateAccuracyVsAttempts(), calculateErrorDistribution(), calculateImprovementMetrics(), calculateMarksLostBreakdown(), calculateRepeatedMistakes(), calculateTimeAnalysis() (+21 more)

### Community 5 - "ref_fs"
Cohesion: 0.18
Nodes (8): fs, path, puppeteer, fs, path, puppeteer, runVisualQA(), sleep()

### Community 6 - "Core Runtime Dependencies"
Cohesion: 0.12
Nodes (17): cleanText(), delay(), FullMockScanner, inPageTestbookExport(), checkAttemptedByTestbookFunction(), checkCorrectByTestbookFunction(), domFallback(), extractTest() (+9 more)

### Community 7 - "Full Mock Scanner Script"
Cohesion: 0.10
Nodes (20): action, default_icon, background, service_worker, content_scripts, 128, 16, 32 (+12 more)

### Community 8 - "Safari Extension Manifest"
Cohesion: 0.11
Nodes (5): Cocoa, os.log, AppDelegate, SafariWebExtensionHandler, SafariServices

### Community 9 - "Build & Testing Tooling"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 10 - "macOS Swift Container App"
Cohesion: 0.11
Nodes (19): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, katex@^0.19.1, lucide-react@^1.16.0, react@^18.3.1 (+11 more)

### Community 11 - "package.json"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss@^3.4.17, @testing-library/react@^16.3.3, tsx@^4.23.15, @types/katex@^0.16.8, @types/node@^22.13.10, @types/react@^18.3.18, @types/react-dom@^18.3.5 (+9 more)

### Community 12 - "Testbook DOM Adapter"
Cohesion: 0.26
Nodes (13): chr(), cleanText(), ExtractedQuestion, ExtractedQuestionOption, ExtractedResultSummary, ExtractedSectionSummary, extractQuestionPaperDOM(), extractVisibleQuestion() (+5 more)

### Community 13 - "xpEngine.ts"
Cohesion: 0.08
Nodes (54): BossBattleModal(), BossBattleModalProps, BossQuestion, DEFAULT_BOSS_QUESTIONS, FocusView(), FocusViewProps, TIMER_PRESETS, TimerMode (+46 more)

### Community 14 - "Mock Data Cleaning Scripts"
Cohesion: 0.19
Nodes (8): activeScanState, captureSelectionFromTab(), deliveredIds, deliverPayload(), findStudyAppTab(), getAppUrl(), isAllowedSourceUrl(), pendingTransfers

### Community 15 - "In-Page Testbook Exporter"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 16 - "mockValidation.ts"
Cohesion: 0.60
Nodes (3): MockSectionValidationInput, MockValidationErrors, validateMockSections()

### Community 17 - "exportImport.ts"
Cohesion: 0.09
Nodes (35): vitest, SettingsView(), SettingsViewProps, clearAllUserData(), getContrastRatio(), getRelativeLuminance(), applyBackup(), BACKUP_SCHEMA_VERSION (+27 more)

### Community 18 - "NPM Lifecycle Scripts"
Cohesion: 0.25
Nodes (10): allMocks, cleanMockData(), cleanOption(), files, formatExplanation(), fs, mocksDir, outDir (+2 more)

### Community 20 - "Extension Popup Logic"
Cohesion: 0.20
Nodes (10): scripts, build, clean-mock, dev, extract, import-my-data, pipeline, preview (+2 more)

### Community 21 - "Oliveboard Solution Extractor"
Cohesion: 0.24
Nodes (8): crc32(), createPng(), fs, iconsDir, iconSizes, makeChunk(), path, zlib

### Community 22 - "My-Data Import Script"
Cohesion: 0.40
Nodes (9): hideAlert(), hideScanUi(), refreshStatus(), setBadge(), showAlert(), startScanPolling(), stopScanPolling(), triggerCapture() (+1 more)

### Community 23 - "StudyBridge E2E Tests"
Cohesion: 0.24
Nodes (10): cleanHtmlText(), decodeToken(), defaultHtml, defaultJson, fs, html, normalizeOptionsRaw(), parseOliveboardHtml() (+2 more)

### Community 24 - "React Testing Infrastructure"
Cohesion: 0.20
Nodes (7): bundle, defaultSettings, files, fs, MY_DATA_DIR, OUTPUT_BUNDLE, path

### Community 25 - "Core Application Architecture"
Cohesion: 0.28
Nodes (7): expectValue(), fs, path, puppeteer, runStudyBridgeE2E(), sleep(), { spawn }

### Community 26 - "Vite Bundler Configuration"
Cohesion: 0.33
Nodes (7): Spaced Repetition (Daily Quest), Dexie Database Schema V4, Import Inbox & Fast Triage, Mistake Notebook & Mock Analyzer, Oliveboard Mock Test Exporter, Scrapling Python Service, StudyBridge Safari Extension

### Community 27 - "Reconciliation E2E Testing"
Cohesion: 0.29
Nodes (4): vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 28 - "Flow Verification Scripts"
Cohesion: 0.17
Nodes (9): puppeteer-core@^25.16.0, puppeteer-core, puppeteer, run(), sleep(), fs, os, path (+1 more)

### Community 29 - "Testbook Content Adapter"
Cohesion: 0.61
Nodes (7): cleanText(), extractVisibleQuestion(), extractVisibleSummary(), inspectPage(), isElementVisible(), normalizeOptionsRaw(), parseNumber()

### Community 30 - "@testing-library/react"
Cohesion: 0.40
Nodes (4): fake-indexeddb@^6.2.7, @testing-library/jest-dom@^7.0.1, fake-indexeddb, @testing-library/jest-dom

### Community 31 - "Puppeteer Browser Automation"
Cohesion: 0.40
Nodes (5): fs, path, puppeteer, run(), sleep()

### Community 32 - "ScreenshotInput.tsx"
Cohesion: 0.48
Nodes (5): compressImage(), CompressionResult, formatBytes(), ScreenshotInput(), ScreenshotInputProps

### Community 33 - "AmbientAudioSynthesizer"
Cohesion: 0.16
Nodes (4): ambientAudio, AmbientAudioState, AmbientAudioSynthesizer, AmbientSoundType

### Community 34 - "QuestionRenderer.tsx"
Cohesion: 0.53
Nodes (5): QuestionRenderer(), QuestionRendererProps, renderFormattedContent(), renderTextWithMath(), QuestionType

### Community 35 - "package.json"
Cohesion: 0.15
Nodes (12): autoprefixer@^10.4.20, jsdom@^30.1.3, postcss@^8.5.3, @types/jsdom@^30.0.0, name, private, type, version (+4 more)

## Knowledge Gaps
- **5 isolated node(s):** `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter`, `Spaced Repetition (Daily Quest)`, `Scrapling Python Service`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 233 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `exportImport.ts` to `index.ts`, `ScreenshotInput.tsx`, `AmbientAudioSynthesizer`, `package.json`, `Planner & Strategy View`, `App Routing & Views`, `package.json`, `Testbook DOM Adapter`, `xpEngine.ts`, `mockValidation.ts`, `Extension Icon Generator`, `Reconciliation E2E Testing`, `@testing-library/react`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **What connects `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06016929764355983 - nodes in this community are weakly interconnected._
- **Why does `react` connect `index.ts` to `ScreenshotInput.tsx`, `App Routing & Views`, `QuestionRenderer.tsx`, `Data Intake & Parsing Modal`, `package.json`, `Planner & Strategy View`, `macOS Swift Container App`, `xpEngine.ts`, `exportImport.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `App Routing & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.08771929824561403 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `Flow Verification Scripts` to `Core Application Architecture`, `package.json`, `ref_fs`, `Puppeteer Browser Automation`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Scrapling FastAPI Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10531400966183575 - nodes in this community are weakly interconnected._