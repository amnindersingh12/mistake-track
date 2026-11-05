# Graph Report - proj  (2026-11-05)

## Corpus Check
- 128 files · ~148,294 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 2, .plist 2)

## Summary
- 899 nodes · 2359 edges · 45 communities (36 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6fe511f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- QuestionRenderer.tsx
- App Routing & Views
- Scrapling FastAPI Service
- Data Intake & Parsing Modal
- Planner & Strategy View
- ScreenshotInput.tsx
- Core Runtime Dependencies
- Full Mock Scanner Script
- Safari Extension Manifest
- Build & Testing Tooling
- macOS Swift Container App
- package.json
- testbookAdapter.ts
- xpEngine.ts
- Mock Data Cleaning Scripts
- In-Page Testbook Exporter
- topicGraph.ts
- main
- NPM Lifecycle Scripts
- StudyBridgeQueueManager
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
- vitest
- Puppeteer Browser Automation
- AmbientAudioSynthesizer
- index.ts
- package.json
- React DOM Types
- Safari Extension Build Script
- Scripts Package Metadata
- puppeteer-core
- test_visual_qa.cjs

## God Nodes (most connected - your core abstractions)
1. `MistakeEntry` - 49 edges
2. `react` - 47 edges
3. `App()` - 38 edges
4. `ExamSettings` - 35 edges
5. `db` - 34 edges
6. `lucide-react` - 33 edges
7. `vitest` - 33 edges
8. `MockTest` - 29 edges
9. `Mascot()` - 27 edges
10. `getTodayDateStr()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Oliveboard Mock Test Exporter` --exports_compatible_json_for--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  docs/scraper_guide.md → README.md
- `StudyBridge Safari Extension` --delivers_data_to--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  safari-extension/README.md → README.md
- `CommandPaletteProps` --references--> `NavTab`  [EXTRACTED]
  src/components/CommandPalette.tsx → src/components/Sidebar.tsx
- `SettingsViewProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/SettingsView.tsx → src/types/index.ts
- `MockCsvParseResult` --references--> `MockTest`  [EXTRACTED]
  src/utils/dataIntake.ts → src/types/index.ts

## Import Cycles
- None detected.

## Communities (45 total, 9 thin omitted)

### Community 0 - "QuestionRenderer.tsx"
Cohesion: 0.19
Nodes (11): checkNatAnswer(), CodeBlock(), CS_KEYWORDS, ErrorBoundaryProps, ErrorBoundaryState, isOptionMatched(), NatCheckResult, QuestionRenderer() (+3 more)

### Community 1 - "App Routing & Views"
Cohesion: 0.05
Nodes (76): DataIntakeModal(), DataIntakeModalProps, TabType, ERROR_TYPE_SHORTCUTS, ImportInboxView(), ImportInboxViewProps, isOptionCorrect(), PapersView() (+68 more)

### Community 2 - "Scrapling FastAPI Service"
Cohesion: 0.11
Nodes (20): extract_question_paper(), extract_solution(), extract_summary(), health(), HtmlPayload, PaperQuestion, parse_question_paper(), QuestionOption (+12 more)

### Community 3 - "Data Intake & Parsing Modal"
Cohesion: 0.07
Nodes (53): AllExamsView, App(), BossBattleModal, CheatSheetView, CommandPalette, DashboardView, DataIntakeModal, FocusView (+45 more)

### Community 4 - "Planner & Strategy View"
Cohesion: 0.07
Nodes (53): PlannerView(), QuestionRendererProps, calculateQuestionBreakEvenAccuracy(), getDefaultNegativeMarks(), normalizeOptions(), scoreExamAttempt(), scoreQuestion(), ScoreQuestionInput (+45 more)

### Community 5 - "ScreenshotInput.tsx"
Cohesion: 0.48
Nodes (5): compressImage(), CompressionResult, formatBytes(), ScreenshotInput(), ScreenshotInputProps

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
Cohesion: 0.12
Nodes (17): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, katex@^0.19.1, lucide-react@^1.16.0, react@^18.3.1 (+9 more)

### Community 11 - "package.json"
Cohesion: 0.09
Nodes (30): devDependencies, autoprefixer@^10.4.20, jsdom@^30.1.3, postcss@^8.5.3, tailwindcss@^3.4.17, @testing-library/react@^16.3.3, @testing-library/user-event@^14.6.8, tsx@^4.23.15 (+22 more)

### Community 12 - "testbookAdapter.ts"
Cohesion: 0.26
Nodes (13): chr(), cleanText(), ExtractedQuestion, ExtractedQuestionOption, ExtractedResultSummary, ExtractedSectionSummary, extractQuestionPaperDOM(), extractVisibleQuestion() (+5 more)

### Community 13 - "xpEngine.ts"
Cohesion: 0.08
Nodes (57): canvas-confetti, BossBattleModal(), BossBattleModalProps, BossQuestion, DEFAULT_BOSS_QUESTIONS, FocusView(), FocusViewProps, TIMER_PRESETS (+49 more)

### Community 14 - "Mock Data Cleaning Scripts"
Cohesion: 0.19
Nodes (8): activeScanState, captureSelectionFromTab(), deliveredIds, deliverPayload(), findStudyAppTab(), getAppUrl(), isAllowedSourceUrl(), pendingTransfers

### Community 15 - "In-Page Testbook Exporter"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 16 - "topicGraph.ts"
Cohesion: 0.13
Nodes (30): OverlapMap(), PYQView(), PYQViewProps, resolveOptionMatches(), ProgressRing(), SyllabusView(), AttemptResult, calculateOverallPYQStats() (+22 more)

### Community 17 - "main"
Cohesion: 0.83
Nodes (4): main(), evaluate(), send(), takeScreenshot()

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
Cohesion: 0.21
Nodes (8): OUT_DIR, expectValue(), fs, path, puppeteer, runStudyBridgeE2E(), sleep(), { spawn }

### Community 26 - "Vite Bundler Configuration"
Cohesion: 0.33
Nodes (7): Spaced Repetition (Daily Quest), Dexie Database Schema V4, Import Inbox & Fast Triage, Mistake Notebook & Mock Analyzer, Oliveboard Mock Test Exporter, Scrapling Python Service, StudyBridge Safari Extension

### Community 27 - "Reconciliation E2E Testing"
Cohesion: 0.29
Nodes (4): vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 28 - "Flow Verification Scripts"
Cohesion: 0.29
Nodes (4): fs, os, path, puppeteer

### Community 29 - "Testbook Content Adapter"
Cohesion: 0.61
Nodes (7): cleanText(), extractVisibleQuestion(), extractVisibleSummary(), inspectPage(), isElementVisible(), normalizeOptionsRaw(), parseNumber()

### Community 30 - "vitest"
Cohesion: 0.22
Nodes (8): fake-indexeddb@^6.2.7, @testing-library/jest-dom@^7.0.1, vitest@^3.0.8, fake-indexeddb, @testing-library/jest-dom, vitest, getContrastRatio(), getRelativeLuminance()

### Community 31 - "Puppeteer Browser Automation"
Cohesion: 0.33
Nodes (5): fs, path, puppeteer, run(), sleep()

### Community 33 - "AmbientAudioSynthesizer"
Cohesion: 0.16
Nodes (4): ambientAudio, AmbientAudioState, AmbientAudioSynthesizer, AmbientSoundType

### Community 34 - "index.ts"
Cohesion: 0.05
Nodes (93): dexie-react-hooks, lucide-react, react, @testing-library/react, CheatSheetView(), CheatSheetViewProps, DashboardView(), DashboardViewProps (+85 more)

### Community 35 - "package.json"
Cohesion: 0.27
Nodes (14): RFC-4180, ReviewQueueView(), downloadAnkiCsv(), escapeCsvField(), escapeHtml(), exportMistakesToAnkiCsv(), formatAnkiBack(), formatAnkiFront() (+6 more)

### Community 48 - "puppeteer-core"
Cohesion: 0.20
Nodes (8): puppeteer-core@^25.16.0, puppeteer-core, fs, path, puppeteer, puppeteer, run(), sleep()

### Community 49 - "test_visual_qa.cjs"
Cohesion: 0.40
Nodes (5): fs, path, puppeteer, runVisualQA(), sleep()

## Knowledge Gaps
- **6 isolated node(s):** `Cocoa`, `os.log`, `RFC-4180`, `Oliveboard Mock Test Exporter`, `Spaced Repetition (Daily Quest)` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 252 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `QuestionRenderer.tsx`, `App Routing & Views`, `index.ts`, `AmbientAudioSynthesizer`, `Planner & Strategy View`, `ScreenshotInput.tsx`, `package.json`, `package.json`, `testbookAdapter.ts`, `xpEngine.ts`, `topicGraph.ts`, `StudyBridgeQueueManager`, `Reconciliation E2E Testing`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **What connects `Cocoa`, `os.log`, `RFC-4180` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `App Routing & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.05201465201465202 - nodes in this community are weakly interconnected._
- **Why does `react` connect `index.ts` to `QuestionRenderer.tsx`, `App Routing & Views`, `Data Intake & Parsing Modal`, `Planner & Strategy View`, `package.json`, `ScreenshotInput.tsx`, `macOS Swift Container App`, `package.json`, `xpEngine.ts`, `topicGraph.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Scrapling FastAPI Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10531400966183575 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `puppeteer-core` to `package.json`, `test_visual_qa.cjs`, `Core Application Architecture`, `Flow Verification Scripts`, `Puppeteer Browser Automation`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Data Intake & Parsing Modal` be split into smaller, more focused modules?**
  _Cohesion score 0.07297726070861978 - nodes in this community are weakly interconnected._