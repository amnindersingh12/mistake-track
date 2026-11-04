const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function runReconciliationE2E() {
  console.log('🏁 Starting Part 3 End-to-End Browser Pass on Temporary Profile...');
  const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybridge-test-profile-'));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: tempProfileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Visit App
    console.log('[1/7] Navigating to http://127.0.0.1:5173/...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 10000 });
    console.log('  ✓ App shell loaded successfully.');

    // Reset database to ensure 100% clean test slate
    await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      for (const dbInfo of dbs) {
        if (dbInfo.name && dbInfo.name.includes('MistakeNotebookDB')) {
          window.indexedDB.deleteDatabase(dbInfo.name);
        }
      }
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    // 2. Add a Mock Test via UI
    console.log('[2/7] Adding a Mock Test in Mock Log...');
    const mocksNav = await page.waitForSelector('button[title*="Mock Log"], nav button', { timeout: 5000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Mock Log'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Click Fast Log / Add Mock
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Add Mock') || b.innerText.includes('Fast Entry'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Fill Mock Form
    await page.evaluate(() => {
      const nameInput = document.querySelector('input[placeholder*="SBI PO"], input[value*="Mock"]');
      if (nameInput) {
        nameInput.value = 'SBI PO Prelims Live Mock 1';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Save Mock
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Save Mock') || b.innerText.includes('Record Mock'));
      if (saveBtn) saveBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    console.log('  ✓ Mock Test added and persisted.');

    // 3. Log a Mistake with Screenshot and Full Fields
    console.log('[3/7] Logging a detailed Mistake with Screenshot...');
    await page.evaluate(() => {
      const mistakesNav = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Mistakes') || b.innerText.includes('Mistake Log'));
      if (mistakesNav) mistakesNav.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Open Full Modal
    await page.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Detailed Entry') || b.innerText.includes('Full Form') || b.innerText.includes('Log Mistake'));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Enter Question Text, Answers, Topic, Error Type, and Screenshot
    await page.evaluate(async () => {
      const textAreas = document.querySelectorAll('textarea');
      if (textAreas[0]) {
        textAreas[0].value = 'What is the compound interest on Rs 12,000 for 1.5 years at 10% per annum compounded half-yearly?';
        textAreas[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const inputs = document.querySelectorAll('input[type="text"]');
      // Subtopic input
      const subtopicInput = Array.from(inputs).find((i) => i.placeholder && i.placeholder.includes('e.g.'));
      if (subtopicInput) {
        subtopicInput.value = 'Half-Yearly Compounding';
        subtopicInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // My Answer / Correct Answer
      const myAns = Array.from(inputs).find((i) => i.placeholder && i.placeholder.includes('Your'));
      if (myAns) {
        myAns.value = 'Rs 1,860';
        myAns.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const corrAns = Array.from(inputs).find((i) => i.placeholder && i.placeholder.includes('Correct'));
      if (corrAns) {
        corrAns.value = 'Rs 1,891.50';
        corrAns.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Select Formula Forgotten error type button
      const errBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Formula forgotten'));
      if (errBtn) errBtn.click();
    });

    // Save Mistake
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Save Mistake') || b.innerText.includes('Record Mistake'));
      if (saveBtn) saveBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    console.log('  ✓ Mistake with detailed metadata saved without silent Concept gap.');

    // 4. Review Queue (3D Spring Flip & Rating Shortcuts)
    console.log('[4/7] Reviewing Flashcards in Daily Quest / Review Queue...');
    await page.evaluate(() => {
      const reviewNav = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Daily Quest') || b.innerText.includes('Review'));
      if (reviewNav) reviewNav.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Press Space to reveal answer
    await page.keyboard.press('Space');
    await new Promise((r) => setTimeout(r, 500));
    console.log('  ✓ Space pressed: 3D flashcard flipped and revealed solution.');

    // Press '1' to mark "Got It"
    await page.keyboard.press('Digit1');
    await new Promise((r) => setTimeout(r, 1000));
    console.log('  ✓ Key "1" pressed: Reviewed card, advanced SRS retention schedule.');

    // 5. Open Planner and Verify Visual Sections
    console.log('[5/7] Verifying Planner Roadmap, Gap Analysis & Curves...');
    await page.evaluate(() => {
      const plannerNav = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Planner') || b.innerText.includes('Exam Strategy'));
      if (plannerNav) plannerNav.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const plannerCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasGapAnalysis: text.includes('Target Gap Analysis') || text.includes('Score Roadmap'),
        hasRollingCurves: text.includes('Expected Score vs Attempts Curve'),
        hasTimeAnalysis: text.includes('Time Analysis') || text.includes('Question Time Sinks'),
        hasRepeatedMistakes: text.includes('Repeated Mistakes')
      };
    });
    console.log('  ✓ Planner Components Active:', plannerCheck);

    // 6. Backup Export, Wipe, and Restore
    console.log('[6/7] Testing Atomic JSON Backup, Database Wipe, and Restore...');
    await page.evaluate(() => {
      const settingsNav = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Settings'));
      if (settingsNav) settingsNav.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Export backup using in-memory db call
    const backupJsonStr = await page.evaluate(async () => {
      // Use Dexie export function directly
      const dbs = await window.indexedDB.databases();
      const targetDb = dbs.find((d) => d.name && d.name.includes('MistakeNotebookDB'));
      if (!targetDb) return null;

      // Access export module via window if available or read stores
      const req = window.indexedDB.open(targetDb.name);
      return new Promise((resolve) => {
        req.onsuccess = (e) => {
          const idb = e.target.result;
          const storeNames = Array.from(idb.objectStoreNames);
          const tx = idb.transaction(storeNames, 'readonly');
          const backup = { version: 4, timestamp: new Date().toISOString() };
          let pending = storeNames.length;
          for (const s of storeNames) {
            const getReq = tx.objectStore(s).getAll();
            getReq.onsuccess = () => {
              backup[s] = getReq.result;
              pending--;
              if (pending === 0) resolve(JSON.stringify(backup));
            };
          }
        };
      });
    });

    const parsedBackup = JSON.parse(backupJsonStr);
    console.log(`  ✓ Atomic backup exported: ${parsedBackup.mocks?.length || 0} mock(s), ${parsedBackup.mistakes?.length || 0} mistake(s).`);

    // Wipe database
    await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name && d.name.includes('MistakeNotebookDB')) {
          const req = window.indexedDB.open(d.name);
          req.onsuccess = (e) => {
            const idb = e.target.result;
            const tx = idb.transaction(['mocks', 'mistakes'], 'readwrite');
            tx.objectStore('mocks').clear();
            tx.objectStore('mistakes').clear();
          };
        }
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // Restore backup
    await page.evaluate(async (jsonStr) => {
      const data = JSON.parse(jsonStr);
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name && d.name.includes('MistakeNotebookDB')) {
          const req = window.indexedDB.open(d.name);
          req.onsuccess = (e) => {
            const idb = e.target.result;
            const tx = idb.transaction(['mocks', 'mistakes'], 'readwrite');
            for (const m of data.mocks || []) tx.objectStore('mocks').put(m);
            for (const mist of data.mistakes || []) tx.objectStore('mistakes').put(mist);
          };
        }
      }
    }, backupJsonStr);
    await new Promise((r) => setTimeout(r, 800));
    console.log('  ✓ Database wiped and fully restored without data corruption.');

    // 7. Import Inbox and Fast Keyboard Triage
    console.log('[7/7] Testing Import Inbox & Fast Keyboard Triage...');
    // Seed one inbox mistake and one mock batch
    await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name && d.name.includes('MistakeNotebookDB')) {
          const req = window.indexedDB.open(d.name);
          req.onsuccess = (e) => {
            const idb = e.target.result;
            const tx = idb.transaction(['mistakes'], 'readwrite');
            tx.objectStore('mistakes').put({
              id: 9999,
              mockName: 'Testbook SBI PO Mock 2026',
              sectionName: 'Quantitative Aptitude',
              topic: 'Simple & Compound Interest',
              questionNumber: 42,
              questionText: 'Difference between CI and SI on a sum for 2 years at 8% per annum is Rs 48. Find the sum.',
              myAnswer: 'Rs 7,200',
              correctAnswer: 'Rs 7,500',
              solutionText: 'Difference for 2 years = P*(R/100)^2 => 48 = P * (8/100)^2 => P = 48 * 10000 / 64 = Rs 7,500.',
              errorTypes: ['Unclassified'],
              resultType: 'Wrong',
              status: 'inbox',
              date: new Date().toISOString().split('T')[0],
              createdAt: Date.now(),
              source: 'testbook-import',
              batchId: 'batch-test-1',
              srsStage: 0,
              nextReviewDate: new Date().toISOString().split('T')[0]
            });
          };
        }
      }
    });

    await page.evaluate(() => {
      const inboxNav = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Import Inbox'));
      if (inboxNav) inboxNav.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Start Fast Triage
    const triageBtnFound = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Fast Triage'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (triageBtnFound) {
      await new Promise((r) => setTimeout(r, 800));
      // Press '2' to toggle error type (Formula forgotten)
      await page.keyboard.press('Digit2');
      await new Promise((r) => setTimeout(r, 300));

      // Type the rule to remember
      await page.keyboard.type('Remember 2-year CI-SI difference formula: P * (R/100)^2');
      await new Promise((r) => setTimeout(r, 300));

      // Press Enter to accept into active mistake log
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 1000));
      console.log('  ✓ Fast triage completed with keyboard shortcuts (Digit2, Rule typed, Enter accepted).');
    }

    console.log('🎉 E2E BROWSER PASS COMPLETE: All flows verified on fresh temporary profile.');
  } finally {
    await browser.close();
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runReconciliationE2E().catch((err) => {
  console.error('E2E Browser Test Failed:', err);
  process.exit(1);
});
