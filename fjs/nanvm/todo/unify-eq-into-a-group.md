## unify-eq-into-a-group. Make the `eq` section an ordinary `'==='` group

**Priority:** P4
**Status:** open

### Problem

Every `eq` case in [`module.f.mjs`](../module.f.mjs) already denotes
`['===', a, b]` — `lowerEq` derives exactly that, the proof validates and
evaluates it through the same path as any group's case, and the printer prints
its operands. What is left is a second *shape* for the same thing: `Eq`/
`EqCase` beside `Group2`/`Case<2>`, with `a`/`b` where a group has `args` and
`eq` where it has `expected`, and a `shared`/`ref` pair where a group has
nothing.

So the corpus has one execution path and two authoring shapes. A reader
learning how to add a case has to learn both, and every consumer keeps a
separate `eqFn`/`eqProof` beside its group handling for a difference that is
no longer semantic.

Three things kept the sections apart and still do:

- **`name2`.** An `EqCase` may carry a second name; no `Case<N>` has one, and
  no case in the data uses it either — it is declared and unused.
- **The symmetric check.** `check_eq` in
  [`harness.rs`](../../../nanvm-lib/tests/test/harness.rs) asserts `a == b`
  *and* `b == a`, and the proof evaluates `['===', b, a]` beside the case's own
  expression. `commutative` is the group vocabulary for "also check the
  operands the other way round", but it appends a `Swapped` case rather than
  asserting inside one, so the two are not the same rule.
- **`shared`/`ref`.** Node sharing is spelled by name, and the names are what
  the printer's `let` bindings are called. A group has no such field, so
  unifying means either giving every group one or moving sharing into the
  case.

### Proposal

Fold the section into `{ op: '===', cases: [...] }` once the three are
resolved: drop `name2` (unused), decide whether the symmetric check becomes
`commutative: true` or a property of the `'==='` operation itself, and lift
`shared` to the corpus rather than to the `eq` section. Then `Eq`, `EqCase`,
`LoweredEq`, `lowerEq`, `eqFn`, and `eqProof` all go, and `data` is a list of
groups.

The lowering already treats a `ref` as sharing and both consumers are already
identity-aware — the proof memoizes nodes within a case, the printer emits one
`let` binding cloned at each reference — so this is a data move rather than a
redesign. `arrayByItself` and `objectByItself` must keep meaning "the same
object" through it, which is the one thing to check at each step.

### Tasks

- [ ] Delete `name2`, or give it a meaning and a case that uses it.
- [ ] Decide how the symmetric `b === a` check is spelled for a group.
- [ ] Move `shared` out of `Eq` so a group can carry shared nodes.
- [ ] Fold the cases into a `'==='` `Group2`; delete `Eq`, `EqCase`,
      `LoweredEq`, and `lowerEq` with the consumers' `eq` branches.
- [ ] Regenerate `nanvm-lib/tests/test/generated.rs`, preserving the existing
      test names.
- [ ] `tsc`, `fjs test`, `npm run gen`, `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.

### Related

- [`../README.md`](../README.md) — "The operations come from EDAG": the
  sharing rules this must preserve.
- [`./corpus-as-conformance-vectors.md`](./corpus-as-conformance-vectors.md) —
  the other outstanding corpus work.
