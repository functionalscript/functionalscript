## Frame slot node

**Priority:** P3
**Status:** wip — `['frame', N]` landed with the frame operand still an `exp`; `slots[]` is the step left

### Problem

A function's captured values are read through two nodes that together
admit far more than they mean. `['frame']` is a zero-operand binding that
evaluates to the frame array, and a slot is a property access over it,
`['.', ['frame'], i]` — the one shape the compiler's `fn` lowering in
`fjs/compiler/edag` ever emits. The schema knows nothing of that: `.` takes
any `index`, so `['.', ['frame'], 'length']`, the computed
`['.', ['frame'], ['Number', ['arg', 0]]]` and a bare `['frame']` passed on
as a value all validate, and no producer
means any of them. Each consumer then draws the line by hand:

- the serializer in `fjs/compiler/serializer` pattern-matches the slot
  read (`isSlotRead`) to name it, and refuses every other `frame` with
  "the frame outside a slot read";
- the Rust backend in `fjs/edag/rust` clones the whole frame array and
  indexes it through the generic dot operation, with the
  undefined-past-the-end semantics a slot read never needs;
- the memo interpreter and the analysis treat the frame as an ordinary
  array value and the read as an ordinary `.`, so nothing checks that the
  slot exists.

This is the validate-then-reject gap the README's own principle rules out:
where a set of spellings can be cut to one in the schema, the wrong shapes
should be unspellable, not rejected by a pass each consumer remembers to
write. `['arg', N]` already made that cut for fixed parameters — a constant
index in the node, validated by the analysis's `bindingError` against the
owning function's `length`, instead of a `.` over a bare `['args']`. The
frame is the same binding one scope out and has not followed.

The `frame` operand of `['=>', length, frame, body]` has the same gap on the
producing side. It is a general `exp`, so any expression validates as a
frame, but the only one a consumer can index by constant is an array
literal with no spreads — which is what the compiler builds, and `null`
where it would be empty. The serializer's `frameItems` recovers the slots by
checking for the `[]` tag and answers nothing for every other frame.

### Proposal

Make the slot read a leaf binding with its index, and the frame the list of
its slots:

| form | meaning |
|---|---|
| `['=>', length, slots[], body]` | function; `slots` is an array of `exp`, each evaluated in the enclosing scope, `[]` where nothing is captured |
| `['frame', N]` | slot `N` of the owning function's frame |

`['frame', N]` follows `['arg', N]` in every rule: `N` is metadata, not an
operand, canonical (`Number.isInteger(n) && n >= 0 && !Object.is(n, -0)`),
requires a function scope, and is validated against the owning function —
`N < slots.length`, as `arg`'s index is `< length`. A bare `['frame']`
leaves `op0Id` and is no longer a node, so the frame as a whole is not a
value the body can name; nothing produced one, and the serializer refused
it.

`slots[]` is an array operand, like the items of `['[]', items[]]`, and is
not an `exp`: an rtti `Tuple` pins one schema per position, and `array`
says "any number of these" only as its own operand, which is exactly the
shape wanted. A spread is not among its items — a slot count must be known
to validate the reads against. An empty array replaces `null`, removing the
one special case the compiler and the serializer both carry.

Why not stop at `['frame', N]` and keep the frame an `exp`: it closes the
gap on the reading side and leaves it open on the producing side, and the
binding check has nothing to count against unless it looks through the
`[]` tag as the serializer does today. The two halves are one design,
landing as two steps of one stack — the read first, the operand on top of
it — so that each is reviewable on its own. The schema between the two,
with the read indexed and the operand still an `exp`, is a migration step
and not an end state: it is where the executors refuse a slot the frame
lacks at run time, and the second step is what lets the analysis refuse it
before anything runs.

Old tuples are rejected, not reinterpreted, as the README already says of
the previous format change: `['frame']` fails the schema once it leaves
`op0Id`, and a `null` or `['[]', …]` frame fails `slots[]`.

What each consumer becomes:

