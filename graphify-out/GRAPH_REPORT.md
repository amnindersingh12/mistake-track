# Graph Report - proj  (2026-11-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 241 nodes · 563 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App.tsx
- package.json
- pipeline.js
- DataIntakeModal.tsx
- index.ts
- compilerOptions
- Sidebar.tsx
- clean_mock.js
- scripts
- scripts/package.json
- tailwind.config.js
- postcss.config.js
- bookmarklet.js
- @types/node@^22.13.10
- scripts/package.json

## God Nodes (most connected - your core abstractions)
1. `ExamSettings` - 28 edges
2. `Mascot()` - 21 edges
3. `MistakeEntry` - 20 edges
4. `MockTest` - 19 edges
5. `react` - 18 edges
6. `App()` - 16 edges
7. `compilerOptions` - 16 edges
8. `lucide-react` - 14 edges
9. `DataIntakeModal()` - 11 edges
10. `db` - 10 edges

## Surprising Connections (you probably didn't know these)
- `DataIntakeModalProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/DataIntakeModal.tsx → src/types/index.ts
- `SettingsViewProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/SettingsView.tsx → src/types/index.ts
- `exportAllDataAsJson()` --calls--> `ensureSettings()`  [EXTRACTED]
  src/utils/exportImport.ts → src/db/db.ts
- `MistakesView()` --calls--> `exportMistakesAsCsv()`  [EXTRACTED]
  src/components/MistakesView.tsx → src/utils/exportImport.ts
- `App()` --calls--> `SettingsView()`  [EXTRACTED]
  src/App.tsx → src/components/SettingsView.tsx

## Import Cycles
- None detected.

## Communities (18 total, 5 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.13
Nodes (33): lucide-react, CheatSheetViewProps, DashboardViewProps, MistakesViewProps, MocksViewProps, PaperExamModalProps, PapersViewProps, PlannerViewProps (+25 more)

### Community 1 - "package.json"
Cohesion: 0.13
Nodes (29): react, App(), CheatSheetView(), DashboardView(), LivingSky(), Mascot(), MascotMood, MascotProps (+21 more)

### Community 2 - "pipeline.js"
Cohesion: 0.07
Nodes (28): cleanHtmlText(), decodeToken(), defaultHtml, defaultJson, fs, html, parseOliveboardHtml(), path (+20 more)

### Community 3 - "DataIntakeModal.tsx"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 4 - "index.ts"
Cohesion: 0.13
Nodes (15): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, lucide-react@^1.16.0, react@^18.3.1, react-dom@^18.3.1 (+7 more)

### Community 5 - "compilerOptions"
Cohesion: 0.31
Nodes (12): DataIntakeModal(), DataIntakeModalProps, TabType, downloadTemplateFile(), getMistakeCsvTemplate(), getMistakeJsonTemplate(), getMockCsvTemplate(), getMockJsonTemplate() (+4 more)

### Community 6 - "Sidebar.tsx"
Cohesion: 0.15
Nodes (13): devDependencies, autoprefixer@^10.4.20, postcss@^8.5.3, puppeteer-core@^25.16.0, tailwindcss@^3.4.17, @types/react-dom@^18.3.5, vitest@^3.0.8, autoprefixer (+5 more)

### Community 7 - "clean_mock.js"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 8 - "scripts"
Cohesion: 0.50
Nodes (9): PlannerView(), calculateAttemptsNeeded(), calculateBreakEvenAccuracy(), calculateExpectedScorePerAttempt(), calculateGapAnalysis(), calculateTimePlan(), calculateWhatIfProjections(), generateCurveData() (+1 more)

### Community 9 - "scripts/package.json"
Cohesion: 0.22
Nodes (8): recharts@^2.15.1, recharts, PALETTE_COLORS, AttemptType, FocusAction, GeneratedInsights, generateInsights(), InsightCard

### Community 10 - "tailwind.config.js"
Cohesion: 0.20
Nodes (10): scripts, build, clean-mock, dev, extract, import-my-data, pipeline, preview (+2 more)

### Community 11 - "postcss.config.js"
Cohesion: 0.22
Nodes (8): @types/react@^18.3.18, typescript@^5.8.2, name, private, type, version, @types/react, typescript

### Community 12 - "bookmarklet.js"
Cohesion: 0.40
Nodes (4): vite@^6.2.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `puppeteer-core` connect `Sidebar.tsx` to `pipeline.js`, `postcss.config.js`?**
  _High betweenness centrality (0.281) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13178294573643412 - nodes in this community are weakly interconnected._
- **Why does `react` connect `package.json` to `App.tsx`, `index.ts`, `compilerOptions`, `scripts`, `scripts/package.json`, `postcss.config.js`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.12660028449502134 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `package.json`, `index.ts`, `compilerOptions`, `scripts`, `scripts/package.json`, `postcss.config.js`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Should `pipeline.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._
- **Should `DataIntakeModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._