## Deep containers and functions overflow the compiler's own walks

**Priority:** P1
**Status:** open

### Problem

The explicit-stack fixes in [`../ast/module.f.mjs`](../ast/module.f.mjs)
(`refsOf`) and [`../edag/module.f.mjs`](../edag/module.f.mjs) (`lower`)
cover operator chains only. A container or a function body still recurses
once per level, before the EDAG analysis that
[stack-safety](../../edag/todo/stack-safety.md) tracks is ever reached:

- `lowerLeaf` in [`../edag/module.f.mjs`](../edag/module.f.mjs) lowers an
  `'array'` or `'object'` by mapping `lower(nodes)` over its items, and a
  function through `fn` → `scope` → `lower`;
- `toDjs` in [`../ast/module.f.mjs`](../ast/module.f.mjs) evaluates an
  `'array'` or `'object'` by mapping itself over its items.

At `36c8d4a`, `export default ${'['.repeat(3000)}${']'.repeat(3000)};` —
a depth the parser's `stackSafety` proof accepts — fails with
`RangeError: Maximum call stack size exceeded` in `lower` for the `.rs` and
`.edag.data.js` outputs and in `toDjs` for `.json`; a body 20,000 functions
deep fails in `lower` as well.

### Tasks

- [ ] Give `lowerLeaf`'s container and function cases, and `toDjs`'s
      container cases, the explicit stack the operator cases already have.
- [ ] Proofs at the depth `stackSafety` in `../parser/proof.f.mjs` uses, for
      nested arrays, nested objects and nested functions, on every output.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [stack-safety](../../edag/todo/stack-safety.md) — the same shape in
  `fjs/edag/analysis` and `fjs/edag/rust`, one layer further down.
