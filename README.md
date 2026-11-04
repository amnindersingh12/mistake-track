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

# 3. Run automated tests (WCAG contrast, planner math, topic mastery)
npm test

# 4. Build for production
npm run build

# 5. Process files dropped in /my-data folder
npm run import-my-data
```

Open `http://localhost:5173` in any desktop or mobile browser.

---

## 🚀 What's New in Study App 2.0

### 1. English-Only Interface (Zero Japanese Text)
- Clean, natural English navigation, headers, tooltips, and badges across all screens.
- Replaced all legacy Japanese subtitles (`ダッシュボード`, `間違いノート`, `朝/夜`) with standard terms: *Performance Log*, *Error Intelligence*, *Spaced Repetition*, *Morning / Night*.

### 2. WCAG AA Semantic Design Token System
- Mathematically verified contrast ratios exceeding **4.5:1** (AA) for normal text and **7:1** (AAA) for primary text in both Night and Morning modes.
- Modern interface typography: **Space Grotesk** (display headers & stats), **Plus Jakarta Sans** (interface body), and **JetBrains Mono** (scores & formulas).
- Preserves the anime-inspired dusk sky (`LivingSky.tsx`), halftone screentones, and manga-panel border styling without sacrificing legibility.
- Automated contrast test suite in `src/utils/contrast.test.ts`.

### 3. Global Quick Search (`Cmd + K` / `Ctrl + K`)
- Instant keyboard search across your actual mocks, question error logs, papers, study tasks, and taxonomy topics.
- Keyboard navigation with Arrow keys, Enter to navigate, and Escape to close.

### 4. Dexie Database Version 3 (Tasks & Exam Profiles)
- Upgrades Dexie schema to Version 3 while strictly preserving all existing user records.
- **Study Tasks store (`tasks`)**: Scheduled task management with priorities (`High`, `Medium`, `Low`), planned durations, due dates, and completion status.
- **Exam Profiles store (`profiles`)**: Switchable configuration presets for **SBI PO Prelims**, **IBPS PO Prelims**, and **SSC CGL Tier 1** in Settings without mixing or losing mock/mistake data.

### 5. Evidence-Based Topic Mastery Matrix
Calculates mastery strictly from recorded mocks, paper questions, and mistake recall history:
- **Not studied**: Zero recorded attempts or mistakes.
- **Learning**: 1–5 attempts with initial performance data.
- **Weak**: ≥2 active unresolved mistakes or <50% accuracy on ≥3 attempts.
- **Improving**: Resolved earlier errors via spaced repetition with ≥70% recent recall.
- **Strong**: ≥6 questions attempted with ≥80% accuracy and zero active errors.
- Includes transparent "Inspect Why" reasoning and 1-click study task generation.

---

## 🚫 Zero Fake Data Baseline

The app starts **100% empty**. All dummy seed mocks, placeholder names, and lorem ipsum have been completely removed:
- Every chart, table, and planner view features a designed mascot empty state guiding you on what real data to enter first.
- No previous-year questions or solutions are invented. Everything displayed comes from your own tests and imports.

---

## 📥 Real Data Intake Workflows

1. **Testbook Scorecard Paste Import:**
   - Copy analysis text from Testbook (`Cmd+A` -> `Cmd+C`), paste into the Intake box, review the auto-parsed table, and save in one click.
2. **CSV / JSON File Import:**
   - Download pre-formatted CSV/JSON templates for mocks and mistakes, fill in your data, preview validation, and import.
3. **Screenshot Attachments:**
   - Paste question screenshots directly (`Cmd+V`) into mistake logs; compressed and stored locally in browser IndexedDB.
4. **Previous Year Papers (PYQ) & Timed Mode:**
   - Store PYQ or memory-based exam papers, take timed practice tests with sectional timers, question palette, and auto-scoring.
5. **Drop Folder (`/my-data`):**
   - Place PDFs, screenshots, or CSVs into `/my-data` and run `npm run import-my-data` to ingest into the database.

---

## 🧪 Test Suite

Run all tests via Vitest:
```bash
npm test
```

- `src/utils/contrast.test.ts`: Automated WCAG 2.2 AA and AAA contrast calculations for Night and Morning palettes.
- `src/utils/planner.test.ts`: Mathematical validation of attempt solvers, break-even accuracy, what-if projections, and time plans.
- `src/utils/topicMastery.test.ts`: Evidence-based classification verification for all 5 topic mastery statuses.
