## reuse-edag-operators. Reuse the canonical EDAG operator format in NaNVM

**Priority:** P3
**Status:** open

**Blocked by:** [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)

### Problem

`fjs/nanvm/` has a shared operator corpus that is consumed by both the
JavaScript proof and the Rust test generator. Today it identifies operations with a
NaNVM-specific vocabulary:

```ts
export type Op = 'unaryPlus' | 'unaryMinus' | 'mul' | 'stringCoercion'
```

A related TODO, [`operator-test-operation-model.md`](../../../nanvm-lib/todo/operator-test-operation-model.md),
proposes improving this by introducing another semantic operation descriptor such as:

```ts
readonly ['+', 1]
readonly ['-', 1]
readonly ['*', 2]
```

That fixes the current implementation-style names and exposes arity, but EDAG is now
becoming the canonical FunctionalScript computation representation and already needs to
own exactly this information: the operator spelling and the shape/arity of its operands.
NaNVM should not define a second semantic operator format that can drift from EDAG.

For example, EDAG distinguishes unary and binary operators by the canonical tagged-array
shape itself:

```js
['-', a]
['-', a, b]
['*', a, b]
['===', a, b]
```

If EDAG later changes an operator spelling, operand shape, or validation rule, the
NaNVM corpus should consume that change through the shared EDAG definition rather than
requiring a parallel edit to a local `Op`/`Operation` model.

### Proposal

Make the canonical EDAG operation definitions in `fjs/edag/` the single source of truth
for operator identity and operand shape, and make `fjs/nanvm/` reuse them.

The exact exported EDAG API should be chosen by the EDAG implementation; this TODO does
not introduce a second wrapper merely to prescribe names. Conceptually, NaNVM should be
able to express a group as "cases for this canonical EDAG operation" and derive the
required argument tuple from that operation's EDAG schema.

For example, instead of locally declaring that multiplication is `['*', 2]`, the corpus
should refer to the EDAG definition for:

```js
['*', left, right]
```

and derive that its case arguments are a two-element tuple. Unary `-` (negation) and
binary `-` (subtraction) remain distinct because their EDAG operation shapes have
different arities; NaNVM does not need a second disambiguation scheme. (The EDAG has no
unary `+` — see `edag-stage1-discussion.md`'s "Operators" table — so NaNVM's own
`unaryPlus` op, if kept, has no EDAG operation to derive its shape from.)

This does **not** mean the NaNVM corpus becomes an EDAG program or that all test values
must be encoded as EDAG nodes. The corpus still owns test-only data such as:

- case names used as stable proof/test diagnostics;
- concrete input values and expected values;
- `throws`, `ref`, and other test-only markers;
- `rust` gap/reason metadata;
- commutative-case expansion.

Only the **semantic operation identity and operand contract** come from EDAG.

The JavaScript proof and Rust generator remain consumers. They map a canonical EDAG
operation to the corresponding host implementation:

```text
EDAG operation
  -> JavaScript operator/expression used by proof.f.mjs
  -> Rust operation/function used by rust/module.f.mjs
```

Backend names are not EDAG names. In particular, Rust identifiers such as a helper
function name remain local to the Rust generator rather than leaking back into the
shared corpus.

### Operations not yet present in EDAG

Some current NaNVM corpus operations may not yet have a canonical EDAG operation. For
example, the current `stringCoercion` group should not cause `fjs/nanvm/` to invent a
permanent EDAG spelling independently.

When this happens, either:

1. define the operation in the canonical EDAG vocabulary first, if it belongs there; or
2. keep the NaNVM case explicitly outside the EDAG-backed groups until the EDAG design
   reaches it.

The temporary exception must be visible in the type/data model. Do not silently mix
EDAG-backed operations and NaNVM-only semantic names into one supposedly canonical
operation type.

### Relationship to `operator-test-operation-model.md`

[`nanvm-lib/todo/operator-test-operation-model.md`](../../../nanvm-lib/todo/operator-test-operation-model.md)
contains useful requirements that still apply:

- semantic operator spellings instead of implementation names;
- arity-aware case types;
- wrong argument counts rejected statically;
- consumer-owned mapping to JavaScript/Rust implementations;
- stable case names and explicit `Swapped` diagnostics.

However, its proposed local `readonly [name, argsN]` operation model should be replaced
by reuse of the EDAG operation definition once `fjs/edag/` exposes it. There should be
one semantic operation vocabulary, not an EDAG vocabulary plus a nearly identical
NaNVM vocabulary.

### Tasks

- [ ] Once `fjs/edag/` exposes canonical operation definitions, import/reuse those
      definitions from `fjs/nanvm/`; do not duplicate EDAG operator spellings or arities.
- [ ] Remove the local semantic `Op` union from `fjs/nanvm/types.ts` for EDAG-backed
      operations.
- [ ] Make NaNVM operator groups reference the canonical EDAG operation definition and
      derive their case argument tuple/arity from its operand schema.
- [ ] Preserve NaNVM-only test metadata (`name`, `expected`, `rust`, `commutative`, and
      special test markers) outside the EDAG model.
- [ ] Update `fjs/nanvm/module.f.mjs` to use EDAG operator spellings/shapes rather than
      implementation-style names such as `unaryPlus`, `unaryMinus`, and `mul`.
- [ ] Update `fjs/nanvm/proof.f.mjs` to dispatch from canonical EDAG operations to the
      corresponding JavaScript expressions.
- [ ] Update `fjs/nanvm/rust/module.f.mjs` to map canonical EDAG operations to Rust
      expressions/function names without putting Rust naming into EDAG or the corpus.
- [ ] Keep operations that have no canonical EDAG representation explicitly separate;
      either add them to EDAG first or defer their migration.
- [ ] Fold the applicable requirements from
      `nanvm-lib/todo/operator-test-operation-model.md` into this shared-EDAG model rather
      than implementing its independent `[name, argsN]` format.
- [ ] Add type-level proofs that invalid operand counts are rejected through the EDAG
      operation schema.
- [ ] Add a coupling proof/test so an incompatible change to an EDAG operator shape
      fails NaNVM type-checking instead of silently leaving the corpus stale.
- [ ] Regenerate `nanvm-lib/tests/test/generated.rs` and preserve existing test
      semantics/coverage.
- [ ] `npx tsc`, `fjs test`, `npm run ci-update`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  — introduces the canonical EDAG model consumed by DJS and this task.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — canonical EDAG operation vocabulary and semantics.
- [`../../../todo/edag-spec.md`](../../../todo/edag-spec.md) — eventual distilled EDAG
  specification.
- [`../../../nanvm-lib/todo/operator-test-operation-model.md`](../../../nanvm-lib/todo/operator-test-operation-model.md)
  — existing NaNVM operator-corpus redesign whose local operation descriptor should be
  replaced by EDAG reuse.
- [`./corpus-eliminators.md`](./corpus-eliminators.md) — deduplicates test-corpus
  eliminator rules used by the same JavaScript and Rust consumers.
