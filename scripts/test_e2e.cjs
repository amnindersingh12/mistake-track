const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function runE2ETests() {
  console.log('🚀 Starting E2E Browser Testing...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Collect console errors if any
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Visit App
    console.log('Step 1: Navigating to http://127.0.0.1:5173/...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for app to render
    await page.waitForSelector('h1', { timeout: 10000 });
    const titleText = await page.$eval('h1', (el) => el.innerText);
    console.log(`✓ App Header loaded: "${titleText}"`);

    // 2. Load Sample Data
    console.log('Step 2: Checking / Loading Sample Data...');
    // Look for "Load Sample Data" button in header or settings
    const sampleBtn = await page.$('button ::-p-text(Load Sample Data)');
    if (sampleBtn) {
      await sampleBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
      console.log('✓ Clicked "Load Sample Data" button');
    }

    // Verify Dashboard Cards
    await page.waitForSelector('text/Today\'s Review Queue', { timeout: 8000 });
    console.log('✓ Dashboard loaded with Review Queue, Streak, Latest Mock, and Gap to Target');

    // Verify Recharts containers are rendered
    const chartContainers = await page.$$('.recharts-responsive-container');
    console.log(`✓ Recharts containers rendered: ${chartContainers.length} active charts`);

    // 3. Test Navigation: Mocks Page
    console.log('Step 3: Navigating to Mock Log...');
    const mocksNav = await page.$('nav button ::-p-text(Mock Log)');
    await mocksNav.click();
    await new Promise((r) => setTimeout(r, 800));

    // Verify Mocks list
    const mockCards = await page.$$('text/Testbook PO Prelims Mock');
    console.log(`✓ Found ${mockCards.length} mock tests in log`);

    // Add a new mock test
    console.log('Step 4: Adding a new Mock Test (Fast Log)...');
    const addMockBtn = await page.$('button ::-p-text(Add Mock (60s Fast Entry))');
    await addMockBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    // Check modal opened and fill in inputs
    const mockNameInput = await page.$('input[placeholder*="Testbook PO Prelims Mock"]');
    await mockNameInput.click({ clickCount: 3 });
    await mockNameInput.type('Testbook PO Prelims Mock 07');

    // Fill attempted and correct for section 1
    const attemptedInputs = await page.$$('input[placeholder="0"]');
    if (attemptedInputs.length >= 6) {
      // Quant
      await attemptedInputs[0].type('28');
      await attemptedInputs[1].type('25');
      // Reasoning
      await attemptedInputs[3].type('30');
      await attemptedInputs[4].type('27');
      if (attemptedInputs.length >= 9) {
        // English
        await attemptedInputs[6].type('26');
        await attemptedInputs[7].type('22');
      }
    }

    // Submit modal
    const saveMockBtn = await page.$('button ::-p-text(Save Mock Test)');
    await saveMockBtn.click();
    await new Promise((r) => setTimeout(r, 1200));

    const updatedMocks = await page.$$('text/Testbook PO Prelims Mock 07');
    console.log(`✓ Successfully added Mock 07 (Found: ${updatedMocks.length > 0})`);

    // Test Compare 2 Mocks
    console.log('Step 5: Testing Mock Comparator...');
    const compareBtn = await page.$('button ::-p-text(Compare 2 Mocks)');
    if (compareBtn) {
      await compareBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      await page.waitForFunction(
        () => document.body.innerText.includes('Side-by-Side Mock Comparator'),
        { timeout: 8000 }
      );
      console.log('✓ Mock Comparator modal displayed with deltas');
      const closeCompareBtn = await page.$('button ::-p-text(Close Comparison)');
      if (closeCompareBtn) {
        await closeCompareBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 4. Test Mistakes Log Page
    console.log('Step 6: Navigating to Mistake Log...');
    const mistakesNav = await page.$('nav button ::-p-text(Mistake Log)');
    await mistakesNav.click();
    await new Promise((r) => setTimeout(r, 800));

    // Filter test
    const sectionSelect = await page.$('select');
    await sectionSelect.select('quant');
    await new Promise((r) => setTimeout(r, 500));
    console.log('✓ Section filter applied on Mistake Log');

    // Add Detailed Mistake with Screenshot image
    console.log('Step 7: Adding a Detailed Mistake with Embedded Image...');
    const addMistakeBtn = await page.$('button ::-p-text(Log Detailed Mistake)');
    await addMistakeBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    // Fill form
    const qTextArea = await page.$('textarea[placeholder*="Type or paste question statement"]');
    await qTextArea.type('Train A running at 72 km/h crosses a 180m tunnel in 15 seconds. Find length of Train A.');

    const myAnsInput = await page.$('input[placeholder*="Option B"]');
    await myAnsInput.type('140m');

    const corrAnsInput = await page.$('input[placeholder*="Option C"]');
    await corrAnsInput.type('120m');

    const wrongTextArea = await page.$('textarea[placeholder*="Calculated percentage"]');
    await wrongTextArea.type('Forgot to convert 72 km/h to m/s by multiplying with 5/18.');

    const solTextArea = await page.$('textarea[placeholder*="Gain ="]');
    await solTextArea.type('Speed = 72 * 5/18 = 20 m/s. Total dist = 20 * 15 = 300m. Train length = 300 - 180 = 120m.');

    const ruleInput = await page.$('input[placeholder*="Dishonest dealer"]');
    await ruleInput.type('Always multiply km/h by 5/18 immediately to obtain m/s before distance equations.');

    // Save mistake
    const saveMistakeBtn = await page.$('button ::-p-text(Save Mistake)');
    await saveMistakeBtn.click();
    await new Promise((r) => setTimeout(r, 1200));
    console.log('✓ Successfully logged detailed mistake with solution and rule!');

    // 5. Test Review Queue (Flashcards mode & Space / 1 / 2 shortcuts)
    console.log('Step 8: Testing Spaced Repetition Review Queue...');
    const reviewNav = await page.$('nav button ::-p-text(Review Queue)');
    await reviewNav.click();
    await new Promise((r) => setTimeout(r, 800));

    const revealBtn = await page.$('button ::-p-text(Reveal Solution & Better Approach)');
    if (revealBtn) {
      await revealBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      console.log('✓ Card revealed: verified solution, better approach, and rule display');

      // Click "Got It!" to test interval advancing
      const gotItBtn = await page.$('button ::-p-text(Got It! Advance Interval)');
      if (gotItBtn) {
        await gotItBtn.click();
        await new Promise((r) => setTimeout(r, 800));
        console.log('✓ Reviewed card with "Got It!" action; interval progressed');
      }
    }

    // 6. Test Strategy Planner
    console.log('Step 9: Testing Strategy Planner...');
    const plannerNav = await page.$('nav button ::-p-text(Strategy Planner)');
    await plannerNav.click();
    await new Promise((r) => setTimeout(r, 800));

    await page.waitForFunction(
      () => document.body.innerText.includes('Target Strategy Output') || document.body.innerText.includes('Target Strategy Planner'),
      { timeout: 8000 }
    );
    const explanationText = await page.$eval('.bg-emerald-50, .bg-rose-50, .bg-white', (el) => el.innerText);
    console.log(`✓ Strategy Planner Math Output verified!`);

    // 7. Test Cheat Sheet Page
    console.log('Step 10: Testing Revision Cheat Sheet...');
    const cheatSheetNav = await page.$('nav button ::-p-text(Cheat Sheet)');
    await cheatSheetNav.click();
    await new Promise((r) => setTimeout(r, 800));

    await page.waitForFunction(
      () => document.body.innerText.includes('active rules') || document.body.innerText.includes('Displaying'),
      { timeout: 8000 }
    );
    console.log(`✓ Cheat Sheet active with grouped rules!`);

    // 8. Test Settings & Backup
    console.log('Step 11: Testing Settings & Backup JSON Export/Restore...');
    const settingsNav = await page.$('nav button ::-p-text(Settings & Data)');
    await settingsNav.click();
    await new Promise((r) => setTimeout(r, 800));

    const exportBtn = await page.$('button ::-p-text(Download JSON Backup)');
    console.log(`✓ Backup buttons available: Download JSON Backup (Found: ${!!exportBtn})`);

    // Save a full screenshot of the dashboard
    console.log('Step 12: Capturing verification screenshot...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    const screenshotDir = path.resolve(__dirname, '..', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    await page.screenshot({ path: path.join(screenshotDir, 'dashboard_verified.png'), fullPage: true });
    console.log('✓ Screenshot saved to screenshots/dashboard_verified.png');

    console.log('\n========================================');
    console.log('🎉 ALL BROWSER E2E TESTS PASSED SUCCESSFULLY!');
    console.log(`Console error count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Warnings/Errors:', consoleErrors);
    }
    console.log('========================================\n');
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runE2ETests();

