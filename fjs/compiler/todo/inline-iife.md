## Inline a parameterless IIFE, and write a lazy block as one

**Priority:** P2
**Status:** open

### Problem

A `const` is a scope's, and a scope is a module or a function body. A value
used twice inside one arm of a conditional has no scope of its own to be
named in, so JavaScript's idiom for it is a block wrapped in a function that
is called where it stands — an immediately invoked function expression:

```js
const f = () => [1];
export default (...a) => a[0] ? (() => { const x = f(); return [x, x]; })() : 4;
```

The compiler accepts this today. [`../edag/module.f.mjs`](../edag/module.f.mjs)
lowers the arm to `['()', ['=>', 0, frame, body], ['[]', []]]`, a call of a
function literal, with `x` a shared node of that function's body. That is
the source mirrored, and the EDAG's stance is to mirror the source with no
normalization ([edag-stage1-discussion](../../../todo/edag-stage1-discussion.md)).
It costs the graph a function and a call for what is one shared node, and
every consumer pays for the indirection: the memo executor makes a function
and applies it, the Rust output emits one, and the hash of two modules that
differ only in the wrapper differs.

The wrapper is a spelling, not a meaning. Its function is written once and
called once, captures nothing but what the enclosing scope already holds,
and takes no parameters, so nothing observes that a function existed: it
mints no identity anyone can compare, and the body evaluates exactly once,
where the call stands, once per evaluation of the enclosing scope — which
is what the shared node inside the arm means on its own. The
[A4 note](../../../todo/edag-stage1-discussion.md) already grants that
inlining is sound modulo sharing; this is the case where sharing is
preserved by construction, since the frame's slots are substituted by the
enclosing scope's own nodes.

Inlining alone would be a regression, in two writers. Both rely on an
invariant the lowering keeps today and inlining breaks: **a shared node
is reached eagerly from the root of its scope**. The anchoring rule of
[operators](../../../spec/todo/2340-operators.md) guarantees it for
source — a `const` reached only through a lazy edge, a conditional's arm
or the right operand of `&&`, `||` or `??`, is anchored at the scope's
comma root, an eager reach — and inlining is what first puts a shared node
under a lazy edge with no eager path: `x` above, once the arm holds
`[x, x]` directly.

- The FunctionalScript writer in
  [`../serializer/module.f.mjs`](../serializer/module.f.mjs) hoists a
  shared node to a `const` of its scope, and such a node has no eager
  position to hoist to: a `const` before the conditional would evaluate
  `f()` where the source did not. Its leading comment names the case and
  defers it, since today every lazy operator is a node kind it cannot
  spell. It also refuses a comma anywhere but a scope's root, and an
  inlined body whose root is a comma — one with an unused `const`,
  `[(() => { const x = null.x; return 1; })()]` — puts one at an eager
  operand of an array.
- The Rust writer in [`../../edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs)
  refuses outright "a shared node reached only through lazy operands",
  and its `printer` doc says why that is safe today: no scope the lowering
  links has the shape, because `anchors` anchors such a `const` through
  the comma root. So the input above, which it prints today with the call
  inside the function's body, would be refused once the body is inlined.

Inlining makes the shapes reachable, so the change that inlines owes both
writers their handling, in the same pull request, exactly as a feature
adding a node kind owes a writer its case. Reviewing the corpus's
generated Rust is not that: the corpus does not hold every source.

**These are one issue because round-trip is one contract.** The written
IIFE parses as a call of a function literal; only a reader that inlines
reads it back as the shared node under the arm that was written. The
inlining is what makes the writer's spelling read back to the same graph,
and the spelling is what keeps every accepted module writable once the
inlining lands. Either half alone breaks
`source → EDAG → source → EDAG` yielding the same graph, which is the
round-trip the writer promises: the same graph, not the same text.

### Proposal

**Lowering.** In [`../edag/module.f.mjs`](../edag/module.f.mjs), a call
whose callee is a function literal written at that call and nowhere else,
of length zero, whose body reads no `rest`, and whose argument list is the
empty array literal, lowers to the callee's body with each read of a frame
slot replaced by the operand the frame held there. Every other call stays a
call. The conditions are the whole soundness argument:

- **No parameters, no `rest`.** A parameter would need an argument to
  substitute, and an argument list that is not the empty literal would need
  its own evaluation kept — `(() => 1)(null.x)` throws in JavaScript — so
  the rule stops at the case where nothing is passed and nothing could be
  read. `() => …` and `(...a) => …` are the one node
  ([spec: functions](../../../spec/README.md#functions)), so the test is
  on the body's reads, not on the spelling.
- **The literal is the call's alone.** A function reached from anywhere else
  is a value someone may compare or call again; inlining would change what
  they see.
- **Slots substitute the enclosing scope's nodes.** The frame is an array
  literal of operands the enclosing scope already holds, so a slot read
  becomes that operand — the same node, sharing intact. A frame that is not
  such a literal is not inlined.

The body's own shared nodes join the enclosing function's scope, which the
analysis in [`../../edag/analysis/module.f.mjs`](../../edag/analysis/module.f.mjs)
scopes per function.

**Block roots.** The invariant the writers rely on is restated one level
finer. A *block root* is a scope's root or a lazy operand — the positions
JavaScript can open a block at, and the ones a Rust thunk's closure
already does. After inlining, **every shared node is reached eagerly from
its nearest block root, and a comma stands only at a block root**. The
lowering keeps that in one move: the anchors of an inlined body's comma
root — its unused `const`s — join the nearest enclosing block root's, as
operands of its comma, which the anchoring rule already allows: an anchor
is evaluated eagerly wherever it stands under that root, and under the
opaque-error contract (A4) its place among the root's eager evaluations
is unobservable. So `[(() => { const x = null.x; return 1; })()]` at a
module's root lowers to the module's comma anchoring `null.x` before
`['[]', [1]]`, and the same IIFE in a conditional's arm lowers to a comma
at the arm. An inlined body whose shared nodes sit under the body's own
lazy edges is already anchored at its root by the body's own lowering, so
it needs nothing more.

**Writing.** In [`../serializer/module.f.mjs`](../serializer/module.f.mjs),
a scope's hoists are today one block, the scope's own `const`s before its
`export default` or `return`. A lazy operand that needs a block gets one:
the operand is written as an IIFE, `(()=>{const …;return …;})()`, whose
statements are the operand's comma anchors, if it is a comma, and the
`const`s of the shared nodes reached only from under that operand, and
whose `return` is the operand's value. The writer's "one scope, one block"
becomes "one block per block root that needs one", nested where lazy
operands nest. A block with nothing to hold is not written; the operand
stays in place, and the text stays what it is today.

**Rust.** [`../../edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs)
already gives each lazy operand a block — its thunk's closure binds the
temporaries only it reaches — so its refusal narrows from the scope to the
block root: a shared node reached eagerly from the thunk's root binds in
the thunk's block, and only a node no block root reaches eagerly, which
the invariant excludes, stays refused. A comma at a thunk's root is one
the writer prints already, its anchors as `_` temporaries.

