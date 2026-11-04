const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://127.0.0.1:5173/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('⌨️  Testing Keyboard Shortcuts & Engagement Features...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(1000);

    // 1. Test '?' shortcut for Keyboard Shortcuts modal
    console.log('Testing "?" key to open shortcuts modal...');
    await page.keyboard.press('?');
    await sleep(600);

    let modalVisible = await page.$('::-p-text(Keyboard Shortcuts)');
    if (!modalVisible) throw new Error('Shortcuts modal did not open on "?"');
    console.log('✓ Shortcuts modal opened successfully on "?"!');

    // 2. Test 'Escape' key to close modal
    console.log('Testing "Escape" key to close modal...');
    await page.keyboard.press('Escape');
    await sleep(500);
    modalVisible = await page.$('::-p-text(Keyboard Shortcuts)');
    if (modalVisible) throw new Error('Shortcuts modal did not close on "Escape"');
    console.log('✓ Shortcuts modal closed on "Escape"!');

    // 3. Test number keys tab switching (e.g. '5' for Daily Quest, '4' for Mistakes, '1' for Dashboard)
    console.log('Testing "5" to switch to Daily Quest...');
    await page.keyboard.press('5');
    await sleep(600);
    let questHeader = await page.$('::-p-text(Daily Quest)');
    if (!questHeader) throw new Error('Failed to switch to Daily Quest with key 5');
    console.log('✓ Switched to Daily Quest via key 5!');

    console.log('Testing "4" to switch to Mistake Log...');
    await page.keyboard.press('4');
    await sleep(600);
    let mistakesView = await page.$('::-p-text(Mistake Log)');
    if (!mistakesView) throw new Error('Failed to switch to Mistake Log with key 4');
    console.log('✓ Switched to Mistake Log via key 4!');

    console.log('Testing "1" to switch to Dashboard...');
    await page.keyboard.press('1');
    await sleep(600);
    let dashboardCenter = await page.$('::-p-text(Command Centre)');
    if (!dashboardCenter) throw new Error('Failed to switch to Dashboard via key 1');
    console.log('✓ Switched to Dashboard via key 1!');

    // 4. Test 'n' to open Quick Log Mistake
    console.log('Testing "N" to open Quick Log Mistake...');
    await page.keyboard.press('n');
    await sleep(600);
    let quickModal = await page.$('::-p-text(Quick Log Mistake)');
    if (!quickModal) throw new Error('Quick modal did not open on "n"');
    console.log('✓ Quick Log Mistake opened on "n"!');

    await page.keyboard.press('Escape');
    await sleep(400);

    // 5. Test 'i' to open Data Intake
    console.log('Testing "I" to open Data Intake...');
    await page.keyboard.press('i');
    await sleep(600);
    let intakeModal = await page.$('::-p-text(Data Intake Hub)');
    if (!intakeModal) throw new Error('Data Intake modal did not open on "i"');
    console.log('✓ Data Intake Hub opened on "i"!');

    await page.keyboard.press('Escape');
    await sleep(400);

    // 6. Test 't' to toggle theme
    console.log('Testing "T" to toggle theme...');
    const themeBefore = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    await page.keyboard.press('t');
    await sleep(500);
    const themeAfter = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    if (themeBefore === themeAfter) throw new Error('Theme did not change on "t"');
    console.log(`✓ Theme successfully toggled from ${themeBefore} to ${themeAfter} on "t"!`);

    // Toggle back
    await page.keyboard.press('t');
    await sleep(300);

    console.log('🎉 ALL KEYBOARD SHORTCUTS TESTS PASSED CLEANLY!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

