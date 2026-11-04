const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://127.0.0.1:5173/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVisualQA() {
  console.log('🚀 Running Visual QA & Screenshot Verification for Study App 2.0...');

  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots', { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });

  try {
    // 1. Desktop Night Mode
    console.log('Step 1: Navigating to App (Desktop Night)...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(800);
    await page.screenshot({ path: 'screenshots/qa_01_desktop_night_dashboard.png' });
    console.log('✓ Captured qa_01_desktop_night_dashboard.png');

    // 2. Desktop Morning Mode (Theme Toggle)
    console.log('Step 2: Switching to Morning Theme...');
    const themeToggle = await page.$('button[aria-label="Toggle Theme"]');
    if (themeToggle) {
      await themeToggle.click();
      await sleep(600);
      await page.screenshot({ path: 'screenshots/qa_02_desktop_morning_dashboard.png' });
      console.log('✓ Captured qa_02_desktop_morning_dashboard.png');
      // Switch back to Night
      await themeToggle.click();
      await sleep(500);
    }

    // 3. Test Global Search Modal (Cmd+K)
    console.log('Step 3: Triggering Global Search Modal (Cmd+K)...');
    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    await sleep(600);
    await page.screenshot({ path: 'screenshots/qa_03_global_search_modal.png' });
    console.log('✓ Captured qa_03_global_search_modal.png');

    // Close Search Modal via Escape
    await page.keyboard.press('Escape');
    await sleep(400);

    // 4. Navigate to Strategy & Daily Planner
    console.log('Step 4: Navigating to Strategy & Daily Planner...');
    const plannerNav = await page.$('aside button:nth-child(6)');
    if (plannerNav) {
      await plannerNav.click();
      await sleep(600);
      await page.screenshot({ path: 'screenshots/qa_04_planner_and_mastery_matrix.png' });
      console.log('✓ Captured qa_04_planner_and_mastery_matrix.png');
    }

    // 5. Navigate to Settings with Exam Profile Presets
    console.log('Step 5: Navigating to Settings & Exam Profiles...');
    const settingsNav = await page.$('aside button:nth-child(8)');
    if (settingsNav) {
      await settingsNav.click();
      await sleep(600);
      await page.screenshot({ path: 'screenshots/qa_05_settings_exam_profiles.png' });
      console.log('✓ Captured qa_05_settings_exam_profiles.png');
    }

    // 6. Mobile Viewport (390 x 844)
    console.log('Step 6: Testing Mobile Viewport (iPhone 14 size)...');
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await sleep(600);
    await page.screenshot({ path: 'screenshots/qa_06_mobile_dashboard.png' });
    console.log('✓ Captured qa_06_mobile_dashboard.png');

    console.log('🎉 Visual QA Verification Completed Successfully!');
  } catch (err) {
    console.error('Visual QA Error:', err);
  } finally {
    await browser.close();
  }
}

runVisualQA();