- **Schema and types** (`fjs/edag`'s `module.f.mjs`, `types.ts`, README):
  a `frame` export beside `arg`, `func` with the array operand, `op0Id`
  without `'frame'`, the node table and the binding rules updated.
- **Analysis**: `'=>'` walks the slots as `'[]'` walks its items, in the
  enclosing scope; `'frame'` joins `'arg'` as a leaf that names no operand;
  `bindingError` checks the index against the owner's slot count.
- **Operations** (`fjs/edag/operations`, the one table both executors
  run): the `'=>'` operation evaluates each slot and passes the list as
  the frame; `frame` reads one entry of it and refuses a slot the frame
  lacks. Amnesia and memo change nothing of their own, and both proofs
  cover the new shapes.
- **Rust backend**: the closure builds the frame from the slot list and
  a read indexes `A::frame(self_)` directly, no dot operation and no
  undefined case; `readsFrame` is unchanged, since the tag is.
- **Compiler lowering**: `fn` already computes the slot list; it emits it
  as the operand and `['frame', i]` for each read, and drops the `null`
  branch.
- **Serializer**: the `frame` case of `entry` names the slot; `isFrame`,
  `isSlotRead` and the `[]` check in `frameItems` go.
- **Demo**: `frame` renders as a terminal like `arg`; the function's
  frame edge becomes one edge per slot.
- Every co-located proof, for the shapes above and for the ones now
  refused.

This breaks the EDAG schema. The pull request declares it under
`Changelog:` with a `**BREAKING CHANGES:**` item and updates every importer
in the same change.

### Tasks

The two halves land as two steps: the slot read first, with the frame
operand still a general `exp`, then the operand.

- [x] Schema: `frame`, `op0Id` without `'frame'`; `types.ts` and the
      README's node table and binding rules.
- [x] Analysis: the leaf case, and `bindingError` refusing a read outside a
      function and an index that is no canonical index.
- [x] The operations, with both executors' proofs — amnesia's and memo's:
      a slot read, and a read past the end refused rather than answered
      with `undefined`.
- [x] Rust backend and its proof: a direct index, `readsFrame` untouched.
- [x] Compiler lowering and serializer, with the slot-read special cases
      removed and their proofs adjusted.
- [x] Demo.
- [ ] Schema: `func` with `slots[]`, `[]` for no captures; `types.ts` and
      the README.
- [ ] Analysis: the walk over the slots, and `bindingError` against the
      slot count, with proofs for an index at, below and past the count.
      `refs` enumerates each slot's edge on its own: `named` reads any
      array as a `['#', i]` reference, so a slot list handed to it whole
      would count one edge where there are several and `places` would
      miss sharing through a slot.
- [ ] The `=>` operation evaluating each slot; the Rust backend's
      `frameExpr` over the list, the "not an array literal" and shared-frame
      refusals gone; the compiler's `fn` emitting the list; the serializer's
      `frameNames` over it, `frameItems` and the `[]` check gone; the demo's
      one edge per slot. The Rust graph walks `operandsOf` and `withBodies`
      descend into the slots themselves, since a slot list is no node, so
      that `readsArgs` sees a capture of `['arg', 0]` and the closure names
      its `args`.
- [ ] Every proof with a `null` frame, and the corpus's own producers in
      [`fjs/nanvm`](../../nanvm/module.f.mjs), `lambdaExp` and
      `functionExp`, which build the smallest closure and a callback's
      function by hand, with the corpus proofs on both executors.
- [ ] `npm run gen`, the full check set, and a `Changelog:` section
      declaring the break.
- [ ] Reconcile every document that still spells the old form as the
      current one, so that nobody builds against it: the captures section
      and the node table of
      [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md),
      the terminal [`graph-visualizer.md`](./graph-visualizer.md) keeps,
      the `frameItems` handling
      [`analysis-consumer-contract.md`](./analysis-consumer-contract.md)
      counts on, the landed stages of
      [`nanvm-lib/todo/callable-function-objects.md`](../../../nanvm-lib/todo/callable-function-objects.md),
      the compiler's `todo/` files that name `['frame']`, and the live
      compiler documentation — [`fjs/compiler/README.md`](../../compiler/README.md)
      and the `AstFrameRef` JSDoc in
      [`fjs/compiler/ast/types.ts`](../../compiler/ast/types.ts).
- [ ] Delete this file.

### Related

- [`../README.md`](../README.md) — the node table this changes, and the
  principle that wrong shapes are unspellable rather than rejected.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — where `['arg', N]` replaced the indexed read of `['args']`, the
  precedent this follows, and where `["frame"]` was written as an array
  read by `[".", ["frame"], i]`.
- [`../../compiler/edag`](../../compiler/edag/module.f.mjs) — `fn`, the
  one producer of frames and slot reads.
- [`../../compiler/serializer`](../../compiler/serializer/module.f.mjs) —
  `isSlotRead` and `frameItems`, the hand-drawn line this removes.
- [`../rust`](../rust/module.f.mjs) — the closure printer and the
  `frame` read.
- [`analysis.md`](./analysis.md) — the analysis whose `bindingError`
  gains the slot-count check.
