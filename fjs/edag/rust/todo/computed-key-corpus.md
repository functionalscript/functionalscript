## Computed keys in corpus expressions

**Priority:** P3
**Status:** open

### Problem

`nodeExpr(['{}', [[':', ['undefined'], 1]]])` used to accept a computed
object key and emit `spread_object([computed_item(...)?])`. The corpus's
`run` returns `()`, so the `?` cannot propagate there; the object is also
an `Any` where `check` expects a `Result`. `nestsOperation` does not route
this construction through the corpus's `scope` helper.

`nodeExpr` and `expExpr` now refuse computed-key object construction in
corpus mode. `scope` and `statementsOf` still support it inside a
Result-returning body, as compiled modules require. The current shared
corpus does not produce computed-key objects, so its existing cases are
unaffected.

### Tasks

- [ ] Define how corpus cases and shared-value initializers handle computed
      key conversion before relaxing the refusal.
- [ ] Compile and run generated corpus cases for successful and throwing
      conversions, including nested operands and lazy branches. Preserve
      operand evaluation and key-conversion order.

### Related

- [Rust printer](../module.f.mjs) — `expExpr`, `scope`, `nestsOperation`.
- [Corpus generator](../../../nanvm/rust/module.f.mjs) — `caseText`, `groupFile`.
- [PR review](https://github.com/functionalscript/functionalscript/pull/2528#discussion_r4174133383).
