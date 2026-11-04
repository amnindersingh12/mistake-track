# StudyBridge Safari Web Extension (V4)

StudyBridge connects your local exam preparation study application with Testbook mock test analysis and question review pages in Apple Safari.

Version 4 introduces the **One-Click Full Mock Scanner** powered by a dedicated local **Scrapling Python Service** (`scrapling-service/`) for high-fidelity extraction of complete 130+ question papers and rendered solutions.

---

## 1. Architecture & The Four Import Modes

```
Testbook Tab (Completed Mock Analysis / Review in Safari)
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

## 2. Apple Silicon (M2 / M-Series Mac) & Intel Mac Setup Instructions

Safari on macOS packages WebExtensions inside native App Extension bundles (`.appex`) wrapped by a host macOS Container Application (`.app`). Follow these steps to build and run on your Mac:

### Prerequisites:
- macOS 13.0 (Ventura) or later (macOS Sonoma / Sequoia supported)
- Safari 16+ or Safari 17+ / 18+ (Manifest V3 support)
- Xcode Command Line Tools (`clang`, `swiftc`, `codesign`) or full Xcode IDE
- Node.js 18+ for running the study application
- Python 3.9+ for the Scrapling service

---

### Step 1: Converting `safari-extension/` to `.appex` (Xcode Web Extension Converter)

Apple provides `xcrun safari-web-extension-converter` to convert WebExtension assets into a native Xcode project:

```bash
xcrun safari-web-extension-converter safari-extension/ \
  --project-location safari-extension/xcode/ \
  --swift \
  --app-name StudyBridge
```

> **Note:** The generated Xcode project is already pre-configured and checked into the repository at `safari-extension/xcode/StudyBridge.xcodeproj`.

#### Project Structure:
- `safari-extension/xcode/Shared (App)/`: Native container app sources (`AppDelegate.swift`, `Info.plist`)
- `safari-extension/xcode/Shared (Extension)/`: Native extension handler (`SafariWebExtensionHandler.swift`, `Info.plist`)
- `safari-extension/manifest.json`, `popup/`, `background/`, `content/`: WebExtension assets copied into the `.appex` bundle `Resources/` directory.

---

### Step 2: Building the Extension

You can build the extension using either the automated CLI script or the Xcode GUI.

#### Option A: Automated CLI Build Script (Recommended)
Compile and ad-hoc sign both the Container App and the `.appex` PlugIn directly from the terminal without opening Xcode:

```bash
./scripts/build_safari_extension.sh
```

This compiles:
- `safari-extension/build/StudyBridge.app`
- `safari-extension/build/StudyBridge.app/Contents/PlugIns/StudyBridge Extension.appex`

#### Option B: Xcode GUI Build
1. Open the project in Xcode:
   ```bash
   open safari-extension/xcode/StudyBridge.xcodeproj
   ```
2. Select the `StudyBridge` scheme (Destination: **My Mac**).
3. In **Signing & Capabilities** for both `StudyBridge` and `StudyBridge Extension`:
   - Select your Development Team (or check **Sign to Run Locally**).
4. Press **Cmd+B** to build or **Cmd+R** to run the container application.

---

### Step 3: Enabling StudyBridge in Safari

1. Launch **Safari**.
2. Open **Safari Settings** (`Cmd+,`) → **Advanced** tab:
   - Check **Show features for web developers** (or **Show Develop menu in menu bar** on older Safari).
3. In the Safari menu bar, click **Develop** → check **Allow Unsigned Extensions** (authenticate with your macOS password).
4. Launch the built container app once to register the extension with macOS LaunchServices:
   ```bash
   open safari-extension/build/StudyBridge.app
   ```
5. In **Safari Settings** → **Extensions** tab:
   - Find **StudyBridge Extension**.
   - Check the box to enable it.
   - Set website permissions: Set to **Always Allow on Every Website** (or allow on `testbook.com` and `127.0.0.1` / `localhost`).
6. You will see the **StudyBridge icon** appear in the Safari toolbar!

---

## 3. Local Scrapling Python Service

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

## 4. Testbook Web Updates & DOM Maintenance

Testbook periodically updates its front-end markup and class names. To protect against silent data corruption, StudyBridge implements a **Fragile Selector Registry** and throws explicit `TestbookMarkupError`s.

### If Testbook Redesigns Modal Class Names:
If Testbook changes modal identifiers (e.g., replaces `#summaryModal` or `.modal_app-content` with a new dialog component):
1. The adapter detects that a modal or dialog is present but does not match known selectors.
2. It throws a `TestbookMarkupError` indicating the exact selector name to update:
   ```
   [Testbook Markup Changed] Testbook summary modal detected but class names have been redesigned. (Selector: "#summaryModal, .modal_app-content"). Update "summaryModal" in src/utils/testbookAdapter.ts.
   ```
3. Open `src/utils/testbookAdapter.ts` and update `TESTBOOK_SELECTORS`:
   ```typescript
   export const TESTBOOK_SELECTORS = {
     summaryModal: '#summaryModal, .modal_app-content, .new-testbook-modal-class',
     summaryTable: '#summaryModal table, .table-responsive table, table.table-bordered',
     // ...
   };
   ```
4. Re-run tests to verify the updated selector:
   ```bash
   npx vitest run src/utils/testbookAdapter.test.ts
   ```

---

## 5. Primary Workflow (One-Click Full Mock)

1. Start the Scrapling service:
   ```bash
   ./scripts/start_scrapling_service.sh &
   ```
2. Start the Study Application:
   ```bash
   npm run dev
   ```
   (Opens `http://127.0.0.1:5173/`)
3. Open your completed Testbook mock test analysis in Safari.
4. Click the **StudyBridge** toolbar icon.
5. Click **⚡ Scan Entire Mock**.
6. The extension scans all questions and solutions with real-time progress.
7. Upon scan completion, the Study Application automatically opens the **Full Mock Scan Preview**.
8. Review the summary metrics, browse the question library, toggle mistakes, and select mistake reasons from the 7 classification chips.
9. Click **Confirm & Save Mock** to commit to your database!

---

## 6. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Study App not running"** | Dev server is not running on port 5173. | Run `npm run dev` in project root. Extension will auto-open the tab. |
| **"Summary modal is closed"** | Testbook summary dialog is not open. | Open the Summary modal on Testbook before clicking Import Result Summary. |
| **"Testbook Markup Changed"** | Testbook altered its DOM class names. | Read the error message, find the selector name, and update `TESTBOOK_SELECTORS` in `src/utils/testbookAdapter.ts`. |
| **Extension not in Safari Extensions** | Unsigned extensions not enabled. | Check Safari > Develop > Allow Unsigned Extensions. |
| **Changes not reflected** | Extension cached in Safari. | In Safari Settings > Extensions, toggle StudyBridge off and back on. |

---

## 7. Automated Tests

```bash
# Study App Vitest suite (72 tests)
npm test

# Scrapling Python Service regression tests (7 tests on sampletestbook.html)
cd scrapling-service && ./venv/bin/pytest tests/test_parsers.py -v

# Puppeteer End-to-End verification (All 4 Modes + Dexie IndexedDB + Screenshots)
node scripts/test_studybridge_e2e.cjs
```
