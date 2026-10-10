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

Some titled diagrams are inline variant branches, not exported source
rules: JSON and DataJS select `object` and `array` from `value`; JavaScript
selects `double` and `single` from `string`, and `star` from `content`.
The pages resolve these through [`branch`](../../../ebnf/railroad/module.f.mjs)
after lowering, so a list of source rules alone cannot describe them.

A fifth grammar page is expected —
[symbol-labels](../../../ebnf/railroad/todo/symbol-labels.md) names
`compiler/parser/grammar` — and would copy a fifth time.

### Proposal

One `grammarDemo` beside `railroadDemo` takes the grammar, its first-clause
description and an ordered list of titled selections:

- `[title, rule]` draws a source rule, including the grammar's entry rule.
- `[title, rule, tag]` draws the variant branch `tag` of that source rule.

For example, JSON passes `['value', value]`, `['object', value, 'object']`
and `['array', value, 'array']`. JavaScript passes
`['double', string, 'double']`, `['single', string, 'single']` and
`['star', content, 'star']` among its other selections. Markdown needs only
source-rule selections.

The helper owns `toData`, `nameOf`, `branch`, the guide sentence and the
`toDiagrams` call. It lowers once, uses the returned entry for the grammar
itself and the returned name map for other source rules, then resolves
branch selections with `branch(ruleSet)(nameOf(rule), tag)`. Each page
passes source rule identities and branch tags, never guessed lowered
names. Preserve the current titles, diagram order, intro text, diagrams
and links, including JavaScript's titled `star` that breaks the recursive
`content` / `star` cycle.

### Tasks

- [ ] `grammarDemo` with a proof at 100%, covering source-rule and branch
      selections and retaining the existing refusal of missing rules or
      branches.
- [ ] Move the four pages onto it, preserving their titled selections and
      rendered layout; check the diagrams and links in the browser.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.
