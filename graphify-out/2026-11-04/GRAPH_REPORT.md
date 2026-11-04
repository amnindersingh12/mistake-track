# Graph Report - proj  (2026-11-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 243 nodes · 543 edges · 13 communities (9 shown, 4 thin omitted)
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

## God Nodes (most connected - your core abstractions)
1. `ExamSettings` - 28 edges
2. `MistakeEntry` - 20 edges
3. `MockTest` - 19 edges
4. `react` - 18 edges
5. `compilerOptions` - 16 edges
6. `Mascot()` - 15 edges
7. `lucide-react` - 14 edges
8. `App()` - 13 edges
9. `db` - 10 edges
10. `scripts` - 10 edges

## Surprising Connections (you probably didn't know these)
- `DataIntakeModalProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/DataIntakeModal.tsx → src/types/index.ts
- `SettingsViewProps` --references--> `ExamSettings`  [EXTRACTED]
  src/components/SettingsView.tsx → src/types/index.ts
- `App()` --calls--> `PlannerView()`  [EXTRACTED]
  src/App.tsx → src/components/PlannerView.tsx
- `App()` --calls--> `Sidebar()`  [EXTRACTED]
  src/App.tsx → src/components/Sidebar.tsx
- `App()` --calls--> `useTheme()`  [EXTRACTED]
  src/App.tsx → src/context/ThemeContext.tsx

## Import Cycles
- None detected.

## Communities (13 total, 4 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.10
Nodes (42): lucide-react, App(), CheatSheetView(), CheatSheetViewProps, DashboardView(), DashboardViewProps, PALETTE_COLORS, DataIntakeModalProps (+34 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (44): dependencies, canvas-confetti@^1.9.4, dexie@^4.0.11, dexie-react-hooks@^1.1.7, framer-motion@^14.9.1, lucide-react@^1.16.0, react@^18.3.1, react-dom@^18.3.1 (+36 more)

### Community 2 - "pipeline.js"
Cohesion: 0.07
Nodes (28): cleanHtmlText(), decodeToken(), defaultHtml, defaultJson, fs, html, parseOliveboardHtml(), path (+20 more)

### Community 3 - "DataIntakeModal.tsx"
Cohesion: 0.23
Nodes (18): react, DataIntakeModal(), TabType, Mascot(), MascotMood, MascotProps, PaperExamModal(), PapersView() (+10 more)

### Community 4 - "index.ts"
Cohesion: 0.21
Nodes (18): PlannerView(), Difficulty, PlannerInput, PlannerResult, ResultType, ReviewLog, SectionConfig, UserRank (+10 more)

### Community 5 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 6 - "Sidebar.tsx"
Cohesion: 0.19
Nodes (10): LivingSky(), NavTab, Sidebar(), SidebarProps, Theme, ThemeContext, ThemeContextType, ThemeProvider() (+2 more)

### Community 7 - "clean_mock.js"
Cohesion: 0.23
Nodes (11): cleanedData, cleanedQuestions, cleanOptionText(), defaultIn, formatExplanation(), fs, path, raw (+3 more)

### Community 8 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, clean-mock, dev, extract, import-my-data, pipeline, preview (+2 more)

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `puppeteer-core` connect `package.json` to `pipeline.js`?**
  _High betweenness centrality (0.278) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10324675324675325 - nodes in this community are weakly interconnected._
- **Why does `react` connect `DataIntakeModal.tsx` to `App.tsx`, `package.json`, `index.ts`, `Sidebar.tsx`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06183574879227053 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `package.json`, `DataIntakeModal.tsx`, `index.ts`, `Sidebar.tsx`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Should `pipeline.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._