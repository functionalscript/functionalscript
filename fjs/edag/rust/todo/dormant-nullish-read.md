## A provably nullish read inside a lazy operand is refused

**Priority:** P4
**Status:** open

### Problem

The printer in [`module.f.mjs`](../module.f.mjs) refuses a `.` read whose
base is provably nullish — `null.a`, `{}.missing.x` — because printing
`Any::member_access(…)` for it would compile to a run-time throw where
every other output of `fjs compile` gives the same program a compile-time
refusal (`nullishBase`, `resolvedBase`). The check runs wherever the read
is printed, a lazy operand included: `false && null.a` is refused as a
module, though JavaScript never establishes the read and answers `false`.
The `unreached` operand of the corpus shows the same position holding an
operation that throws only when established, and printing fine.

Refusing is loud, not wrong: no program is compiled to a value it does not
have. It is also unreachable from source today — the grammar has none of
the four lazy operators until
[Stage B](../../../fsc/todo/stage-b-operators.md) — and a program that
writes a provably nullish read into a dormant operand is one no data
module has a reason to write.

### Proposal

Decide it with Stage B, against what the other outputs do for the same
program: if `.json` answers `false` for `false && null.a`, so should `.rs`,
and the thunk prints the read as any other operation — it throws only
when established, which is what a thunk is for. The change would be a
`dormant` mode of {@link printer}, or the nullish check lifted out of
`bare` into the eager positions alone. If the other outputs refuse the
program, this one stays as it is, and this file records why.

### Tasks

- [ ] Once Stage B produces the nodes, compare `.json` and `.rs` on
      `false && null.a` and a `?:` with a nullish read in the unselected
      arm.
- [ ] Either print the dormant read inside the thunk, with proofs in
      [`proof.f.mjs`](../proof.f.mjs) and `fjs/fsc/rust/proof.f.mjs`, or
      record the refusal as the decision in `fjs/fsc/README.md`.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `nullishBase`, the refusal, and
  `thunk`, the lazy position it runs in.
- [`../../../fsc/todo/stage-b-operators.md`](../../../fsc/todo/stage-b-operators.md)
  — the front end that makes the shape reachable from source.
