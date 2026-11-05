---
trigger: always_on
description: Use the graphify knowledge graph BEFORE reading source files. Never read raw code to understand the codebase.
---

## graphify — mandatory graph-first protocol

`graphify-out/graph.json` exists and is current (672 nodes, auto-updated on git commit).

### RULE: graph before files

**You MUST use graphify before opening any source file for understanding purposes.**
Opening a source file just to understand structure/relationships is forbidden while the graph is fresh.

### Decision tree (follow in order)

1. **Need to understand what a symbol/file does?**
   → `graphify explain "<symbol>"` — instant, zero tokens
2. **Need to know how A connects to B?**
   → `graphify path "<A>" "<B>"` — returns the hop chain
3. **Broad question about a feature or module?**
   → `graphify query "<question>"` — BFS subgraph, scoped to ~2000 tokens by default
4. **Broad architecture overview?**
   → Read `graphify-out/GRAPH_REPORT.md` — pre-built, no scanning needed
5. **Still need a specific line of code?** (e.g. to edit it)
   → Now open the specific file, targeted to the line graphify told you

### After any code edit

```bash
graphify update .   # re-indexes changed files, no LLM, no API key needed
```

### Subagents must follow this too

When spawning a subagent that will touch this codebase, include in its prompt:
> "Use `graphify query/explain/path` before reading any source files. The graph is at graphify-out/graph.json."

### Allowed exceptions

- Writing new code to a new file (no prior context to look up)
- Running tests or build commands
- Reading a file at a line graphify already pointed you to
