## `sourceChildren` beside `source.ts`; the parser's predicates fold over it

**Priority:** P3
**Status:** open

### Problem

`SourceBlock`, `SourceStatement` and `SourceExit` are defined in
[`source.ts`](../source.ts), yet their nesting is re-enumerated by four
functions. `hasTargetBreak` and `internalReturn` in
[`fjs/compiler/parser`](../../../../compiler/parser/module.f.mjs) are the same
explicit-stack loop differing only in the predicate (and `internalReturn`
also descending `exit`):

```js
// hasTargetBreak; internalReturn is the same loop with `statement[0] === 'return'`
if (statement[0] === 'break' && statement[1] === target) { return true }
if (statement[0] === 'if') { pending = [...pending, statement[2], statement[3]] }
if (statement[0] === 'while') { pending = [...pending, statement[1].body] }
if (statement[0] === 'switch') { pending = [...pending, ...statement[1].cases.map(arm => arm.body), statement[1].otherwise] }
```

`writes` in [`effects`](../effects/module.f.mjs) spells the full children
table a third time (`initialize`/`write`, `compound-write`, `if`, `while`,
`switch`, and the exit), and `continuedSteps` in [`module.f.mjs`](../module.f.mjs)
recurses through `if` arms and `switch` cases a fourth time to insert a `for`
step before each `continue`. `caseFallsThrough` in the parser is
path-sensitive and stays its own.

### Proposal

In this module, the owner of `source.ts`: `sourceChildren(node)` — the table
`writes` already has, lifted out — `sourceBlocks(root)` over it with functions
opaque, and `mapSourceBlocks(block, f)` for `continuedSteps`. The parser,
which already imports `planPattern` from here, writes `hasTargetBreak` and
`internalReturn` as `some` over `sourceBlocks`.

### Tasks

- [ ] Export `sourceChildren`, `sourceBlocks` and `mapSourceBlocks`.
- [ ] Rewrite `writes`, `continuedSteps`, `hasTargetBreak` and
      `internalReturn` over them.

### Related

- [`fjs/js/ast/todo/fast-children-once`](../../todo/fast-children-once.md) —
  the same issue one representation later.
