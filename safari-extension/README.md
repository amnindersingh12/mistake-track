# StudyBridge V4 — Safari Web Extension for Testbook Import

StudyBridge connects your local exam preparation study application with Testbook mock test analysis and question review pages in Apple Safari.

Version 4 introduces the **One-Click Full Mock Scanner** powered by a dedicated local **Scrapling Python Service** (`scrapling-service/`) for high-fidelity extraction of complete 130+ question papers and rendered solutions.

---

## 1. Architecture & The Four Import Modes

```
Testbook Tab (Completed Mock Analysis / Review)
    ↓ One-Click Action in StudyBridge Extension ("Scan Entire Mock")
Full Mock Scanner Content Script (Traverses Question Paper / Palette & Solutions)
    ↓ HTML Snapshots
Local Scrapling Service (http://127.0.0.1:8787 via Scrapling Adaptor & CSS Selectors)
    ↓ Structured JSON
Safari Extension Background (Assembles unified FullMockScanResult payload)
    ↓ Content Script Bridge
Study App Data Intake Hub (Opens Full Mock Scan Preview)
    ↓
Question Library Browser & Bulk Mistake Tagger (with 7 Mistake Classifications)
    ↓
Manual User Confirmation Mandatory (Single ACID Transaction in Dexie IndexedDB)
```

### The Four Import Modes:

1. **Mode D: Scan Entire Mock** (`⚡ Scan Entire Mock` - **NEW in V4**)
   - Single-click automated extraction of an entire completed mock test.
   - Captures overall score, max marks, section metrics, and all 130+ questions.
   - Activates Testbook's Question Paper view or traverses the question review palette to trigger and capture rendered solutions.
   - Provides live progress UI in popup: Question counter (`Q 42 / 130`), Section badge, visual progress bar, Pause/Resume, and Cancel buttons.
   - State-preserving: records user's active question and scroll position before scanning and restores them upon completion or cancellation.

2. **Mode A: Import Result Summary** (`📊 Import Result Summary`)
   - Reads visible Testbook summary tables using semantic attributes (`data-prompt="Section|No. of questions|Correct|Incorrect|Skipped|Marks"`).
   - Extracts overall marks, section names, question count, correct, incorrect, skipped, marks, and derived total questions & accuracy.

3. **Mode B: Import Current Question** (`❓ Import Current Question`)
   - Captures the question currently displayed in the Testbook review interface.
   - Extracts question number, section, question text, options, selected answer, correct answer, marks, and visible explanation.

4. **Mode C: Import Selected Text** (`📝 Send Selected Text`)
   - Fallback mode: captures only explicitly highlighted user text.
   - Supported via popup button and right-click context menu.

### Visibility, Safety & Privacy Principles:
- **No full page scraping:** Inspects only visible DOM elements (`isElementVisible`). Checks computed display, visibility, opacity, dimensions, `aria-hidden`, and Angular `ng-hide`.
- **No credentials or cookies:** Does not inspect network calls, cookies, local storage, or auth tokens.
- **Zero cloud telemetry:** Runs 100% locally on your machine.
- **Never auto-saves:** Every import requires explicit user review and confirmation before writing to Dexie database.
- **Safe state restoration:** Preserves and restores the user's active Testbook question and scroll position. Never submits or modifies test answers.

---

## 2. Local Scrapling Python Service

