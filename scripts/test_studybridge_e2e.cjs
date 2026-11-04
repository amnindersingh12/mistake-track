const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5173;
const APP_URL = `http://127.0.0.1:${PORT}/`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runStudyBridgeE2E() {
  console.log('🚀 Starting StudyBridge V2 End-to-End Verification Test...');

  // Ensure screenshots directory exists
  const ssDir = path.resolve(__dirname, '../screenshots');
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });

  // 1. Start Vite Server
  console.log('Step 1: Starting local Vite development server...');
  const viteProcess = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe'
  });

  viteProcess.stderr.on('data', (d) => {
    // console.error(`[vite error]: ${d}`);
  });

  // Wait for server to become responsive
  let serverReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch (e) {
      await sleep(300);
    }
  }

  if (!serverReady) {
    viteProcess.kill();
    throw new Error('Vite dev server failed to start on port ' + PORT);
  }
  console.log('✓ Vite server is running at ' + APP_URL);

  let browser;
  try {
    // 2. Launch Browser
    console.log('Step 2: Launching headless browser...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn('  [Browser Error]:', msg.text());
      }
    });

    // 3. Open Study Application
    console.log('Step 3: Navigating to Study Application...');
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('header', { timeout: 8000 });
    console.log('✓ Study Application loaded successfully.');

    // Inject StudyBridge Content Bridge script into page
    const bridgeScriptPath = path.resolve(__dirname, '../safari-extension/content/study-app-bridge.js');
    const bridgeScript = fs.readFileSync(bridgeScriptPath, 'utf8');
    await page.evaluate(bridgeScript);
    console.log('✓ StudyBridge Content Script Bridge injected.');

    // 4. Test Case 1: Mode A - Import Result Summary (Structured)
    console.log('Step 4: Testing Mode A: Result Summary Transfer...');
    const summaryPayload = {
      id: `sb-sum-${Date.now()}`,
      mode: 'summary',
      text: 'Testbook Result Summary\nMock: Testbook SBI PO Live Mock 01\nTotal Marks: 85.93',
      summaryData: {
        overallMarks: 85.93,
        mockName: 'SBI PO Prelims Live Mock 01',
        sections: [
          {
            sectionName: 'Paper 1',
            questionCount: 80,
            correctCount: 27,
            incorrectCount: 9,
            skippedCount: 44,
            marks: 30.93
          },
          {
            sectionName: 'Paper 2',
            questionCount: 50,
            correctCount: 30,
            incorrectCount: 10,
            skippedCount: 10,
            marks: 55.00
          }
        ],
        derivedTotals: {
          totalQuestions: 130,
          totalCorrect: 57,
          totalIncorrect: 19,
          totalSkipped: 54,
          totalAttempted: 76,
          totalMarks: 85.93,
          accuracy: 75.0
        },
        missingFields: []
      },
      source: {
        platform: 'Testbook',
        url: 'https://testbook.com/analysis/sbi-po-01',
        title: 'SBI PO Prelims Live Mock 01 - Testbook'
      },
      capturedAt: new Date().toISOString()
    };

    // Dispatch the StudyBridge import message
    const ackReceived = await page.evaluate((payload) => {
      return new Promise((resolve) => {
        const handler = (evt) => {
          if (evt.data && evt.data.type === 'STUDYBRIDGE_IMPORT_ACK') {
            window.removeEventListener('message', handler);
            resolve(evt.data);
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({
          schemaVersion: 1,
          type: 'STUDYBRIDGE_IMPORT',
          source: 'STUDYBRIDGE_EXTENSION',
          payload
        }, '*');
      });
    }, summaryPayload);

    expectValue(ackReceived.status, 'received', 'Immediate ACK received from Study App');
    console.log('✓ ACK verified:', ackReceived);

    // Wait for Data Intake Modal to open with parsed data
    await page.waitForSelector('text/StudyBridge Transfer Received', { timeout: 5000 });
    console.log('✓ Data Intake Hub opened automatically with StudyBridge badge.');

    await page.waitForSelector('text/Confirm & Save to Mock Log', { timeout: 5000 });
    await page.screenshot({ path: path.join(ssDir, '01_studybridge_modeA_summary_modal.png') });
    console.log('✓ Captured 01_studybridge_modeA_summary_modal.png');

    // Confirm saving the mock
    const confirmMockBtn = await page.$('button ::-p-text(Confirm & Save to Mock Log)');
    if (!confirmMockBtn) throw new Error('Confirm & Save button not found');
    await confirmMockBtn.click();
    await sleep(800);
    console.log('✓ Confirmed saving mock to Dexie database.');

    // 5. Test Case 2: Mode B - Import Current Question (with 7 Reason Classifications)
    console.log('Step 5: Testing Mode B: Question Mistake Review Transfer...');
    const questionPayload = {
      id: `sb-q-${Date.now()}`,
      mode: 'question',
      text: 'Question 1: Geographical Indication tags...',
      questionData: {
        questionNumber: 1,
        section: 'Paper 1',
        questionText: 'Which products from Tamil Nadu received Geographical Indication (GI) tags in April 2025?',
        options: [
          { index: 0, text: 'Rameswaram Fish, Thanjavur Rice', isCorrect: false },
          { index: 1, text: 'Puliyankudi Acid Lime, Panruti Cashew, Samba Vathal', isCorrect: true, isSelected: false }
        ],
        selectedAnswer: 'Left unattempted',
        correctAnswer: 'Puliyankudi Acid Lime, Panruti Cashew, Samba Vathal',
        marks: 0,
        explanation: 'The correct answer is Puliyankudi Acid Lime, Panruti Cashew, and Samba Vathal. Key Points: Granted by DPIIT.',
        statusBadge: 'Skipped',
        timeTaken: '00:45',
        avgTime: '01:10',
        missingFields: []
      },
      source: {
        platform: 'Testbook',
        url: 'https://testbook.com/test-series/solutions/q1',
        title: 'Question 1 Review'
      },
      capturedAt: new Date().toISOString()
    };

    await page.evaluate((payload) => {
      window.postMessage({
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        source: 'STUDYBRIDGE_EXTENSION',
        payload
      }, '*');
    }, questionPayload);

    await page.waitForSelector('text/Parsed Mistake Question', { timeout: 5000 });
    console.log('✓ Question populated in Mistake Review with options and solution!');

    // Check classification chip "Conceptual gap"
    await page.waitForSelector('button ::-p-text(Conceptual gap)', { timeout: 5000 });
    const conceptGapBtn = await page.$('button ::-p-text(Conceptual gap)');
    if (conceptGapBtn) await conceptGapBtn.click();
    console.log('✓ Selected "Conceptual gap" classification.');

    await page.waitForSelector('button ::-p-text(Save as Mistake)', { timeout: 5000 });
    await page.screenshot({ path: path.join(ssDir, '02_studybridge_modeB_question_modal.png') });
    console.log('✓ Captured 02_studybridge_modeB_question_modal.png');

    // Confirm saving the mistake
    const saveMistakeBtn = await page.$('button ::-p-text(Save as Mistake)');
    if (!saveMistakeBtn) throw new Error('Save as Mistake button not found');
    await saveMistakeBtn.click();
    await sleep(800);
    console.log('✓ Confirmed saving mistake to Dexie database.');

    await sleep(600);

    // 6. Test Case 3: Mode C - Selection Fallback
    console.log('Step 6: Testing Mode C: Selected Text Fallback...');
    const selectionPayload = {
      id: `sb-sel-${Date.now()}`,
      mode: 'selection',
      text: `Question 5
Reasoning Ability
Topic: Syllogism
Statement: All roses are flowers.
Your Answer: Option B (Incorrect)
Correct Answer: Option A
Explanation: Affirmative conversion applies.`,
      source: {
        platform: 'Testbook',
        url: 'https://testbook.com/test-series/solutions/q5',
        title: 'Reasoning Q5'
      },
      capturedAt: new Date().toISOString()
    };

    await page.evaluate((payload) => {
      window.postMessage({
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        source: 'STUDYBRIDGE_EXTENSION',
        payload
      }, '*');
    }, selectionPayload);

    await page.waitForSelector('text/Save as Mistake', { timeout: 5000 });
    const saveSelectionMistakeBtn = await page.$('button ::-p-text(Save as Mistake)');
    if (saveSelectionMistakeBtn) {
      await saveSelectionMistakeBtn.click();
      await sleep(800);
      console.log('✓ Mode C selection mistake confirmed and saved.');
    }

    // 6.5. Test Case 4: Mode D - One-Click Full Mock Scan Transfer
    console.log('Step 6.5: Testing Mode D: One-Click Full Mock Scan Transfer...');
    const fullScanPayload = {
      id: `sb-mock-${Date.now()}`,
      mode: 'fullscan',
      text: 'StudyBridge V4 Full Mock Scan: SEBI Grade A 2025 Full Mock Test (IT Stream)',
      source: {
        platform: 'Testbook',
        url: 'https://testbook.com/test-series/sebi-grade-a-it/solution',
        title: 'SEBI Grade A 2025 Full Mock Test'
      },
      capturedAt: new Date().toISOString(),
      scanData: {
        mockName: 'SEBI Grade A 2025 Full Mock (IT)',
        examName: 'SEBI Grade A IT Stream',
        overallScore: 85.93,
        totalQuestions: 130,
        scanDurationMs: 4200,
        sections: [
          {
            sectionName: 'Paper 1',
            questionCount: 80,
            correctCount: 27,
            incorrectCount: 9,
            skippedCount: 44,
            marks: 30.93
          },
          {
            sectionName: 'Paper 2',
            questionCount: 50,
            correctCount: 30,
            incorrectCount: 10,
            skippedCount: 10,
            marks: 55.0
          }
        ],
        questions: [
          {
            questionNumber: 1,
            section: 'Paper 1',
            questionText: 'Tamil Nadu (TN) recently received six additional Geographical Indication (GI) tags...',
            options: [
              { index: 0, text: 'Rameswaram Fish...' },
              { index: 1, text: 'Puliyankudi Acid Lime...' },
              { index: 2, text: 'Rameswaram Fish...' },
              { index: 3, text: 'Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal', isCorrect: true },
              { index: 4, text: 'Chennai Masala...', isSelected: true }
            ],
            selectedAnswer: 'Left unattempted',
            correctAnswer: 'Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal',
            marks: 0,
            explanation: 'The correct answer is Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal.',
            statusBadge: 'Skipped',
            solutionStatus: 'captured',
            isMistakeCandidate: true
          },
          {
            questionNumber: 2,
            section: 'Paper 1',
            questionText: 'In August 2025, Bajaj Allianz Life Insurance acquired a stake in...',
            options: [
              { index: 0, text: 'Option A' },
              { index: 1, text: 'Option B', isCorrect: true }
            ],
            selectedAnswer: 'Option A',
            correctAnswer: 'Option B',
            marks: -0.25,
            statusBadge: 'Wrong',
            solutionStatus: 'captured',
            isMistakeCandidate: true
          }
        ]
      }
    };

    await page.evaluate((payload) => {
      window.postMessage({
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        source: 'STUDYBRIDGE_EXTENSION',
        payload
      }, '*');
    }, fullScanPayload);

    await page.waitForSelector('text/StudyBridge V4 Full Mock Scan Preview', { timeout: 6000 });
    console.log('✓ Mode D Full Mock Scan preview modal opened.');
    await page.screenshot({ path: path.join(ssDir, '04_studybridge_modeD_fullscan_modal.png') });
    console.log('✓ Captured 04_studybridge_modeD_fullscan_modal.png');

    const saveFullScanBtn = await page.$('button ::-p-text(Confirm & Save Mock)');
    if (saveFullScanBtn) {
      await saveFullScanBtn.click();
      await sleep(1000);
      console.log('✓ Mode D Full Mock Scan confirmed and saved to database.');
    }

    // 7. Verify Dexie Database contents in browser IndexedDB
    console.log('Step 7: Verifying Dexie persistence in browser IndexedDB...');
    const dbCounts = await page.evaluate(async () => {
      const indexedDB = window.indexedDB;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('MistakeNotebookDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const mockTx = db.transaction(['mocks', 'mistakes'], 'readonly');
          const mockStore = mockTx.objectStore('mocks');
          const mistStore = mockTx.objectStore('mistakes');
          const mockCountReq = mockStore.count();
          const mistCountReq = mistStore.count();

          mockCountReq.onsuccess = () => {
            mistCountReq.onsuccess = () => {
              resolve({
                mocksCount: mockCountReq.result,
                mistakesCount: mistCountReq.result
              });
            };
          };
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`✓ Database verification: ${dbCounts.mocksCount} mock(s), ${dbCounts.mistakesCount} mistake(s) present.`);
    if (dbCounts.mocksCount < 1 || dbCounts.mistakesCount < 2) {
      throw new Error(`Expected at least 1 mock and 2 mistakes, received: ${JSON.stringify(dbCounts)}`);
    }

    // 8. Capture Dashboard screenshot
    console.log('Step 8: Verifying Analytics and Dashboard View...');
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await sleep(500);
    await page.screenshot({ path: path.join(ssDir, '03_studybridge_dashboard_updated.png') });
    console.log('✓ Captured 03_studybridge_dashboard_updated.png');

    console.log('\n🎉 ALL STUDYBRIDGE V2 END-TO-END TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    if (browser) await browser.close();
    viteProcess.kill();
  }
}

function expectValue(actual, expected, desc) {
  if (actual !== expected) {
    throw new Error(`Assertion failed for "${desc}": expected "${expected}", received "${actual}"`);
  }
}

runStudyBridgeE2E().catch((err) => {
  console.error('❌ StudyBridge E2E Test Failed:', err);
  process.exit(1);
});
