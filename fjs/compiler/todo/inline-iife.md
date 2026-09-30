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

Inlining alone would be a regression. The FunctionalScript writer in
[`../serializer/module.f.mjs`](../serializer/module.f.mjs) hoists a shared
node to a `const` of its scope, and a node reached only through a lazy edge
— a conditional's arm, the right operand of `&&`, `||` or `??` — has no
eager position to hoist to: a `const` before the conditional would evaluate
`f()` where the source did not. The writer's leading comment names the case
and defers it, since today every lazy operator is a node kind it cannot
spell, and since without inlining the case cannot arise from source at all
— the anchoring rule of [operators](../../../spec/todo/2340-operators.md)
keeps every source `const` reachable eagerly. Inlining is what makes the
shape reachable, so the change that inlines owes the spelling, in the same
pull request, exactly as a feature adding a node kind owes the writer its
case.

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
scopes per function. A shared node then sits under a lazy edge, or under an
eager one, and the anchoring rule applies to it as to any node.

**Writing.** In [`../serializer/module.f.mjs`](../serializer/module.f.mjs),
a scope's hoists are today one block, the scope's own `const`s before its
`export default` or `return`. A shared node that no eager position of the
scope reaches, and that a lazy operand does, is hoisted instead into a
block opened at that operand: the operand is written as an IIFE,
`(()=>{const …;return …;})()`, whose `const`s are the nodes reached only
from under that operand, and whose `return` is the operand. The writer's
"one scope, one block" becomes "one block per lazy operand that needs one",
nested where lazy operands nest. A block with no `const` to hold is not
written; the operand stays in place, and the text stays what it is today.

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

**Hash.** Every module holding a parameterless IIFE lowers to a different
graph after this change, so its hash changes. That is the intended effect,
since the two spellings denote one meaning, and the same kind of change as
folding `-1`.

### Tasks

- [ ] Lowering: inline a call meeting the conditions above; proofs that a
      call missing any one of them stays a call, and that a slot read
      substitutes the enclosing node by identity.
- [ ] Writer: hoist a shared node reached only through lazy edges into an
      IIFE block at the outermost lazy operand that reaches every eager path
      to it; proofs that the block round-trips through `fjsRoundTrip` in
      [`../proof.f.mjs`](../proof.f.mjs) to the same graph, nested lazy
      operands included.
- [ ] Remove the writer's leading-comment deferral of the lazy-edge case,
      and update [`spec/README.md`](../../../spec/README.md#functions) with
      the two facts a reader needs: a parameterless IIFE denotes its body,
      and a lazy operand may be written as one.
- [ ] `npm run gen`; `tsc`, `fjs test`, `node --test`; generated Rust of the
      corpus reviewed for the modules whose graph changed.

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
