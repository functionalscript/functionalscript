## Stack-safe validation of recursive schemas

**Priority:** P2
**Status:** open

### Problem

`validate` and `parse` terminate on a recursive schema — they instantiate a
container's item walker only after finding the container non-empty — but they
still spend call-stack frames in proportion to the **input's** nesting depth,
not the schema's. For a recursive schema the input's depth is unbounded and
attacker-controlled, so a modest payload overflows the stack and **throws**,
escaping the `Result` contract every caller relies on.

Measured with the recursive schema `lock = () => ['record', or(hash, lock)]`
that `fjs/media/revision` originally used: a value nested 2000 deep — about
12 KiB of JSON — raises `RangeError: Maximum call stack size exceeded` inside
`decodeText`. That is far below the 128 KiB inline-content cap, so nothing
upstream rejects it first.

It escalates because a validator is used to *classify* untrusted bytes.
`fjs/cas/evo`'s `buildCache` decodes every blob in the store to find revisions;
a blob is meant to be skipped when it fails to validate, but a throw is not a
failure to validate. One such blob stored through `cas_add` therefore aborts the
scan and stops the MCP server from starting, instead of being ignored as a
non-revision. FunctionalScript has no `try`/`catch`, so no caller can contain it.

`fjs/media/revision` works around this today: its `lock` field is `unknown` at
the rtti level and a hand-written iterative walk (`checkLock`) validates the
shape at any depth. That is a workaround for one field, not a fix — it costs
the field its machine-readable schema, and every future recursive schema has
the same problem.

### Proposal

Make the shared walk iterative so depth costs heap, not stack.

`visit` in [common](../common/module.f.ts) dispatches, and `eachEntry` is the
container loop both consumers share; the recursion is in each consumer calling
itself per nested value. Replace it with an explicit work list — the same
transformation `fjs/media/json`'s `parse` took in
[#1435](https://github.com/functionalscript/functionalscript/pull/1435), and the
one `checkLock` already demonstrates in miniature: process one level at a time,
carrying the path for error reporting.

The awkward part is `or`: `orVisit` tries each variant and keeps the first
success, which is a backtracking search rather than a straight fold, so the
work list has to carry alternatives rather than a single pending value. Getting
that right is most of the work.

Once this lands, `fjs/media/revision` restores
`lock = () => ['record', or(hash, lock)]` as the field's real schema and deletes
`checkLock`'s structural half, keeping only the leaf `isHash` refinement.

### Tasks

- [ ] Convert `validate` to an explicit work list, including `or` backtracking.
- [ ] Do the same for `parse`, which rebuilds values and must preserve order.
- [ ] Prove a recursive schema validates at a depth that overflows today
      (≥ 20000), and that an invalid value at that depth returns an error
      rather than throwing.
- [ ] Restore `fjs/media/revision`'s recursive `lock` schema and reduce
      `checkLock` to the leaf refinement.

### Related

- [fjs/media/revision/module.f.ts](../../../media/revision/module.f.ts) — the
  `lock` field, the workaround, and the measurements above
- [fjs/media/json stringify-deep-nesting](../../../media/json/todo/stringify-deep-nesting.md)
  — the mirror-image limit on the way out
- [data-form](./data-form.md) — a separate depth problem in the same ADT:
  emitting a *schema* that is cyclic, rather than validating a deep *value*