StudyBridge V4 uses the official [Scrapling](https://github.com/D4Vinci/Scrapling) library for deterministic DOM parsing:

```bash
# Start the Scrapling parsing service on port 8787:
./scripts/start_scrapling_service.sh
```

Service endpoints:
- `GET http://127.0.0.1:8787/health`: Service status and Scrapling version
- `POST http://127.0.0.1:8787/parse/summary`: Parses Testbook result summary table
- `POST http://127.0.0.1:8787/parse/question-paper`: Parses `#questionPaper` bulk view (all 130 questions & options)
- `POST http://127.0.0.1:8787/parse/solution`: Parses single question review and explanation

Run Scrapling unit & regression tests:
```bash
cd scrapling-service && ./venv/bin/pytest tests/test_parsers.py -v
```

---

## 3. Prerequisites

- macOS 13.0 or later
- Safari 16+ or Safari 27+ (Manifest V3 support)
- Xcode Command Line Tools (`clang`, `swiftc`, `codesign`) or full Xcode IDE
- Node.js 18+ for running the study application
- Python 3.9+ for the Scrapling service

---

## 4. Build & Packaging Instructions

### Option A: Automated Build Script (Command Line)
To build and ad-hoc sign the native macOS container app and extension plug-in:

```bash
./scripts/build_safari_extension.sh
```

This compiles:
- `safari-extension/build/StudyBridge.app`
- `safari-extension/build/StudyBridge.app/Contents/PlugIns/StudyBridge Extension.appex`

### Option B: Xcode Packaging
If you have Xcode installed:
1. Open `safari-extension/xcode/StudyBridge.xcodeproj` in Xcode.
2. Select the `StudyBridge` scheme (My Mac).
3. In Signing & Capabilities, select your Development Team.
4. Press **Cmd+B** to build or **Cmd+R** to run.

---

## 5. Enabling StudyBridge in Safari

1. Launch **Safari**.
2. Open **Safari Settings** (`Cmd+,`) → **Advanced** tab:
   - Check **Show features for web developers** (or "Show Develop menu in menu bar").
3. In the Safari menu bar, click **Develop** → check **Allow Unsigned Extensions** (authenticate with your Mac user password).
4. Launch the built app once:
   ```bash
   open safari-extension/build/StudyBridge.app
   ```
5. In **Safari Settings** → **Extensions** tab:
   - Find **StudyBridge Extension**.
   - Check the box to enable it.
   - Set permissions: Allow on `testbook.com` and `127.0.0.1` / `localhost`.
6. You will see the **StudyBridge icon** appear in the Safari toolbar!

---

## 6. Primary Workflow (One-Click Full Mock)

1. Start the Scrapling service: `./scripts/start_scrapling_service.sh`
2. Start the Study Application: `npm run dev` (opens `http://127.0.0.1:5173/`)
3. Open your completed Testbook mock test analysis in Safari.
4. Click the **StudyBridge** toolbar icon.
5. Click **⚡ Scan Entire Mock**.
6. The extension scans all questions and solutions with live progress.
7. Upon scan completion, the Study Application automatically opens the **Full Mock Scan Preview**.
8. Review the summary metrics, browse the question library, toggle mistakes, and select mistake reasons from the 7 classification chips.
9. Click **Confirm & Save Mock** to commit to your database!

---

## 7. Automated Tests

```bash
# Study App Vitest suite (70 tests)
npm test

# Scrapling Python Service regression tests (7 tests on sampletestbook.html)
cd scrapling-service && ./venv/bin/pytest tests/test_parsers.py -v

# Puppeteer End-to-End verification (All 4 Modes + Dexie IndexedDB + Screenshots)
node scripts/test_studybridge_e2e.cjs
```
   - Find **StudyBridge Extension**.
   - Check the box to enable it.
   - Set permissions: Allow on `testbook.com` and `127.0.0.1` / `localhost`.
6. You will see the **StudyBridge icon** appear in the Safari toolbar!

---

## 5. Primary Workflow

### A. Toolbar Action
1. Open Testbook in Safari and open any completed mock test scorecard or solution analysis.
2. Highlight the score summary or question you want to import.
3. Click the **StudyBridge** toolbar icon.
4. The popup displays:
   - Connection indicator (Study App active).
   - Source indicator (Testbook detected).
   - Selected character count.
5. Click **Send Selected Text**.
6. The Study Application automatically brings up the **Data Intake Hub** with the parsed results!
7. Review the extracted fields, edit any unverified items, and click **Confirm & Save to Mock Log** (or **Confirm & Save to Mistake Log**).

### B. Context Menu
- Highlight text on Testbook → Right-click → **Send selected text to Study App**.

---

## 6. Configuration & Settings

In the StudyBridge popup:
- Click **⚙️ Configuration** to view or change the Study Application URL.
- Default: `http://127.0.0.1:5173`.
- Supports any local development origin (e.g. `http://localhost:5173` or custom port).

---

## 7. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Study App not running"** | Dev server is not running on port 5173. | Run `npm run dev` in project root. Extension will auto-open the tab. |
| **"No selection detected"** | No text is highlighted on page. | Highlight text on Testbook before clicking icon. |
| **"Unsupported website"** | Tab URL does not match Testbook. | Navigate to `testbook.com` test result page. |
| **Extension not in Safari Extensions** | Unsigned extensions not enabled. | Check Safari > Develop > Allow Unsigned Extensions. |
| **Changes not reflected** | Extension cached in Safari. | In Safari Settings > Extensions, toggle StudyBridge off and back on. |

---

## 8. Automated Tests

Run the complete test suite:
```bash
# Unit & integration tests
npm test

# End-to-end browser verification
node scripts/test_studybridge_e2e.cjs
```

