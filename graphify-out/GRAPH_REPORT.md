# Graph Report - proj-track2  (2026-11-05)

## Corpus Check
- 94 files · ~99,966 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 2, .plist 2)

## Summary
- 701 nodes · 1633 edges · 43 communities (33 shown, 10 thin omitted)
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
- typescript@^5.8.2
- Mock Data Cleaning Scripts
- In-Page Testbook Exporter
- vitest
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
- Puppeteer Browser Automation
- ExamSettings
- puppeteer-core
- QuestionRenderer.tsx
- package.json
- React DOM Types
- Safari Extension Build Script
- Scripts Package Metadata

## God Nodes (most connected - your core abstractions)
1. `ExamSettings` - 34 edges
2. `MistakeEntry` - 34 edges
3. `react` - 30 edges
4. `MockTest` - 27 edges
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
- `test_question_paper_parser()` --calls--> `parse_question_paper()`  [EXTRACTED]
  scrapling-service/tests/test_parsers.py → scrapling-service/parsers/question_paper_parser.py
- `test_solution_parser()` --calls--> `parse_solution()`  [EXTRACTED]
  scrapling-service/tests/test_parsers.py → scrapling-service/parsers/solution_parser.py

## Import Cycles
- None detected.

## Communities (43 total, 10 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.06
Nodes (45): DEFAULT_CANONICAL_TOPICS, DEFAULT_CS_TOPICS, DEFAULT_ENGLISH_TOPICS, DEFAULT_ERROR_TYPES, DEFAULT_GENERAL_AWARENESS_TOPICS, DEFAULT_QUANT_TOPICS, DEFAULT_QUESTS, DEFAULT_REASONING_TOPICS (+37 more)

### Community 1 - "App Routing & Views"
Cohesion: 0.11
Nodes (37): DataIntakeModal(), DataIntakeModalProps, TabType, ERROR_TYPE_SHORTCUTS, ImportInboxView(), ImportInboxViewProps, isOptionCorrect(), Difficulty (+29 more)

### Community 2 - "Scrapling FastAPI Service"
Cohesion: 0.11
Nodes (20): extract_question_paper(), extract_solution(), extract_summary(), health(), HtmlPayload, PaperQuestion, parse_question_paper(), QuestionOption (+12 more)

### Community 3 - "Data Intake & Parsing Modal"
Cohesion: 0.11
Nodes (35): App(), CheatSheetView, DashboardView, DataIntakeModal, GlobalSearchModal, ImportInboxView, KeyboardShortcutsModal, MistakesView (+27 more)

### Community 4 - "Planner & Strategy View"
Cohesion: 0.11
Nodes (34): PlannerView(), SectionConfig, AccuracyVsAttemptsPoint, calculateAccuracyVsAttempts(), calculateErrorDistribution(), calculateImprovementMetrics(), calculateMarksLostBreakdown(), calculateRepeatedMistakes() (+26 more)

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
Nodes (16): devDependencies, jsdom@^30.1.3, postcss@^8.5.3, tailwindcss@^3.4.17, @testing-library/react@^16.3.3, tsx@^4.23.15, @types/jsdom@^30.0.0, @types/react@^18.3.18 (+8 more)

### Community 12 - "Testbook DOM Adapter"
Cohesion: 0.26
Nodes (13): chr(), cleanText(), ExtractedQuestion, ExtractedQuestionOption, ExtractedResultSummary, ExtractedSectionSummary, extractQuestionPaperDOM(), extractVisibleQuestion() (+5 more)

### Community 14 - "Mock Data Cleaning Scripts"
Cohesion: 0.19
Nodes (8): activeScanState, captureSelectionFromTab(), deliveredIds, deliverPayload(), findStudyAppTab(), getAppUrl(), isAllowedSourceUrl(), pendingTransfers

### Community 15 - "In-Page Testbook Exporter"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 16 - "vitest"
Cohesion: 0.22
Nodes (8): fake-indexeddb@^6.2.7, @testing-library/jest-dom@^7.0.1, vitest@^3.0.8, fake-indexeddb, @testing-library/jest-dom, vitest, getContrastRatio(), getRelativeLuminance()

### Community 17 - "exportImport.ts"
Cohesion: 0.11
Nodes (31): SettingsView(), SettingsViewProps, clearAllUserData(), DEFAULT_PROFILES, DEFAULT_SETTINGS, applyBackup(), BACKUP_SCHEMA_VERSION, BackupImage (+23 more)

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
Cohesion: 0.29
Nodes (4): fs, os, path, puppeteer

### Community 29 - "Testbook Content Adapter"
Cohesion: 0.61
Nodes (7): cleanText(), extractVisibleQuestion(), extractVisibleSummary(), inspectPage(), isElementVisible(), normalizeOptionsRaw(), parseNumber()

### Community 31 - "Puppeteer Browser Automation"
Cohesion: 0.40
Nodes (5): fs, path, puppeteer, run(), sleep()

### Community 32 - "ExamSettings"
Cohesion: 0.09
Nodes (55): lucide-react, react, @testing-library/react, CheatSheetView(), CheatSheetViewProps, DashboardView(), DashboardViewProps, GlobalSearchModalProps (+47 more)

### Community 33 - "puppeteer-core"
Cohesion: 0.40
Nodes (5): puppeteer-core@^25.16.0, puppeteer-core, puppeteer, run(), sleep()

### Community 34 - "QuestionRenderer.tsx"
Cohesion: 0.16
Nodes (16): MistakesView(), parseQuestionTextAndOptions(), checkNatAnswer(), CodeBlock(), CS_KEYWORDS, ErrorBoundaryProps, ErrorBoundaryState, isOptionMatched() (+8 more)

### Community 35 - "package.json"
Cohesion: 0.15
Nodes (12): autoprefixer@^10.4.20, @testing-library/user-event@^14.6.8, @types/katex@^0.16.8, @types/node@^22.13.10, name, private, type, version (+4 more)

## Knowledge Gaps
- **5 isolated node(s):** `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter`, `Spaced Repetition (Daily Quest)`, `Scrapling Python Service`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 220 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `ExamSettings`, `App Routing & Views`, `QuestionRenderer.tsx`, `package.json`, `Planner & Strategy View`, `Testbook DOM Adapter`, `exportImport.ts`, `Extension Icon Generator`, `Reconciliation E2E Testing`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **What connects `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06196078431372549 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `puppeteer-core` to `package.json`, `ref_fs`, `Core Application Architecture`, `Flow Verification Scripts`, `Puppeteer Browser Automation`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `App Routing & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.11014492753623188 - nodes in this community are weakly interconnected._
- **Why does `react` connect `ExamSettings` to `App Routing & Views`, `QuestionRenderer.tsx`, `Data Intake & Parsing Modal`, `package.json`, `Planner & Strategy View`, `macOS Swift Container App`, `exportImport.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `Scrapling FastAPI Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10531400966183575 - nodes in this community are weakly interconnected._