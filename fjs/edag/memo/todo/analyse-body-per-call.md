## Analyse a function body once, not at every call

**Priority:** P3
**Status:** open

### Problem

The memo executor analyses an invoked function's body at every call:
`invokeWith`'s `body` in [`../module.f.mjs`](../module.f.mjs) builds
`identityAnalysis(fn)` each time a represented function is invoked. The
cost of a call grows with the size of its body's table, and faster than
linearly.

Since `7de6ddd5` the compiler evaluates a module by the identity table,
which merges nothing, so a body with many equal subtrees keeps every one of
them: `(a + a) + (a + a)` is three `+` nodes, not two. `2ca692ba` evaluated by
the merged table, so the function value's body was the merged graph, with
one node per distinct subtree. A body of equal subtrees, called often,
became much slower to compile to a value output:

```js
// a full tree of `a + a`, `depth` levels deep
const g = (a) => ((a + a) + (a + a)) + ((a + a) + (a + a));
const loop = (i, acc) => i === 0 ? acc : loop(i - 1, acc + g(i));
export default loop(40, 0);
```

`fjs compile input.f.js output.data.js`, with forty calls, at `7de6ddd5`
against `2ca692ba`:

| depth | `2ca692ba` | `7de6ddd5` |
| ----- | ---------- | ---------- |
| 7     | 95 ms      | 468 ms     |
| 8     | 127 ms     | 1,671 ms   |
| 9     | 206 ms     | 5,623 ms   |

The value is the same. Each level doubles the body and multiplies the time
by more than three.

Every call pays a smaller share of the same cost. A tail-recursive loop of
twenty thousand calls, `const f = (i, acc) => i === 0 ? acc : f(i - 1, acc + i);`,
compiled to `.data.js` at `7de6ddd5`, took about a fifth to a third longer
than at `2ca692ba`, about 0.6 s against 0.45 s. `identityAnalysis` takes its
`shared` from a `sharedNodesOf` walk of its own, where the table's in-degree
would give the same set: it did on the samples checked, and no proof says so
yet.

### Proposal

Investigate, then improve:

- where the cost goes: `identityAnalysis` itself, or the evaluation over a
  table that keeps every subtree;
- analysing a body once per function value, or once per body node, rather
  than at every call, keeping the cache immutable
  ([`immutable-cache.md`](./immutable-cache.md));
- whether `identityAnalysis` can be linear in the nodes it walks, taking
  `shared` from the table's in-degree.

### Tasks

- [ ] Profile the programs above and say where the time goes.
- [ ] Prove that the table's in-degree gives `identityAnalysis`'s `shared`,
      if the improvement takes it from there.
- [ ] Improve it, with a proof or a benchmark that pins the cost.

### Related

- [`../../analysis/module.f.mjs`](../../analysis/module.f.mjs) —
  `identityAnalysis`, `analysis`.
- [`../../../compiler/transpiler/module.f.mjs`](../../../compiler/transpiler/module.f.mjs)
  — evaluates a module by the identity table.
- [`immutable-cache.md`](./immutable-cache.md) — the executor's cache.
