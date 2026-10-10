## The four grammar demos repeat their setup and their intro

**Priority:** P4
**Status:** open

### Problem

The railroad pages of [`json`](../../../ebnf/lib/json/demo.f.mjs),
[`js`](../../../ebnf/lib/js/demo.f.mjs),
[`datajs`](../../../ebnf/lib/datajs/demo.f.mjs) and
[`markdown`](../../../ebnf/lib/markdown/demo.f.mjs) each begin
`const [ruleSet, entry, names] = toData(grammar)` and
`const nameOf = rule => assertNotNullish(names.get(rule))`, and each ends
with [`railroadDemo`](../railroad/module.f.mjs) over
`toDiagrams(ruleSet)(diagrams)`. The intro differs only in its first
clause; the sentence "Follow a track from left to right; a pill is text the
input holds, and a box is another diagram — select it to go there." is
identical in all four. A reader's guide to railroad diagrams is the demo
kind's text, not each grammar's.

A fifth grammar page is expected —
[symbol-labels](../../../ebnf/railroad/todo/symbol-labels.md) names
`compiler/parser/grammar` — and would copy a fifth time.

### Proposal

One `grammarDemo` beside `railroadDemo` takes the grammar, its first-clause
description and the titled rules to draw; it owns `toData`, `nameOf`, the
guide sentence and the `toDiagrams` call. Each page passes the grammar and
its titles.

### Tasks

- [ ] `grammarDemo` with a proof at 100%.
- [ ] Move the four pages onto it; check them in the browser.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.
