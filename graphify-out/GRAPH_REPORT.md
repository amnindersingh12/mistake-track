# Graph Report - proj-track1  (2026-11-05)

## Corpus Check
- 97 files · ~104,525 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 2, .plist 2)

## Summary
- 711 nodes · 1665 edges · 43 communities (35 shown, 8 thin omitted)
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
- test_visual_qa.cjs
- Core Runtime Dependencies
- Full Mock Scanner Script
- Safari Extension Manifest
- Build & Testing Tooling
- macOS Swift Container App
- package.json
- vitest
- ref_path
- Mock Data Cleaning Scripts
- In-Page Testbook Exporter
- MocksView.tsx
- exportImport.ts
- NPM Lifecycle Scripts
- markingEngine.ts
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
- MistakeEntry
- puppeteer-core
- tsx@^4.23.15
- React DOM Types
- Safari Extension Build Script
- Scripts Package Metadata

## God Nodes (most connected - your core abstractions)
1. `MistakeEntry` - 35 edges
2. `ExamSettings` - 34 edges
3. `react` - 31 edges
4. `MockTest` - 28 edges
5. `getTodayDateStr()` - 27 edges
6. `App()` - 23 edges
7. `Mascot()` - 23 edges
8. `vitest` - 22 edges
9. `MistakeNotebookDatabase` - 21 edges
10. `PaperTest` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Oliveboard Mock Test Exporter` --exports_compatible_json_for--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  docs/scraper_guide.md → README.md
- `StudyBridge Safari Extension` --delivers_data_to--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  safari-extension/README.md → README.md
- `SettingsViewProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/SettingsView.tsx → src/types/index.ts
- `ScoreQuestionInput` --references--> `QuestionType`  [EXTRACTED]
  src/exams/markingEngine.ts → src/types/index.ts
- `test_question_paper_parser()` --calls--> `parse_question_paper()`  [EXTRACTED]
  scrapling-service/tests/test_parsers.py → scrapling-service/parsers/question_paper_parser.py

## Import Cycles
- None detected.

## Communities (43 total, 8 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.05
Nodes (52): DEFAULT_CANONICAL_TOPICS, DEFAULT_CS_TOPICS, DEFAULT_ENGLISH_TOPICS, DEFAULT_ERROR_TYPES, DEFAULT_GENERAL_AWARENESS_TOPICS, DEFAULT_PROFILES, DEFAULT_QUANT_TOPICS, DEFAULT_QUESTS (+44 more)

### Community 1 - "App Routing & Views"
Cohesion: 0.10
Nodes (42): DataIntakeModal(), DataIntakeModalProps, TabType, ERROR_TYPE_SHORTCUTS, ImportInboxView(), ImportInboxViewProps, isOptionCorrect(), DEFAULT_SETTINGS (+34 more)

### Community 2 - "Scrapling FastAPI Service"
Cohesion: 0.11
Nodes (20): extract_question_paper(), extract_solution(), extract_summary(), health(), HtmlPayload, PaperQuestion, parse_question_paper(), QuestionOption (+12 more)

### Community 3 - "Data Intake & Parsing Modal"
Cohesion: 0.11
Nodes (35): App(), CheatSheetView, DashboardView, DataIntakeModal, GlobalSearchModal, ImportInboxView, KeyboardShortcutsModal, MistakesView (+27 more)

### Community 4 - "Planner & Strategy View"
Cohesion: 0.09
Nodes (44): DashboardView(), PlannerView(), QuestionRenderer(), QuestionRendererProps, renderFormattedContent(), renderTextWithMath(), QuestionType, AccuracyVsAttemptsPoint (+36 more)

### Community 5 - "test_visual_qa.cjs"
Cohesion: 0.40
Nodes (5): fs, path, puppeteer, runVisualQA(), sleep()

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
Nodes (23): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, katex@^0.19.1, lucide-react@^1.16.0, react-dom@^18.3.1 (+15 more)

### Community 11 - "package.json"
Cohesion: 0.09
Nodes (22): devDependencies, autoprefixer@^10.4.20, jsdom@^30.1.3, postcss@^8.5.3, tailwindcss@^3.4.17, @testing-library/user-event@^14.6.8, @types/jsdom@^30.0.0, @types/katex@^0.16.8 (+14 more)

