# Mistake Notebook + Mock Analyzer 2.0
### Personal Command Centre • Local-First Competitive Exam Intelligence

A local-first, zero-backend, privacy-respecting mistake notebook and mock test analytics engine built for competitive exam aspirants (SBI PO, IBPS PO, SSC CGL, Testbook scorecards).

Designed with an anime-inspired dusk-sky aesthetic, cozy study vibes, crisp rectangular manga-panel layouts, and **Kitsu the study-fox mascot**.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Run automated test suites (110 tests across 12 test files)
npm test

# 4. Build for production (optimized code-splitting <500 kB per chunk)
npm run build

# 5. Process files dropped in /my-data folder
npm run import-my-data
```

Open `http://localhost:5173` in any desktop or mobile browser.

---

## 📦 Production Build & Performance Metrics

Through route-level code splitting (`React.lazy` + `Suspense`) and Vite Rollup chunking:
- **Main App Entry Bundle**: **58.62 kB** (gzip: 17.84 kB) — *Reduced by ~95% from initial 1,175 kB*
- **Largest Vendor Chunk**: `vendor-charts` at **434.43 kB** (gzip: 116.55 kB) — *Strictly below the 500 kB ceiling*
- **CSS Bundle**: **53.74 kB** (gzip: 9.83 kB) with print stylesheets and 390px mobile viewport rules
- **Zero build warnings or circular chunk dependencies**

---

## 🚀 Key Modules & Architecture

### 1. Testbook Auto-Export & Safari Web Extension (M2 Apple Silicon)
- **Local-Only Safari Extension**: Reads visible scorecard summary and detailed question solutions only when you click the extension on your own active Testbook tab.
- **Privacy & Security**: Zero credential handling, zero background network calls to outside servers, and no paywall bypasses.
- **Direct Bridge & Offline JSON**: Sends results via `window.postMessage` directly to your local app tab or downloads a versioned `StudyBridgeImportPayload` JSON file.
- **Apple Silicon M2 Build Instructions**:
  ```bash
  # Convert extension for Safari on macOS:
  xcrun safari-web-extension-converter safari-extension/ --project-location safari-extension/build/
  # Open in Xcode, build & run
  # In Safari Settings -> Advanced, check "Show Develop menu in menu bar"
  # In Safari Develop menu, check "Allow Unsigned Extensions"
  # Enable StudyBridge in Safari Settings -> Extensions
  ```
- **Fragile Selector Registry (`testbookAdapter.ts`)**: Tracks DOM selectors (`#summaryModal`, `.tp-ques-number`, `[ng-bind-html*="getQuestionDesc"]`). Throws clear `TestbookMarkupError` rather than silently corrupting data when Testbook updates its markup.

### 2. Import Inbox & Fast Triage Mode
- **Import Inbox Screen**: Staged wrong and unattempted questions from Testbook imports waiting for triage.
- **Duplicate Mock Detection**: Flags previously recorded tests by matching name and date against `db.mocks`.
- **Fast Triage Mode**: Step through questions one-by-one:
  - Keys `1`–`9`: Toggle root-cause error types (Concept gap, Calculation mistake, Formula forgotten, etc.).
  - Text input: Type the critical rule to remember.
  - Key `Enter`: Accept into active Mistake Log and schedule spaced repetition review.
  - Key `S`: Skip question.

### 3. Spaced Repetition (Daily Quest) with 3D Spring Flip
- **Local Calendar Day Math**: SRS intervals (1 → 3 → 7 → 14 → 30 days) computed strictly with device local calendar dates (`YYYY-MM-DD`), preventing DST drift.
- **3D Card Flip**: Framer Motion spring physics (`stiffness: 240, damping: 22`) with `useReducedMotion()` fallback for accessibility.
- **Review Shortcuts**: `Space` / `↓` to reveal answer, `1` for Got It, `2` for Still Wrong.
- **State Preservation**: Editing a mistake preserves consecutive correct recalls, interval, and review schedule unless explicitly reset.

### 4. Visual Analytics & Strategy Planner (Zero Fake Data)
- **Visual Analytics**: Accuracy vs attempts, error-type distribution, topic weakness ranking, marks lost to negative penalties, and time sinks.
- **Improvement Comparison**: Compares average score and accuracy of your latest 3 mocks against the prior 3 mocks.
- **Cutoff Gap & What-If Projection**: Calculates required sectional and overall marks to bridge the gap to your target score.
- **Clean Empty States**: All graphs require real user data and present informative threshold messages (e.g. *"Needs at least 2 mock tests to calculate improvement trend"*).

### 5. Data Integrity & Atomic Backup/Restore (Dexie v4)
- **Full Schema Version 4**: Stores `settings`, `mocks`, `mistakes`, `papers`, `paperAttempts`, `images`, `importBatches`, `tasks`, `profiles`.
- **Atomic Backup**: Exports every table in a single atomic read transaction.
- **Strict Restore Validation**: Empty, corrupt, or invalid files fail immediately before modifying any record. Atomic rollback ensures data is never erased if an error occurs.
- **User Confirmation**: Prompts for confirmation before replacing existing database records.

---

## 🎨 Theme & Accessibility (WCAG AA/AAA)

- **Morning (Light) & Night (Dark) Modes**: High-contrast tokens exceeding WCAG 2.2 AA (4.5:1) and AAA (7:1) ratios.
- **Custom Manga SVG Icon Set**: Crisp 2px outline icons (`MangaIcons.tsx`) matching the ink-line comic book aesthetic.
- **Print Revision Stylesheet**: Dedicated `@media print` CSS formats the Revision Cheat Sheet into clean, ink-friendly black-and-white formula cards with `break-inside: avoid`.
- **390px Mobile Viewport Support**: Responsive cards, flex grids, and 44px touch targets tested on modern smartphones.

---

## 🧪 Automated Test Suites

110 automated unit and integration tests passing:
- `src/utils/contrast.test.ts` (12 tests) - WCAG color contrast ratios
- `src/utils/mockValidation.test.ts` (7 tests) - Mock section validation constraints
- `src/utils/exportImport.test.ts` (11 tests) - Atomic backup, restore rollback, and validation
- `src/utils/analytics.test.ts` (16 tests) - Zero fake data, edge cases, break-even accuracy
- `src/utils/planner.test.ts` (17 tests) - Attempt solvers and target projections
- `src/utils/topicMastery.test.ts` (5 tests) - 5-state mastery matrix evidence
- `src/utils/dataIntake.test.ts` (15 tests) - Paste parser and CSV import
- `src/utils/testbookAdapter.test.ts` (5 tests) - Full DOM regression against Testbook markup
- `src/utils/studyBridgeExtension.test.ts` (11 tests) - Extension messaging contracts
- `src/utils/studyBridgeAppIntegration.test.ts` (5 tests) - App import listener and acknowledgements
- `src/components/ScreenshotInput.test.tsx` (4 tests) - Canvas compression and drag-drop
- `src/components/ImportInboxView.test.tsx` (2 tests) - Triage and duplicate mock warning
