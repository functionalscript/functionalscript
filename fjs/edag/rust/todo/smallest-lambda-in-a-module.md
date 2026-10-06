## smallest-lambda-in-a-module. A compiled `() => undefined` calls the corpus harness's `function_any`

**Priority:** P2
**Status:** wip

### Problem

The printer prints the function `() => undefined` — no parameters, no
frame, an `undefined` body, what `isSmallestLambda` tests — as
`function_any()` in either mode. That name is the corpus harness's
(`nanvm-lib/tests/test/harness.rs`), not `nanvm_lib`'s, so it is right for
the operator corpus and wrong for `fjs compile`'s `.rs` output, which has no
harness. A module exporting the function:

```js
export default () => undefined
```

compiles without complaint to Rust that does not build: `function_any` is
never imported, and nothing could import it, and the module's bound is
`IVm`, since `holdsFunction` leaves the same shape out, where building any
function needs `IStaticFunction`. Neither side refuses: the compiler answers
text that looks like Rust and is not, which is the silence
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
rules out.

### Proposal

Make `function_any()` the corpus's spelling alone. Outside the corpus's
mode, `() => undefined` is a closure like any other function — its text
`Some("()=>undefined")` — and `holdsFunction` counts it, so a module holding
one bounds on `IStaticFunction`.

### Tasks

- [ ] Print `() => undefined` as a closure outside the corpus's mode, and
      have `holdsFunction` count it.
- [ ] A `nanvm-harness` fixture exporting `() => undefined`.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `isSmallestLambda`, `atomic`,
  `holdsFunction`.
