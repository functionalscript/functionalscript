## Independent shared terminal recipes retain recursion

**Priority:** P1
**Status:** open

### Problem

The tail planner factors one exclusively terminal lazy recipe and its exclusive
dependencies. Two independent terminal roots keep their recursive layout even
when every reached recursive evaluation is tail to its owning function.
Accepted JavaScript output can therefore exhaust the native stack.

This finite EDAG reproduces the gap. The same `left` and `right` call objects
must be shared across both selections; repeated source call syntax constructs
different nodes and does not express this graph.

```js
const n = ['arg', 0]
const selected = ['arg', 1]
const self = ['self']
const left = ['()', self, [['-', n, 1], false]]
const right = ['()', self, [['-', n, 1], true]]
const graph = ['=>', 2, [], ['?:', ['>', n, 0],
    ['?:', selected,
        ['?:', ['%', n, 2], left, right],
        ['?:', ['%', n, 3], left, right],
    ],
    0,
]]
```

On the pinned Node 26.13.0, both flags at counts `0`, `1`, `2` and `7` return
`0`. At `100_001`, code-only modules, evaluated-value `stringify` and
`tryFunctionText` output throw `RangeError: Maximum call stack size exceeded`.
Their memo getters call the owning recursive function instead of forwarding a
loop transition. Rust `toRust` accepts and emits the same owning calls inside
memo initializers; native Rust overflow was not measured.

Public FJS `tryStringify` explicitly refuses the graph with
`a shared node reached from outside the lazy operand that establishes it`.
That refusal is a separate source-representability boundary.

### Tasks

- [ ] Replace the accepted recursive fallback in common tail planning for this
      graph. Preserve each selected demand, required work, sharing, captures and
      invocation-local memo lifetime without duplicating a shared call.
- [ ] Execute the reproducer through code-only modules, evaluated-value output,
      function text and native Rust at `100_001`, checking bounded loop output.
- [ ] Add selected failures, distinct argument vectors and shared allocation
      variants while preserving existing single-root profiles.
- [ ] Retain explicit public-source refusal until a source-compatible plan is
      available, then verify parsing and native execution separately.

### Related

- [Self-tail output audit](../../../../compiler/self-tail-output.md)
- [Planner](../module.f.mjs), `recipeTask` and its single-root check.
- [Existing pure proof](../proof.f.mjs),
  `independentInterleavedRecipesKeepTheirExistingLayout`.
