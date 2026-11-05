# Graph Report - proj  (2026-11-05)

## Corpus Check
- 92 files · ~92,763 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .css 2, .plist 2)

## Summary
- 657 nodes · 1532 edges · 39 communities (30 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f14373b9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/db.ts
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
- Testbook DOM Adapter
- ref_path
- Mock Data Cleaning Scripts
- In-Page Testbook Exporter
- vitest
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
- ScreenshotInput.tsx
- React DOM Types
- Safari Extension Build Script
- Scripts Package Metadata

## God Nodes (most connected - your core abstractions)
1. `ExamSettings` - 34 edges
2. `MistakeEntry` - 34 edges
3. `react` - 28 edges
4. `MockTest` - 27 edges
5. `getTodayDateStr()` - 27 edges
6. `App()` - 23 edges
7. `Mascot()` - 23 edges
8. `PaperTest` - 21 edges
9. `vitest` - 21 edges
10. `DataIntakeModal()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Oliveboard Mock Test Exporter` --exports_compatible_json_for--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  docs/scraper_guide.md → README.md
- `StudyBridge Safari Extension` --delivers_data_to--> `Mistake Notebook & Mock Analyzer`  [EXTRACTED]
  safari-extension/README.md → README.md
- `MockCsvParseResult` --references--> `MockTest`  [EXTRACTED]
  src/utils/dataIntake.ts → src/types/index.ts
- `MistakeCsvParseResult` --references--> `MistakeEntry`  [EXTRACTED]
  src/utils/dataIntake.ts → src/types/index.ts
- `KeyboardShortcutsModal()` --calls--> `Mascot()`  [EXTRACTED]
  src/components/KeyboardShortcutsModal.tsx → src/components/Mascot.tsx

## Import Cycles
- None detected.

## Communities (39 total, 9 thin omitted)

### Community 0 - "db/db.ts"
Cohesion: 0.07
Nodes (62): dexie, lucide-react, @testing-library/react, CheatSheetViewProps, DashboardViewProps, GlobalSearchModalProps, SearchResultItem, MistakesView() (+54 more)

### Community 1 - "App Routing & Views"
Cohesion: 0.07
Nodes (57): CheatSheetView(), DataIntakeModal(), DataIntakeModalProps, TabType, ERROR_TYPE_SHORTCUTS, ImportInboxView(), ImportInboxViewProps, isOptionCorrect() (+49 more)

### Community 2 - "Scrapling FastAPI Service"
Cohesion: 0.11
Nodes (20): extract_question_paper(), extract_solution(), extract_summary(), health(), HtmlPayload, PaperQuestion, parse_question_paper(), QuestionOption (+12 more)

### Community 3 - "Data Intake & Parsing Modal"
Cohesion: 0.09
Nodes (43): react, App(), CheatSheetView, DashboardView, DataIntakeModal, GlobalSearchModal, ImportInboxView, KeyboardShortcutsModal (+35 more)

### Community 4 - "Planner & Strategy View"
Cohesion: 0.08
Nodes (46): DashboardView(), PlannerView(), PlannerInput, PlannerResult, ReviewLog, SectionConfig, StudyBridgeAckMessage, StudyBridgeImportMessage (+38 more)

### Community 5 - "test_visual_qa.cjs"
Cohesion: 0.33
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
Nodes (16): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, lucide-react@^1.16.0, react@^18.3.1, react-dom@^18.3.1 (+8 more)

### Community 11 - "package.json"
Cohesion: 0.10
Nodes (28): devDependencies, autoprefixer@^10.4.20, jsdom@^30.1.3, postcss@^8.5.3, tailwindcss@^3.4.17, @testing-library/react@^16.3.3, @testing-library/user-event@^14.6.8, tsx@^4.23.15 (+20 more)

### Community 12 - "Testbook DOM Adapter"
Cohesion: 0.15
Nodes (20): NormalizedOptionItem, normalizeOptionObjects(), normalizeOptions(), cleanOptionText(), planMistakeRepairs(), RepairPlan, RepairPreview, chr() (+12 more)

### Community 13 - "ref_path"
Cohesion: 0.33
Nodes (3): fs, path, puppeteer

### Community 14 - "Mock Data Cleaning Scripts"
Cohesion: 0.19
Nodes (8): activeScanState, captureSelectionFromTab(), deliveredIds, deliverPayload(), findStudyAppTab(), getAppUrl(), isAllowedSourceUrl(), pendingTransfers

### Community 15 - "In-Page Testbook Exporter"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 16 - "vitest"
Cohesion: 0.22
Nodes (8): fake-indexeddb@^6.2.7, @testing-library/jest-dom@^7.0.1, vitest@^3.0.8, fake-indexeddb, @testing-library/jest-dom, vitest, getContrastRatio(), getRelativeLuminance()

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

### Community 31 - "Puppeteer Browser Automation"
Cohesion: 0.40
Nodes (5): fs, path, puppeteer, run(), sleep()

### Community 32 - "ScreenshotInput.tsx"
Cohesion: 0.48
Nodes (5): compressImage(), CompressionResult, formatBytes(), ScreenshotInput(), ScreenshotInputProps

## Knowledge Gaps
- **5 isolated node(s):** `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter`, `Spaced Repetition (Daily Quest)`, `Scrapling Python Service`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 206 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `db/db.ts`, `App Routing & Views`, `ScreenshotInput.tsx`, `Planner & Strategy View`, `package.json`, `Testbook DOM Adapter`, `Extension Icon Generator`, `Reconciliation E2E Testing`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `Cocoa`, `os.log`, `Oliveboard Mock Test Exporter` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `db/db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07310126582278481 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `Flow Verification Scripts` to `test_visual_qa.cjs`, `package.json`, `ref_path`, `Core Application Architecture`, `Puppeteer Browser Automation`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `App Routing & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.07246376811594203 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Data Intake & Parsing Modal` to `db/db.ts`, `App Routing & Views`, `ScreenshotInput.tsx`, `Planner & Strategy View`, `macOS Swift Container App`, `package.json`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `Scrapling FastAPI Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10531400966183575 - nodes in this community are weakly interconnected._