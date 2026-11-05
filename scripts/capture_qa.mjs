import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const CDP_PORT = 9223;
const APP_URL = 'http://localhost:4173/';
const OUT_DIR = path.resolve('qa-screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function main() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/qa-chrome-profile-' + Date.now(),
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800'
  ]);

  // Wait for Chrome to listen
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        console.log('Chrome ready:', data['Browser']);
        break;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  wsUrl = tab.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Page.navigate', { url: APP_URL });
  await new Promise(r => setTimeout(r, 2000));

  async function takeScreenshot(fileName) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const filePath = path.join(OUT_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
  }

  async function evaluate(expression) {
    return await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
  }

  // 1. Home desktop
  console.log('Capturing Home Desktop...');
  await takeScreenshot('01-home-desktop.png');

  // 2. Command Palette (trigger Cmd+K)
  console.log('Opening Command Palette...');
  await evaluate(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  `);
  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('02-command-palette.png');

  // Close palette with Escape
  await evaluate(`
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  `);
  await new Promise(r => setTimeout(r, 300));

  // 3. Syllabus Tracker
  console.log('Switching to Syllabus Tracker...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Syllabus Tracker'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('03-syllabus-tracker.png');

  // 4. PYQ Bank
  console.log('Switching to PYQ Bank...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('PYQ Bank'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('04-pyq-bank.png');

  // 5. Overlap Map
  console.log('Switching to Overlap Map...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Overlap Map'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('05-overlap-map.png');

  // 6. Notes View
  console.log('Switching to Study Notes...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Study Notes'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('06-notes-view.png');

  // 7. Pattern Book
  console.log('Switching to Pattern Book...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Pattern Book'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('07-pattern-book.png');

  // 8. Focus Room
  console.log('Switching to Focus Room...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Focus Room'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('08-focus-room.png');

  // 9. Quest Board
  console.log('Switching to Quest Board...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Quest Board'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('09-quest-board.png');

  // 10. All Exams View
  console.log('Switching to All Exams Matrix...');
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('All Exams'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('10-all-exams.png');

  // 11. Mobile 390px View
  console.log('Switching to 390px Mobile Viewport...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  // Navigate back to home
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Command Center'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await takeScreenshot('11-home-mobile-390px.png');

  ws.close();
  chromeProc.kill();
  console.log('All QA Screenshots captured successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error in capture_qa:', err);
  process.exit(1);
});