### Community 12 - "vitest"
Cohesion: 0.10
Nodes (20): vitest, getContrastRatio(), getRelativeLuminance(), NormalizedOptionItem, normalizeOptionObjects(), normalizeOptions(), StudyBridgeQueueManager, chr() (+12 more)

### Community 13 - "ref_path"
Cohesion: 0.33
Nodes (3): fs, path, puppeteer

### Community 14 - "Mock Data Cleaning Scripts"
Cohesion: 0.19
Nodes (8): activeScanState, captureSelectionFromTab(), deliveredIds, deliverPayload(), findStudyAppTab(), getAppUrl(), isAllowedSourceUrl(), pendingTransfers

### Community 15 - "In-Page Testbook Exporter"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 16 - "MocksView.tsx"
Cohesion: 0.33
Nodes (7): MocksView(), MocksViewProps, extractExamNameFromMock(), AttemptType, MockSectionValidationInput, MockValidationErrors, validateMockSections()

### Community 17 - "exportImport.ts"
Cohesion: 0.14
Nodes (25): SettingsView(), SettingsViewProps, clearAllUserData(), applyBackup(), BACKUP_SCHEMA_VERSION, BackupImage, BackupSummary, buildMistakesCsv() (+17 more)

### Community 18 - "NPM Lifecycle Scripts"
Cohesion: 0.25
Nodes (10): allMocks, cleanMockData(), cleanOption(), files, formatExplanation(), fs, mocksDir, outDir (+2 more)

### Community 19 - "markingEngine.ts"
Cohesion: 0.40
Nodes (8): calculateQuestionBreakEvenAccuracy(), getDefaultNegativeMarks(), normalizeOptions(), scoreExamAttempt(), scoreQuestion(), ScoreQuestionInput, ScoreQuestionResult, QuestionTypeMarkingRule

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
Cohesion: 0.29
Nodes (4): fs, os, path, puppeteer

### Community 29 - "Testbook Content Adapter"
Cohesion: 0.61
Nodes (7): cleanText(), extractVisibleQuestion(), extractVisibleSummary(), inspectPage(), isElementVisible(), normalizeOptionsRaw(), parseNumber()

### Community 30 - "@testing-library/react"
Cohesion: 0.40
Nodes (4): fake-indexeddb@^6.2.7, @testing-library/jest-dom@^7.0.1, fake-indexeddb, @testing-library/jest-dom

### Community 31 - "Puppeteer Browser Automation"
Cohesion: 0.33
Nodes (5): fs, path, puppeteer, run(), sleep()

### Community 32 - "MistakeEntry"
Cohesion: 0.09
Nodes (47): react@^18.3.1, @testing-library/react@^16.3.3, react, @testing-library/react, CheatSheetView(), CheatSheetViewProps, DashboardViewProps, GlobalSearchModalProps (+39 more)

### Community 33 - "puppeteer-core"
Cohesion: 0.40
Nodes (5): puppeteer-core@^25.16.0, puppeteer-core, puppeteer, run(), sleep()

### Community 34 - "tsx@^4.23.15"
Cohesion: 0.33
Nodes (4): tsx@^4.23.15, @types/node@^22.13.10, tsx, @types/node

## Knowledge Gaps
- **5 isolated node(s):** `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter`, `Spaced Repetition (Daily Quest)`, `Scrapling Python Service`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 220 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `MistakeEntry`, `App Routing & Views`, `index.ts`, `Planner & Strategy View`, `macOS Swift Container App`, `package.json`, `MocksView.tsx`, `exportImport.ts`, `markingEngine.ts`, `Reconciliation E2E Testing`, `@testing-library/react`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **What connects `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05357142857142857 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `puppeteer-core` to `test_visual_qa.cjs`, `macOS Swift Container App`, `ref_path`, `Core Application Architecture`, `Flow Verification Scripts`, `Puppeteer Browser Automation`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `App Routing & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.1003921568627451 - nodes in this community are weakly interconnected._
- **Why does `react` connect `MistakeEntry` to `index.ts`, `App Routing & Views`, `Data Intake & Parsing Modal`, `Planner & Strategy View`, `macOS Swift Container App`, `MocksView.tsx`, `exportImport.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `Scrapling FastAPI Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10531400966183575 - nodes in this community are weakly interconnected._