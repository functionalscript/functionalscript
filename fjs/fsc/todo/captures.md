## Captures: a function body names what is declared outside it

**Priority:** P1
**Status:** open

### Problem

FunctionalScript is a subset of JavaScript, and a JavaScript arrow
function closes over the scope it is written in. This compiler's parser
restricts that: a function body may name its own parameter and its own
`const`s and nothing else, and a reference to a module `const`, an import
or an enclosing function's parameter is refused where it is written —
`capture not supported` in [`parser/module.f.mjs`](../parser/module.f.mjs),
the rule [`spec/README.md`](../../../spec/README.md) states under
Functions and [`README.md`](../README.md) restates for the AST. So
`(...a) => (...b) => a[0] + b[0]` does not compile, and neither does any
function that uses a helper declared beside it.

A restriction on JavaScript needs a justification
([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)),
and this one's is gone. It was refused because a function had no frame to
capture with; the EDAG has the frame now, and so does the VM:

- `['=>', frame, body]` builds a function from a frame evaluated in the
  enclosing scope, and `['frame']` is that array inside the body, a slot
  ordinary indexing, `['.', ['frame'], i]`, exactly as an argument is
  `['.', ['args'], 0]` — the closed-scope model of
  [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md),
  implemented and proved in [`fjs/edag`](../../edag/README.md).
- `A::static_function(code, length, frame)` takes the frame, and
  `A::frame(self_)` reads it in the body
  ([`nanvm-lib/todo/callable-function-objects.md`](../../../nanvm-lib/todo/callable-function-objects.md),
  Stage 3, whose front end this is).

What is missing is the front end and the two outputs: the parser, the
AST, the lowering in [`edag/module.f.mjs`](../edag/module.f.mjs), the
printer in [`fjs/edag/rust`](../../edag/rust/module.f.mjs), which prints
a `null` frame and refuses any other, and the FunctionalScript serializer
in [`serializer/module.f.mjs`](../serializer/module.f.mjs), which refuses
the same.

It is also the restriction on the critical path. The post-MVP milestone is
self-hosting ([`nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)):
the compiler, written in FunctionalScript, compiled by itself to Rust.
The compiler's source is curried functions over module `const`s on nearly
every line, and none of it compiles while a capture is refused.

### Direction

**A function's frame is the array of the values its body names from
outside, built where the function is written.** The parser resolves a
word the body does not bind as it resolves one the body binds — against
the scopes around it, innermost first — and where it finds it outside the
body, the word is a capture: one slot of the function's frame, however
many references reach it. The function node then carries what it
captures, in the order of first use, and a reference to a capture names
its slot. The lowering emits `['=>', ['[]', [c0, c1, …]], body]`, each
`ci` the enclosing scope's own node for the captured value — a module
`const`, an import, an argument read, a slot of the enclosing function's
own frame — and inside the body a capture is `['.', ['frame'], i]`. A
capture whose node is a primitive — an import whose default export is
one, once the linker has put the module's node in its place — is not
captured: it is written into the body as the primitive itself, the
substitution the parser already makes for a `const` holding a literal,
since a primitive has nothing to share and nothing to compute. A frame
holds nodes with identity or computation alone.

That is JavaScript's closure by value, which is what a closure over
`const`s is: nothing here mutates, so copying the value at creation is
unobservable, and it is the scheme
[`spec/todo/3111-function-frame.md`](../../../spec/todo/3111-function-frame.md)
chose. A nested function captures through its parent: in
`(...a) => (...b) => (...c) => a` the middle function's frame is `[a]` and
the innermost's is `[frame[0]]`, built in the middle body. Sharing stays
what it is: the
frame is an operand in the enclosing scope, so an enclosing node reaching
it is shared as any operand is, and the body remains a closed graph whose
leaves are constants, `['args']` and `['frame']` — nothing crosses the
function boundary but through the frame, which is what keeps the analysis
in [`fjs/edag/analysis`](../../edag/analysis/) and the printer's scope rule
sound.

The printer prints a non-`null` frame as the third argument of
`A::static_function`, and `['frame']` as the value `A::frame(self_)`
holds, the way `['args']` prints the value `args` holds; a body that
reads its frame names `self_` as one that reads its arguments names
`args`.

The FunctionalScript output, [`serializer/module.f.mjs`](../serializer/module.f.mjs),
writes a function with a frame as JavaScript writes a closure: an arrow
function whose body names its captures. Each frame element takes a
`const` in the enclosing scope, as the writer already hoists a shared
value, and a frame read `['.', ['frame'], i]` is written as that name:

```js
const $0 = [1];
const $1 = (...$a) => [$0, $a[0]];
```

Read back, the body's outside names are captures in first-use order, so
the frame comes back with the same elements in the same order, and the
output round-trips as the writer's contract asks. A frame element always
takes a `const`, even one the writer would otherwise write in place: a
capture is a name, and `$a[0]` as an operand would read back as a capture
of `$a`. The frame's order is the body's first-use order, which the
lowering defines, so the writer reproduces it by construction. A frame
the parser would not have built — a slot out of the body's first-use
order, a slot the body never reads, a slot holding a primitive, which the
parser inlines — has no text that reads back as the same graph, and the
writer refuses it by name, as it refuses every shape it has no faithful
text for; the compiler never builds one. Today the serializer refuses
every frame, `a function with a frame`.

The spec's sentence that a capture is an error is replaced by the rule
above in the same pull request that lifts the refusal.

How the parser threads scopes, what the AST calls a frame reference, and
how the printer binds the frame are the implementation's to decide and
its proofs to pin.

### Not here

- `['self']`, recursion: Stage 5 of callable-function-objects. A function
  that names itself is still a capture of its own `const`, which is a
  cycle the frame cannot hold by value, and stays refused until then.
- Named parameters: a function still has one rest parameter or none.
- Any change to the EDAG: the shape is the one already decided.

### Tasks

- [ ] Printer: a non-`null` frame and `['frame']` print; proofs at the
      printer level.
- [ ] Serializer: a function with a frame is written as a closure over
      `const`s, one per frame element; proofs, and the output round-tripped
      through the parser once it admits captures.
- [ ] Parser, AST, lowering: a capture is a frame slot, not an error; the
      spec's rule updated; proofs.
- [ ] Harness fixture `(...a) => (...b) => a[0] + b[0]` end to end — the
      language's one parameter is a rest parameter, so that is the
      spelling — Stage 3 ticked.

### Related

- [`nanvm-lib/todo/callable-function-objects.md`](../../../nanvm-lib/todo/callable-function-objects.md)
  — Stage 3, which this is the front end of.
- [`spec/todo/3111-function-frame.md`](../../../spec/todo/3111-function-frame.md)
  — the frame as a copied block of captured values.
- [`todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — `["frame"]` and the closed-scope model.
- [`nanvm-lib/todo/mvp-roadmap.md`](../../../nanvm-lib/todo/mvp-roadmap.md)
  — self-hosting, the milestone this unblocks.