The block's `const`s are named in the writer's scheme, which derives a
body's names from its parameter; a parameterless block has none, so the
scheme needs a name for the block's scope that no enclosing scope spells.

**What a `const` is for widens.** The writer hoists identity-minting nodes,
`[]`, `{}`, `=>`, and writes a merged access in place at each occurrence. A
call is neither: the analysis does not merge it, and writing `f()` twice
calls twice, which `[x, x]` above observes through the identity of what
`f` returned. So a shared call is hoisted as an array is. That is
[call-spelling](../serializer/todo/call-spelling.md)'s to state when it
gives `()` a spelling, and this issue's example depends on it.

**Round-trip is graph identity, not text identity.** The source is not
reproduced; the graph is. `export default (() => [1, 2])();` lowers to
`['[]', [1, 2]]` and is written back as `export default [1,2];`, with no
IIFE, since nothing in it is shared; and the block the writer does emit
carries the writer's names, not the source's. What the round-trip
promises is that reading the written text yields the graph that was
written — `source → EDAG → source → EDAG`, the same EDAG at both ends —
which is the contract the writer already keeps for `-1`, folded to a
number and written as one, and for a body `const` renamed in the block.

**Hash.** Every module holding a parameterless IIFE lowers to a different
graph after this change, so its hash changes. That is the intended effect,
since the two spellings denote one meaning, and the same kind of change as
folding `-1`.

### Tasks

- [ ] Lowering: inline a call meeting the conditions above, an inlined
      body's anchors joining the nearest block root's; proofs that a call
      missing any one of the conditions stays a call, that a slot read
      substitutes the enclosing node by identity, and that the block-root
      invariant holds for an IIFE at an eager operand, at a lazy one, and
      nested in either, with and without anchors.
- [ ] FunctionalScript writer: a block at a lazy operand that is a comma or
      holds a node shared only under it; proofs that each shape above
      round-trips through `fjsRoundTrip` in
      [`../proof.f.mjs`](../proof.f.mjs) to the same graph, nested lazy
      operands included.
- [ ] Rust writer: the lazy-only refusal taken per block root; proofs, in
      `fjs/edag/rust`'s own and through `fjs compile` to `.rs`, that every
      shape above prints, the motivating input among them, and that a node
      no block root reaches eagerly is still refused.
- [ ] Remove the FunctionalScript writer's leading-comment deferral of the
      lazy-edge case and the Rust writer's `printer` doc's reliance on the
      scope-level invariant, and update
      [`spec/README.md`](../../../spec/README.md#functions) with the two
      facts a reader needs: a parameterless IIFE denotes its body, and a
      lazy operand may be written as one.
- [ ] `npm run gen`; `tsc`, `fjs test`, `node --test`, `cargo test` over the
      regenerated corpus.

### Related

- [stage-a-operators](../serializer/todo/stage-a-operators.md) — the
  writer's spelling for `?:`, `&&`, `||`, `??`; this issue's writer half is
  reachable only once a lazy operand can be written at all.
- [call-spelling](../serializer/todo/call-spelling.md) — the `()` spelling,
  and where a shared call joins the hoisted kinds.
- [operators](../../../spec/todo/2340-operators.md) — the anchoring rule
  and its lazy positions.
- [edag-stage1-discussion](../../../todo/edag-stage1-discussion.md) — the
  no-normalization stance this issue makes one deliberate exception to, and
  the A4 note that allows it.
- [`../../edag/README.md`](../../edag/README.md) — the `=>`, `()` and
  `frame` nodes.
- [`../../edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs) — the
  thunk blocks and the lazy-only refusal its `printer` doc explains.
