const fs = require('fs');
const path = require('path');

const MY_DATA_DIR = path.join(__dirname, '..', 'my-data');
const OUTPUT_BUNDLE = path.join(MY_DATA_DIR, 'bundle-ready-for-app.json');

console.log('📂 Scanning /my-data folder for user files...');

if (!fs.existsSync(MY_DATA_DIR)) {
  fs.mkdirSync(MY_DATA_DIR, { recursive: true });
}

const files = fs.readdirSync(MY_DATA_DIR).filter((f) => f !== 'bundle-ready-for-app.json' && !f.startsWith('.'));

if (files.length === 0) {
  console.log('ℹ️  No user files found in /my-data yet.');
  console.log('👉 Drop your mock CSVs, JSONs, screenshots (.png, .jpg), or text analysis summaries into /my-data and re-run this script:');
  console.log('   npm run import-my-data\n');
  process.exit(0);
}

console.log(`Found ${files.length} file(s) in /my-data: ${files.join(', ')}`);

const bundle = {
  version: 2,
  generatedAt: new Date().toISOString(),
  mocks: [],
  mistakes: [],
  papers: [],
  screenshots: {}
};

for (const file of files) {
  const filePath = path.join(MY_DATA_DIR, file);
  const ext = path.extname(file).toLowerCase();

  try {
    if (ext === '.json') {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(content)) {
        // Could be mocks or mistakes
        if (content[0]?.sections) {
          bundle.mocks.push(...content);
          console.log(`✓ Read ${content.length} mock(s) from ${file}`);
        } else if (content[0]?.ruleToRemember || content[0]?.whatWentWrong) {
          bundle.mistakes.push(...content);
          console.log(`✓ Read ${content.length} mistake(s) from ${file}`);
        } else if (content[0]?.questions) {
          bundle.papers.push(...content);
          console.log(`✓ Read ${content.length} paper(s) from ${file}`);
        }
      } else if (content.mocks || content.mistakes) {
        if (content.mocks) bundle.mocks.push(...content.mocks);
        if (content.mistakes) bundle.mistakes.push(...content.mistakes);
        if (content.papers) bundle.papers.push(...content.papers);
        console.log(`✓ Read structured backup from ${file}`);
      }
    } else if (ext === '.csv') {
      const csvRaw = fs.readFileSync(filePath, 'utf8');
      const lines = csvRaw.split(/\r?\n/).filter(Boolean);
      const header = lines[0]?.toLowerCase() || '';

      if (header.includes('quant attempted') || header.includes('attempted')) {
        // Parse mock CSV
        console.log(`✓ Identified Mock CSV: ${file} (${lines.length - 1} rows)`);
      } else if (header.includes('rule to remember') || header.includes('what went wrong')) {
        console.log(`✓ Identified Mistake CSV: ${file} (${lines.length - 1} rows)`);
      }
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const imgBuffer = fs.readFileSync(filePath);
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      bundle.screenshots[file] = `data:${mime};base64,${imgBuffer.toString('base64')}`;
      console.log(`✓ Encoded screenshot ${file} (${Math.round(imgBuffer.length / 1024)} KB)`);
    } else if (ext === '.txt' || ext === '.md') {
      const text = fs.readFileSync(filePath, 'utf8');
      console.log(`✓ Read analysis notes from ${file} (${text.length} chars)`);
    }
  } catch (err) {
    console.warn(`⚠️  Could not parse ${file}:`, err.message);
  }
}

fs.writeFileSync(OUTPUT_BUNDLE, JSON.stringify(bundle, null, 2), 'utf8');
console.log(`\n🎉 Generated bundle saved to: my-data/bundle-ready-for-app.json`);
console.log(`Summary: ${bundle.mocks.length} mocks, ${bundle.mistakes.length} mistakes, ${bundle.papers.length} papers, ${Object.keys(bundle.screenshots).length} screenshots.`);
console.log(`👉 You can now click "Restore from Backup" in the app's Settings to review and load this data.\n`);

