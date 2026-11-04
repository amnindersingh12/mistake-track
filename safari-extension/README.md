# StudyBridge V2 — Safari Web Extension for Testbook Import

StudyBridge connects your local exam preparation study application with Testbook mock test analysis and question review pages in Apple Safari.

Version 2 introduces three explicit user-controlled import modes with strict DOM visibility checks, structured scorecard extraction, and question mistake classification without automatic scraping or background crawling.

---

## 1. Architecture & The Three Import Modes

```
Testbook Tab (Active Analysis / Question Review / Highlighted Selection)
    ↓ Explicit User Action in StudyBridge Safari Extension Popup
Safari Extension Background (Validates origin & selection size, 120s TTL queue)
    ↓ WebExtension Tab Messaging
Study App Content Script Bridge (Relays payload to localhost / 127.0.0.1)
    ↓ window.postMessage
Study App Data Intake Hub (Validates schema, populates Review Preview)
    ↓
Editable Preview (Scorecard Breakdown / Question Mistake Card with 7 Classifications)
    ↓
Manual User Confirmation Mandatory (Saves to IndexedDB via Dexie)
```

### The Three Explicit Import Modes:

1. **Mode A: Import Result Summary** (`📊 Import Result Summary`)
   - Reads visible Testbook summary tables using semantic attributes (`data-prompt="Section|No. of questions|Correct|Incorrect|Skipped|Marks"`).
   - Extracts overall marks, section names, question count, correct, incorrect, skipped, marks, and derived total questions & accuracy.
   - Strictly refuses closed modals (`aria-hidden="true"` / `display:none`) and asks the user to open the Summary modal first.

2. **Mode B: Import Current Question** (`❓ Import Current Question`)
   - Captures the question currently displayed in the Testbook review interface.
   - Extracts question number, section, question text, options, selected answer, correct answer, marks, and visible explanation.
   - Never guesses answers or reads hidden solution panels (`ng-hide`).
   - In the study app preview, provides 1-click **"Save as Mistake"** with the 7 required classifications:
     - Conceptual gap
     - Calculation error
     - Misreading
     - Silly mistake
     - Time pressure
     - Guessing
     - Forgot formula or fact
     plus revision notes.

3. **Mode C: Import Selected Text** (`📝 Send Selected Text`)
   - Fallback mode: captures only explicitly highlighted user text.
   - Supported via popup button and right-click context menu.

### Visibility & Privacy Principles:
- **No full page scraping:** Inspects only visible DOM elements (`isElementVisible`). Checks computed display, visibility, opacity, dimensions, `aria-hidden`, and Angular `ng-hide`.
- **No background crawling:** Never navigates between questions automatically.
- **No credentials or cookies:** Does not inspect network calls, cookies, local storage, or auth tokens.
- **Zero cloud telemetry:** Runs 100% locally on your machine.
- **Never auto-saves:** Every import requires explicit user review and confirmation before writing to Dexie database.

---

## 2. Prerequisites

- macOS 13.0 or later
- Safari 16+ or Safari 27+ (Manifest V3 support)
- Xcode Command Line Tools (`clang`, `swiftc`, `codesign`) or full Xcode IDE
- Node.js 18+ for running the study application

---

## 3. Build & Packaging Instructions

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
3. In Signing & Capabilities, select your Development Team (or use Personal Team / Sign to Run Locally).
4. Press **Cmd+B** to build or **Cmd+R** to run the container application.

---

## 4. Enabling StudyBridge in Safari

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

