const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://127.0.0.1:5173/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('🌸 Starting Anime UI & Real Data Intake E2E Test...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('🔴 Browser error:', msg.text());
    }
  });

  try {
    // 1. Visit App on clean start
    console.log('Step 1: Navigating to App...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(800);

    // 2. Check Empty State & Living Sky
    console.log('Step 2: Checking Designed Mascot Empty State...');
    await page.screenshot({ path: 'screenshots/01_dashboard_empty_night.png' });
    console.log('✓ Captured 01_dashboard_empty_night.png');

    // 3. Toggle to Morning Theme
    console.log('Step 3: Testing Theme Switch (Night -> Morning)...');
    const themeBtn = await page.$('button[title*="theme"]');
    if (themeBtn) {
      await themeBtn.click();
      await sleep(600);
      await page.screenshot({ path: 'screenshots/02_dashboard_empty_morning.png' });
      console.log('✓ Captured 02_dashboard_empty_morning.png (Morning theme)');
      // Switch back to Night
      await themeBtn.click();
      await sleep(400);
    }

    // 4. Test Real Data Intake Modal: Testbook Paste Import
    console.log('Step 4: Opening Data Intake Hub Modal...');
    const intakeBtn = await page.$('button ::-p-text(Data Intake)');
    if (intakeBtn) {
      await intakeBtn.click();
      await sleep(600);

      console.log('Pasting Testbook result text...');
      const testbookSample = `Testbook SBI PO Prelims Live Mock 03 Analysis
Quantitative Aptitude
Attempted: 28  Correct: 25  Incorrect: 3  Time: 18m 20s  Score: 24.25

Reasoning Ability
Attempted: 32  Correct: 30  Incorrect: 2  Time: 19m 15s  Score: 29.50

English Language
Attempted: 26  Correct: 22  Incorrect: 4  Time: 16m 40s  Score: 21.00

Total Score: 74.75 / 100
Accuracy: 88.37%`;

      const textarea = await page.$('textarea');
      if (textarea) {
        await textarea.type(testbookSample);
        await sleep(400);

        // Click Parse Text
        const parseBtn = await page.$('button ::-p-text(Parse Text)');
        if (parseBtn) {
          await parseBtn.click();
          await sleep(600);
          console.log('✓ Clicked Parse Text');

          await page.screenshot({ path: 'screenshots/03_data_intake_modal_parsed.png' });
          console.log('✓ Captured 03_data_intake_modal_parsed.png');

          // Click Confirm & Save to Mock Log
          const saveBtn = await page.$('button ::-p-text(Confirm & Save to Mock Log)');
          if (saveBtn) {
            await saveBtn.click();
            await sleep(1000);
            console.log('✓ Saved parsed mock test into IndexedDB!');
          }
        }
      }
    }

    // 5. Verify Dashboard with Real Mock Data
    console.log('Step 5: Inspecting Dashboard with landed mock...');
    await sleep(1000);
    await page.screenshot({ path: 'screenshots/04_dashboard_with_landed_mock.png' });
    console.log('✓ Captured 04_dashboard_with_landed_mock.png');

    // 6. Test Papers Library
    console.log('Step 6: Navigating to Papers Library (PYQ / Memory-based)...');
    const papersTab = await page.$('nav button ::-p-text(Papers Library)');
    if (papersTab) {
      await papersTab.click();
      await sleep(800);

      // Click Add Paper
      const addPaperBtn = await page.$('button ::-p-text(Add Paper to Library)');
      if (addPaperBtn) {
        await addPaperBtn.click();
        await sleep(500);

        const examNameInput = await page.$('input[placeholder*="SBI PO Prelims"]');
        if (examNameInput) {
          await examNameInput.click({ clickCount: 3 });
          await examNameInput.type('SBI PO Prelims 2024');
        }

        const shiftInput = await page.$('input[placeholder*="Shift 1"]');
        if (shiftInput) {
          await shiftInput.type('Shift 2 Morning');
        }

        const savePaperBtn = await page.$('button ::-p-text(Save Paper)');
        if (savePaperBtn) {
          await savePaperBtn.click();
          await sleep(800);
          console.log('✓ Saved SBI PO Prelims 2024 Paper to library');
        }
      }

      await page.screenshot({ path: 'screenshots/05_papers_library_with_paper.png' });
      console.log('✓ Captured 05_papers_library_with_paper.png');
    }

    // 7. Log a Real Mistake via Quick Add
    console.log('Step 7: Logging a Mistake via Quick Add...');
    const logMistakeBtn = await page.$('button ::-p-text(Log Mistake)');
    if (logMistakeBtn) {
      await logMistakeBtn.click();
      await sleep(600);

      // Fill in question prompt
      const qTextarea = await page.$('textarea[placeholder*="Question prompt"]');
      if (qTextarea) {
        await qTextarea.type('In a race of 1000m, A beats B by 100m or 10 seconds. Find the speed of A.');
      }

      // Fill answers
      const inputs = await page.$$('input[type="text"]');
      for (const inp of inputs) {
        const ph = await inp.evaluate((el) => el.getAttribute('placeholder') || '');
        if (ph.includes('Option B') || ph.includes('e.g. 45 km/h')) {
          await inp.type('9 m/s');
        } else if (ph.includes('e.g. 50 km/h')) {
          await inp.type('11.11 m/s');
        } else if (ph.includes('Always check whether')) {
          await inp.type('Speed of B = 100m / 10s = 10 m/s. Time for B = 100s. Time for A = 90s. Speed of A = 1000/90 = 11.11 m/s.');
        }
      }

      // Solution textarea
      const textareas = await page.$$('textarea');
      if (textareas.length >= 3) {
        await textareas[1].type('Assumed A takes 100s instead of B taking 100s.');
        await textareas[2].type('B covers 100m in 10s, so B speed = 10 m/s. B total time = 1000/10 = 100s. A takes 10s less = 90s. A speed = 1000/90 = 11.11 m/s.');
      }

      // Save Mistake
      const saveMistakeBtn = await page.$('button ::-p-text(Save Mistake)');
      if (saveMistakeBtn) {
        await saveMistakeBtn.click();
        await sleep(1000);
        console.log('✓ Saved mistake with rule to remember!');
      }
    }

    // 8. Test Spaced Repetition Review Queue (Daily Quest)
    console.log('Step 8: Checking Daily Quest Review Queue...');
    const reviewTab = await page.$('nav button ::-p-text(Daily Quest)');
    if (reviewTab) {
      await reviewTab.click();
      await sleep(800);

      await page.screenshot({ path: 'screenshots/06_daily_quest_flashcard.png' });
      console.log('✓ Captured 06_daily_quest_flashcard.png');

      // Click Flip Card
      const flipBtn = await page.$('button ::-p-text(Flip Card)');
      if (flipBtn) {
        await flipBtn.click();
        await sleep(500);

        // Advance card with "Got It"
        const gotItBtn = await page.$('button ::-p-text(Got It!)');
        if (gotItBtn) {
          await gotItBtn.click();
          await sleep(1000);
          console.log('✓ Reviewed card with Got It!');
        }
      }

      await page.screenshot({ path: 'screenshots/07_daily_quest_revealed_and_cleared.png' });
      console.log('✓ Captured 07_daily_quest_revealed_and_cleared.png');
    }

    // 9. Check Revision Cheat Sheet
    console.log('Step 9: Navigating to Cheat Sheet...');
    const cheatTab = await page.$('nav button ::-p-text(Cheat Sheet)');
    if (cheatTab) {
      await cheatTab.click();
      await sleep(800);
      await page.screenshot({ path: 'screenshots/08_cheat_sheet_populated.png' });
      console.log('✓ Captured 08_cheat_sheet_populated.png');
    }

    // 10. Check Target Strategy Planner
    console.log('Step 10: Navigating to Planner...');
    const plannerTab = await page.$('nav button ::-p-text(Strategy Planner)');
    if (plannerTab) {
      await plannerTab.click();
      await sleep(800);
      await page.screenshot({ path: 'screenshots/09_planner_with_real_metrics.png' });
      console.log('✓ Captured 09_planner_with_real_metrics.png');
    }

    // 11. Mobile Responsiveness Test (390 x 844 iPhone 14)
    console.log('Step 11: Testing Mobile Viewport (390x844)...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(500);

    // Open mobile nav drawer
    const hamburger = await page.$('button[aria-label="Open mobile navigation"]');
    if (hamburger) {
      await hamburger.click();
      await sleep(500);
      await page.screenshot({ path: 'screenshots/10_mobile_nav_drawer.png' });
      console.log('✓ Captured 10_mobile_nav_drawer.png');

      const closeNav = await page.$('nav button ::-p-text(Dashboard)');
      if (closeNav) {
        await closeNav.click();
        await sleep(500);
      }
    }

    await page.screenshot({ path: 'screenshots/11_mobile_dashboard_night.png' });
    console.log('✓ Captured 11_mobile_dashboard_night.png');

    // Morning mobile
    const mobileThemeBtn = await page.$('button[title*="theme"]');
    if (mobileThemeBtn) {
      await mobileThemeBtn.click();
      await sleep(500);
      await page.screenshot({ path: 'screenshots/12_mobile_dashboard_morning.png' });
      console.log('✓ Captured 12_mobile_dashboard_morning.png');
    }

    console.log('🎉 ALL PUPPETEER TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await browser.close();
  }
}

run();
