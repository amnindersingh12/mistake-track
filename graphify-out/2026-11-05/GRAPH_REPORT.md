# Graph Report - proj  (2026-11-05)

## Corpus Check
- 88 files · ~87,891 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 2, .plist 2)

## Summary
- 638 nodes · 1471 edges · 45 communities (33 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b62a00fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- UI Components & Icons
- App Routing & Views
- Scrapling FastAPI Service
- Data Intake & Parsing Modal
- Planner & Strategy View
- Settings & Exam Profiles
- Core Runtime Dependencies
- Full Mock Scanner Script
- Safari Extension Manifest
- Build & Testing Tooling
- macOS Swift Container App
- TypeScript Compiler Configuration
- Testbook DOM Adapter
- ref_fs
- Mock Data Cleaning Scripts
- In-Page Testbook Exporter
- autoprefixer@^10.4.20
- Extension Messaging Tests
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
- Screenshot Compression Component
- Puppeteer Browser Automation
- Visual End-to-End Tests
- @testing-library/react
- ScreenshotInput.tsx
- CSS Autoprefixer Config
- React DOM Types
- Safari Extension Build Script
- Scripts Package Metadata
- test_visual_qa.cjs

## God Nodes (most connected - your core abstractions)
1. `ExamSettings` - 34 edges
2. `MistakeEntry` - 31 edges
3. `react` - 28 edges
4. `MockTest` - 27 edges
5. `getTodayDateStr()` - 27 edges
6. `App()` - 23 edges
7. `Mascot()` - 23 edges
8. `PaperTest` - 21 edges
9. `vitest` - 19 edges
10. `lucide-react` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Oliveboard Mock Test Exporter` --exports_compatible_json_for--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  docs/scraper_guide.md → README.md
- `StudyBridge Safari Extension` --delivers_data_to--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  safari-extension/README.md → README.md
- `KeyboardShortcutsModal()` --calls--> `Mascot()`  [EXTRACTED]
  src/components/KeyboardShortcutsModal.tsx → src/components/Mascot.tsx
- `SettingsViewProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/SettingsView.tsx → src/types/index.ts
- `test_question_paper_parser()` --calls--> `parse_question_paper()`  [EXTRACTED]
  scrapling-service/tests/test_parsers.py → scrapling-service/parsers/question_paper_parser.py

## Import Cycles
- None detected.

## Communities (45 total, 12 thin omitted)

### Community 0 - "UI Components & Icons"
Cohesion: 0.08
Nodes (64): lucide-react, vitest, CheatSheetView(), CheatSheetViewProps, DashboardView(), DashboardViewProps, GlobalSearchModalProps, SearchResultItem (+56 more)

### Community 1 - "App Routing & Views"
Cohesion: 0.11
Nodes (35): DataIntakeModal(), DataIntakeModalProps, TabType, ERROR_TYPE_SHORTCUTS, ImportInboxView(), ImportInboxViewProps, isOptionCorrect(), Difficulty (+27 more)

### Community 2 - "Scrapling FastAPI Service"
Cohesion: 0.11
Nodes (20): extract_question_paper(), extract_solution(), extract_summary(), health(), HtmlPayload, PaperQuestion, parse_question_paper(), QuestionOption (+12 more)

### Community 3 - "Data Intake & Parsing Modal"
Cohesion: 0.10
Nodes (40): react, App(), CheatSheetView, DashboardView, DataIntakeModal, GlobalSearchModal, ImportInboxView, KeyboardShortcutsModal (+32 more)

### Community 4 - "Planner & Strategy View"
Cohesion: 0.10
Nodes (37): PlannerView(), PlannerInput, PlannerResult, TaskPriority, WhatIfResult, WhatIfSectionInput, AccuracyVsAttemptsPoint, calculateAccuracyVsAttempts() (+29 more)

### Community 5 - "Settings & Exam Profiles"
Cohesion: 0.13
Nodes (28): SettingsView(), SettingsViewProps, clearAllUserData(), DEFAULT_PROFILES, DEFAULT_SETTINGS, applyBackup(), BACKUP_SCHEMA_VERSION, BackupImage (+20 more)

### Community 6 - "Core Runtime Dependencies"
Cohesion: 0.21
Nodes (5): cleanText(), delay(), FullMockScanner, isElementVisible(), parseNumber()

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
Nodes (21): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, lucide-react@^1.16.0, react@^18.3.1, react-dom@^18.3.1 (+13 more)

### Community 11 - "TypeScript Compiler Configuration"
Cohesion: 0.10
Nodes (20): devDependencies, jsdom@^30.1.3, postcss@^8.5.3, tailwindcss@^3.4.17, @testing-library/user-event@^14.6.8, tsx@^4.23.15, @types/jsdom@^30.0.0, @types/node@^22.13.10 (+12 more)

### Community 12 - "Testbook DOM Adapter"
Cohesion: 0.27
Nodes (13): chr(), cleanText(), ExtractedQuestion, ExtractedQuestionOption, ExtractedResultSummary, ExtractedSectionSummary, extractQuestionPaperDOM(), extractVisibleQuestion() (+5 more)

### Community 13 - "ref_fs"
Cohesion: 0.33
Nodes (3): fs, path, puppeteer

### Community 14 - "Mock Data Cleaning Scripts"
Cohesion: 0.19
Nodes (8): activeScanState, captureSelectionFromTab(), deliveredIds, deliverPayload(), findStudyAppTab(), getAppUrl(), isAllowedSourceUrl(), pendingTransfers

### Community 15 - "In-Page Testbook Exporter"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 17 - "Extension Messaging Tests"
Cohesion: 0.29
Nodes (10): inPageTestbookExport(), checkAttemptedByTestbookFunction(), checkCorrectByTestbookFunction(), extractTest(), findMetadata(), findTestScope(), walk(), hasCorrectFlag() (+2 more)

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
Nodes (9): cleanHtmlText(), decodeToken(), defaultHtml, defaultJson, fs, html, parseOliveboardHtml(), path (+1 more)

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
Cohesion: 0.71
Nodes (6): cleanText(), extractVisibleQuestion(), extractVisibleSummary(), inspectPage(), isElementVisible(), parseNumber()

### Community 30 - "Screenshot Compression Component"
Cohesion: 0.40
Nodes (5): puppeteer-core@^25.16.0, puppeteer-core, puppeteer, run(), sleep()

### Community 31 - "Puppeteer Browser Automation"
Cohesion: 0.33
Nodes (5): fs, path, puppeteer, run(), sleep()

### Community 33 - "@testing-library/react"
Cohesion: 0.29
Nodes (6): fake-indexeddb@^6.2.7, @testing-library/jest-dom@^7.0.1, @testing-library/react@^16.3.3, fake-indexeddb, @testing-library/jest-dom, @testing-library/react

### Community 34 - "ScreenshotInput.tsx"
Cohesion: 0.48
Nodes (5): compressImage(), CompressionResult, formatBytes(), ScreenshotInput(), ScreenshotInputProps

### Community 44 - "test_visual_qa.cjs"
Cohesion: 0.40
Nodes (5): fs, path, puppeteer, runVisualQA(), sleep()

## Knowledge Gaps
- **5 isolated node(s):** `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter`, `Spaced Repetition (Daily Quest)`, `Scrapling Python Service`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 202 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `UI Components & Icons` to `Visual End-to-End Tests`, `@testing-library/react`, `ScreenshotInput.tsx`, `App Routing & Views`, `Planner & Strategy View`, `Settings & Exam Profiles`, `macOS Swift Container App`, `TypeScript Compiler Configuration`, `Testbook DOM Adapter`, `Extension Icon Generator`, `Reconciliation E2E Testing`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **What connects `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `UI Components & Icons` be split into smaller, more focused modules?**
  _Cohesion score 0.07601880877742946 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `Screenshot Compression Component` to `macOS Swift Container App`, `test_visual_qa.cjs`, `ref_fs`, `Core Application Architecture`, `Flow Verification Scripts`, `Puppeteer Browser Automation`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `App Routing & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.11265969802555169 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Data Intake & Parsing Modal` to `UI Components & Icons`, `App Routing & Views`, `@testing-library/react`, `ScreenshotInput.tsx`, `Planner & Strategy View`, `Settings & Exam Profiles`, `macOS Swift Container App`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `Scrapling FastAPI Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10606060606060606 - nodes in this community are weakly interconnected._