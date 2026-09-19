## Compile non-capturing functions to Rust

**Priority:** P2
**Status:** open

### Problem

[callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md)
lays out an eight-stage plan for making `Function<A>` values callable, backed
by Rust code `fjs compile` generates. Its Stage 1 is one paragraph: "extend
the Rust code generator to emit a real `fn` body… Call sites where the callee
is known at compile time… compile to a direct Rust call." This document is
that paragraph worked out against the actual generator, corrected against
what it turns out to already do (and not do), and broken into concrete,
independently landable tasks.

**The starting-point description in the existing `todo/` record is wrong in
one load-bearing way, worth fixing before anything else is built on it.**
[`fjs-nanvm-integration.md`](../../../todo/fjs-nanvm-integration.md) and a
comment in the printer itself both describe the generator as already
accepting one specific closure shape — `() => undefined` — and refusing every
other one. That acceptance is dead code. The check
(`isSmallestLambda` in
[`fjs/edag/rust/module.f.mjs`](../../edag/rust/module.f.mjs)) matches a `=>`
node whose frame is the array `['[]', []]`. But the real lowering, `lower`'s
`case '=>':` in
[`fjs/fsc/edag/module.f.mjs`](../edag/module.f.mjs), always produces the bare
primitive `null` for a Stage 2 function's frame — never an array — matching
what [`fjs/fsc/README.md`](../README.md) documents as the canonical shape:
*"A function is `['=>', null, body]`."* `null instanceof Array` is `false`,
so `isSmallestLambda` is `false` for every function the compiler can
currently produce, `() => undefined` included. Compiling
`export default () => undefined;` today produces the EDAG
`["=>",null,["undefined"]]` and then fails `.rs` generation with
`no Rust for: =>,,undefined` — confirmed by running the actual CLI. So there
is no working closure support to extend; Stage 1 starts from zero, and the
first task below is recognizing the shape the compiler actually emits.

**Four refusal points, each with an exact cause:**

1. **`=>` itself.** Beyond the dead `isSmallestLambda` check, above.
2. **`()`, a call.** `['()', callee, args]` has no entry in any of `expExpr`'s
   `op1`/`op2`/`op3` operator tables, so it falls through to `lookup`'s
   generic `error(['no Rust for', id])` — the same refusal an unrecognized
   operator id gets. Confirmed: compiling
   `const f = (...a) => a[0]; export default f(41);` (which lowers cleanly to
   `["()",["=>",null,[".",["args"],0]],["[]",[41]]]`) fails with
   `no Rust for: ()`.
3. **`args` and `frame`**, standing alone as a value (not indexed). Same
   mechanism: `op0Id`'s tags have no operator-table entries either, so a bare
   `['args']` node is refused the same way. Confirmed:
   `export default (...a) => [a[0], a[0]];` fails with `no Rust for: args`
   (reached while printing the identity read `a[0]`, i.e. `.` on `args`, not
   the array wrapper — see next point).
4. **A numeric index on `.`.** `indexExpr` in `fjs/edag/rust/module.f.mjs`
   accepts only a string index and refuses every numeric one, by design:
   `Any::own_property` only ever inspects `Unpacked::Object`, so a numeric
   index — meaningful only for an array or string receiver — would either
   have to be printed wrong (silently `undefined`) or refused, and the
   printer refuses it, deferring to
   [`fjs/edag/todo/entry.md`](../../edag/todo/entry.md)'s future general
   fix. `[".", ["args"], 0]` is exactly this shape: a `.` node with a numeric
   index. Its base, `['args']`, is *not* separately refused —
   `nonObjectLiteralBase` only recognizes primitive/array-literal bases, and
   `['args']` is neither, so it is treated as an ordinary opaque base — the
   numeric index is the only thing standing in the way.

**A fifth problem is latent, not yet triggered by anything the printer
accepts today, but load-bearing the moment functions exist: node-sharing is
not scope-aware.** `sharedNodesOf` (`fjs/edag/rust/module.f.mjs`) is a plain
identity-based walk with no concept of a function boundary — it recurses
into a `=>` node's `body` exactly like any other operand, and
`bodyLines` (`fjs/fsc/rust/module.f.mjs`) turns every node it finds reached
twice into one flat, module-level `let cN: Any<A> = …;` regardless of where
in the graph the two references live. The moment a shared node inside a
function body exists, this is wrong twice over: the `let` would be emitted
at module scope, where `args` (which such a node might well reference) does
not exist, and if the *same* node happened to be reachable from two
*different* functions — which validation forbids, see below — a single
`let` would be shared across two Rust functions that have no such binding in
common. This is not a hypothetical shape to guard against speculatively:
[spec/README.md](../../../spec/README.md#functions) gives internal sharing
inside a function body as one of today's own accepted-language examples —
`(...args) => { const first = args[0]; const pair = [first, first]; return
[pair, pair]; }` — so Stage 1 must get this right to compile its own
canonical fixture, not as a later refinement.

The fix is smaller than it sounds, and existing machinery already carries
half of it. `fjs/fsc/rust/module.f.mjs` already imports `analysis` from
[`fjs/edag/analysis/module.f.mjs`](../../edag/analysis/module.f.mjs) — today
for exactly one unrelated check (`bodyLines` refuses a module containing a
lingering unary negation via `analysis(root).nodes.some(negation)`).
`analysis`'s own walk already tags every node with the scope it belongs to,
and its documented invariant — *"a node reached from two scopes, which the
compiler never emits and the EDAG's scope rule forbids, throws where it is
met"* — is exactly the guarantee Stage 1 needs. It means the *printer* does
not need to re-derive scope correctness from scratch: validated input is
already guaranteed to never share a node across a function boundary. What
the printer's own `sharedNodesOf`/`bodyLines` pair needs is much narrower —
stop its own walk from recursing *into* a `=>` node's `body` when computing
one scope's sharing, so a function's interior is computed as its own,
separate pass. See Task 4.

### Scope

**In scope**, precisely:

- A function with no captures: its lowered frame is exactly the primitive
  `null` — the only shape `fjs/fsc/edag`'s current lowering ever produces
  for a Stage 2 arrow function, per the "Problem" section above.
- A function body built from what the grammar can already parse:
  primitives, arrays, objects, property access (`.`, including bracket-index
  access on a rest parameter — `a[0]`), and plain calls. **No operators at
  all** — `fjs/fsc/parser/grammar/module.f.mjs`'s `body`/`value`/`unary`
  productions admit no `+`, no comparisons, nothing beyond unary `-` folded
  into a numeric literal — so a Stage 1 function body cannot exercise
  anything in `op1Rust`/`op2Rust`/`op3Rust` regardless of what this task
  does. That is a fact about the parser, not a restriction this task
  imposes; nothing here needs to wait on it changing.
- A call whose callee is, by node identity, one of the module's own
  non-capturing function literals, and whose argument list is a **fresh**
  array literal built at the call site (`['[]', […]]`) — not a shared node,
  not `['args']` forwarded (impossible yet regardless, see below), not the
  result of another operation. See Task 6 for exactly why the argument-list
  shape is restricted this narrowly for now.

**Out of scope, and why each one is actually unreachable today, not merely
deferred by choice:**

- **Calling anything from *inside* a function's own body.** The parser
  refuses a reference to *any* name bound outside a function body — not
  just a captured value, a function name too — as `capture not supported`.
  The proof pins this exactly for a call:
  `expect('const f = (...a) => 1; export default (...b) => f(b);', 'capture not supported', 49)`
  (`fjs/fsc/parser/proof.f.mjs`). So a "static call" cannot be written from
  inside another function's body yet, at all — only from module-level code.
  This is not a Stage 1 design choice to revisit; it is a fact about what
  can be parsed today, and the parent document's own Stage 1 wording already
  anticipates it ("a module-level `const`, `export default` itself"). It is
  worth stating explicitly here because it changes what a "static call
  fixture" can look like: `const f = (...a) => a[0]; export default f(41);`,
  never a function calling a sibling function from within its own body.
- **`export default` naming a bare, uninvoked function value.** For example
  `export default (...a) => a[0];`, exported but never called. Refused, and
  deliberately: this is exactly "a function used as a first-class value,"
  which needs a `Function<A>` (built from the `FunctionHeader<A>`/`Code<A>`
  machinery [callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md)
  designs) to be handed to a generic harness — that machinery is explicitly
  Stage 2's job, not Stage 1's. So every Stage 1 fixture's `export default`
  must itself be an **already-applied call expression** (or ordinary data —
  today's existing fixtures are unaffected), never a bare function
  reference. This sharpens the parent document's "export default itself
  [as a call site]" into something unambiguous: the *export default
  expression* may be a call, never a function value standing alone.
- **A function value used anywhere but as a call's callee** — stored in an
  array or object, compared, returned from another call, passed as an
  argument to another call. All of these need the same `Function<A>`
  wrapping as the point above, for the same reason. Task 5 makes the printer
  refuse these explicitly rather than mishandle them.
- **Method calls** (`o.m(...)`, the `.`-node-owns-a-`|()`-continuation form).
  Not attempted here; every existing `.`-node chain-continuation is already
  refused outright regardless (`c !== undefined` in `expExpr`'s `.` case),
  so this needs no new refusal, only staying that way. Left to whichever
  stage first needs a function stored as an object property.
- **A computed (non-literal) index into `args`**, e.g. an `args[i]` for a
  run-time `i` rather than a source-literal `0`/`1`/…. Unreachable from the
  grammar today (no arithmetic to compute an index with, no loops), so
  nothing to design around yet; Task 3 only needs the number-literal case.

### Design

#### Task 1 — make the whole `.rs` pipeline properly fallible

`pub fn module<A: IVm>() -> Any<A>` becomes
`pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`, and every node-printing
path that currently panics on failure switches to propagating a `Result`.
This has to come first, as a foundation, not as part of adding calls:

- **It is already needed by data the printer accepts *today*.** The `.`
  node's printed form is `Any::own_property(${fa}, ${k}).unwrap()` — an
  ordinary property read on a nullish or wrong-shaped *opaque* base (a
  `const`, an import, another `.` result — anything `nonObjectLiteralBase`
  cannot rule out statically) already compiles to a Rust `panic!`, not a
  propagated failure, for every existing fixture that reads a property.
  Nothing forces this into the open before Stage 1; adding calls does,
  because a call is the paradigm case of "fails constantly, for reasons
  the generator cannot see" (any argument's own computation can fail, and
  the callee's body can fail on its own arguments), and generating a fresh
  `.unwrap()` for that would be a straightforward regression, not a
  simplification.
- **It matches the calling convention `callable-function-objects.md`
  already designs** for `Code<A>`/`Function::call`:
  `Result<Any<A>, Any<A>>` throughout, `Err` an `Any<A>` (today, the literal
  `"Type Error"` value the existing `TryFrom<Any<A>> for _` conversions in
  `nanvm-lib/src/vm/impls/try_from.rs` already use) — the same, single
  realization of A3 (throws are preserved) every fallible `nanvm-lib`
  operation already threads.

Concretely: `.` prints `Any::own_property(${fa}, ${k})?` in place of
`.unwrap()`; `bodyLines`'s final line loses its implicit "just an
expression" framing and instead needs `Ok(…)` around a bare value or a
passthrough `?`-chain — worked out fully once Tasks 4–6 restructure
`bodyLines` anyway, since a module's body is, after this task, structurally
the same shape as a generated function's body (Task 5). The `,` node's
`{ let _: Any<A> = …; …; last }` block needs no change in shape, only in
what a failing sub-expression inside it does (propagates via `?` the same
as anywhere else).

**Blast radius, and why it's mechanical rather than risky:** every committed
fixture in `nanvm-harness/fixtures/*.rs` needs regenerating (the return type
changed on all of them, function or not), which `npm run gen`'s drift check
already exists to do and verify — this is exactly the workflow
[mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md)'s "committed
generation" section describes, not a special case. `nanvm-harness/src/lib.rs`'s
`run<A: IVm>(module: fn() -> Any<A>) -> Result<std::string::String, JsonError>`
needs updating for the new `fn() -> Result<Any<A>, Any<A>>` shape (its
`#[test]` assertions, e.g. `assert_eq!(run::<Naive>(number::module), Ok("42".into()))`,
keep the same expected values — every existing fixture always succeeds, so
their tests are otherwise unaffected).

#### Task 2 — recognize what a non-capturing function actually looks like

Replace `isSmallestLambda`'s check with one for `frame === null` — matching
`fjs/fsc/edag`'s real lowering and `fjs/fsc/README.md`'s documented
canonical shape, not an array shape nothing produces — and drop the
`body[0] === 'undefined'` restriction entirely: Stage 1 needs to print
whatever the body actually is, not special-case the one body shape the old,
unreachable check happened to also require. Rename the predicate to say what
it now checks (e.g. `isNonCapturing`), since "smallest lambda" was never an
accurate name for "has no frame" and would be actively misleading once the
body can be anything.

Treat `frame: null` here purely as **a marker to detect and skip**, never as
a value to print. A non-capturing function's generated `fn` has nothing to
build for its (nonexistent) captured state — there is no frame array to
construct, so nothing about `null` is ever rendered into the output. This
matters because `null` is an ordinary EDAG primitive elsewhere (it would
print as `Nullish::Null.to_any()` if it ever reached the general primitive
path) — the frame position is the one place its meaning is "no frame," a
convention of this task's lowering, not a value.

**A note for Stage 3, not a Stage 1 task:** once real captured frames exist,
this check will need revisiting — a real, empty captured-values array
(`['[]', []]`, an actual array literal, not the placeholder `null`) will
also mean "no captures," and the printer will need to treat both as the same
"nothing to build" case, or the frame representation will need to settle on
one canonical empty shape before then. Flagging it here so it isn't
rediscovered as a surprise when Stage 3 starts.

#### Task 3 — print `args`, bare and indexed

Two new cases, both narrowly scoped to the exact shapes the current grammar
can produce:

1. **`['args']` alone**, used as a value (not indexed) — needed even for a
   Stage 1 fixture as simple as `(...a) => a`. Prints as the whole
   arguments array converted to a value: given a generated function's
   `args: &Array<A>` parameter (Task 5), this is `args.clone().to_any()` —
   an `Rc`-cheap clone through `IContainer`, not a deep copy.
2. **`['.', ['args'], i]`, `i` a number literal** — the identity read
   `a[0]`, `a[1]`, … A dedicated case checked *before* the general `.`
   dispatch reaches `indexExpr`'s numeric refusal (`entry.md`'s reserved
   territory, untouched by this task): since `i` is always, for now, a
   compile-time integer literal copied straight from the source index (there
   is no way to compute one yet — see Scope), the generator emits it as a
   literal `u32` in the printed Rust, not a runtime conversion, matching
   [callable-function-objects.md](../../../nanvm-lib/todo/callable-function-objects.md#arguments--args)'s
   already-designed shape exactly:

   ```rust
   if 0 < args.length() { args[0].clone() } else { Nullish::Undefined.into() }
   ```

   A chain continuation on this shape (`['.', ['args'], i, k]`) is *not*
   specially handled and does not need to be: it falls through to the
   ordinary `.`-dispatch, whose existing `c !== undefined` check already
   refuses any continuation outright, so this stays refused with no new
   code. A `.` node stacked *on top of* `['.', ['args'], i]` (`a[0].foo`) is
   likewise not a new case — it is an ordinary `.` node whose base happens
   to be this new shape, and the base is printed by ordinary recursion once
   the leaf case above exists; nothing about the outer node needs to know
   its base is special.

`['frame']` and `['.', ['frame'], i]` are correctly *not* added here — no
Stage 1 fixture can reference a frame (frames don't exist until Stage 3),
and the EDAG's own closed-scope rule means the parser refuses one before it
would ever reach the printer.

#### Task 4 — scope the node-sharing walk to one function at a time

`sharedNodesOf`'s `visit` walker recurses into every array element
uniformly. Give it one added stopping rule: when it meets a `=>` node, it
still visits (and can dedupe/count) *that node itself*, but does not recurse
into its `body` operand. Concretely, in `fjs/edag/rust/module.f.mjs`'s
`visit`, treat a `=>` node's `body` as an opaque leaf rather than a subtree
to fold into the caller's own sharing count — the caller computes exactly
the sharing that exists at *its own* scope. A separate, fresh call to the
same walker, rooted at a discovered function's own `body` (Task 5 finds
these), then computes that function's *own* internal sharing exactly the
same way, correctly excluding anything outside the function and anything
inside a function nested inside *that* one (none exist yet, per Scope, but
the mechanism should not assume otherwise).

No new scope-tracking data structure is needed, and `fjs/edag/analysis`'s
own `Analysis` type does not need importing for this specifically (its
existing, single use in `bodyLines` for the negation check is unaffected
and unrelated — that check already correctly looks at every node regardless
of scope, since a stray negation is refused everywhere, not just at module
level). The reason a fresh, per-scope re-walk is sound rather than merely
convenient: `analysis`'s own documented invariant already guarantees
*validated* input never shares one node identity across a function
boundary, so there is no cross-scope sharing case for the printer to get
wrong — only the printer's own bookkeeping (one flat list today) needs to
stop conflating "shared within this function" with "shared within a
sibling scope."

`letLines`/`bodyLines` (`fjs/fsc/rust/module.f.mjs`) need the equivalent
split: one `let`-sequence computation per scope (module top level, plus one
per discovered function), each run against its own `sharedNodesOf` result
and its own `expExpr(bindings)` closure, so a function's `let c0 = …;`
numbering restarts inside its own body and never collides with the module's
own `c0`, `c1`, ….

**Fixture this directly unblocks**: the internal-sharing example from
[spec/README.md](../../../spec/README.md#functions),
`(...args) => { const first = args[0]; const pair = [first, first]; return
[pair, pair]; }` — `pair`, referenced twice, must become one `let` binding
*inside* the generated function, not hoisted to module scope (where `args`
does not exist) and not silently miscounted against the module's own
sharing.

#### Task 5 — find every function, name it, and refuse a value use

A new pass over the module's EDAG, parallel to `sharedNodesOf` but answering
a different question: not "which nodes are shared," but "which `=>` nodes
exist, and is every one of them used *only* as a call's callee?" Sketch
(illustrative signature; the body is ordinary `fjs/edag`-style graph
traversal, and belongs in `fjs/fsc/rust/module.f.mjs` since — like
`sharedNodesOf`'s caller-side naming — deciding what counts as a valid use
of a function node is specific to *this* generator's current capabilities,
not a general EDAG property):

```js
/**
 * Every `=>` node reachable in the module, in a stable, deterministic order
 * (first use reached by a fixed traversal — the same determinism
 * `sharedNodesOf`'s dependency order already relies on, since the CI drift
 * check demands byte-identical regeneration). Refuses the module if any
 * `=>` node is reached from anywhere other than the callee position of an
 * `['()', callee, args]` node: Stage 1 has no way to print a function value
 * standing alone yet ([callable-function-objects.md]'s Stage 2 job), so a
 * bare reference, an array/object element, another call's *argument*, or
 * the module's own root value being a `=>` node directly are all refusals
 * here, not silent mishandling.
 *
 * @type {(root: Exp) => Result<readonly Exp[], readonly unknown[]>}
 */
export const functionsOf = root => { /* … */ }
```

Each discovered function is assigned a private, module-scope Rust name in
that same stable order — `f0`, `f1`, … (a separate namespace from the
existing shared-node `c0`, `c1`, … counter, so the two never collide and
each stays independently easy to read). Each is emitted, before
`pub fn module`, as:

```rust
#[rustfmt::skip]
fn f0<A: IVm>(args: &Array<A>) -> Result<Any<A>, Any<A>> {
    // this function's own let-sequence (Task 4), then its final expression
}
```

**Deliberately one parameter, not the two-parameter `Code<A>` shape
`callable-function-objects.md` designs for the general case.** Nothing in a
Stage 1 function ever reads a captured value (Task 2 guarantees `frame` is
always the "no captures" marker), so a `captured: &Array<A>` parameter would
be pure, unused ceremony bought against a Stage 2 design that has not landed
and could still change shape before it does. This is a known, deliberately
accepted seam: when Stage 2 introduces `Code<A>`, it will need to either
regenerate Stage 1's functions with the extra parameter or wrap them —
recorded here so it is a planned handoff, not a surprise.

`#[rustfmt::skip]` on each, matching `pub fn module`'s own existing
rationale exactly (one node per line regardless of nesting depth exceeds
rustfmt's line-length limit at moderate nesting — already measured for the
module function, and nothing about a plain top-level `fn` changes that
argument).

#### Task 6 — print a call as a direct Rust call

`['()', callee, args]` where `callee` is, by node identity, one of the
functions Task 5 discovered: print as `f{N}(&{args_expr})?`, `N` that
function's assigned index.

**The argument-list node is restricted to a fresh array literal,
`['[]', […]]`, for now — not any node that merely evaluates to an array.**
The reason is a real, if narrow, type mismatch this task does not attempt to
solve: an argument list needs to reach the call site as `&Array<A>` (what
`f{N}` takes), but `expExpr`'s existing `'[]'` handling always produces an
`Any<A>`-typed expression (`[…].to_array().to_any()`), and if that same
array-literal node were independently *shared* elsewhere as a plain value,
`letLines` would hoist it as a `let cN: Any<A> = …;` — the wrong type for a
direct `&Array<A>` argument. Untangling a node that needs to be printable as
*either* `Any<A>` or bare `Array<A>` depending on where it's read from is
solvable but not needed by anything in scope here (see Scope: forwarding
`args`, and any call from inside a function body where such reuse could
even arise, are both unreachable today) — so this task adds one narrow,
new-but-unshared printer path instead: reuse `expExpr`'s per-item printing
(`allOk(a.map(f))`, already how `'[]'` builds its item list) to emit
`[item0, item1, …].to_array()` **without** the trailing `.to_any()`, as a
small addition to the shared printer
(`fjs/edag/rust/module.f.mjs`) so `fjs/nanvm/rust`'s corpus printer could
reuse it too if it ever needs a bare `Array<A>` — refusing outright (a new,
explicit `Result` error, not a fallback) if the argument-list node is
anything else: shared, `['args']` itself, or the result of another
operation. Widening this is real future work, not a gap to paper over
silently.

The call's own failure (`?` above) is exactly Task 1's `Result` plumbing —
nothing new to design here, only a new place that can produce an `Err`.

#### Task 7 — the harness

`nanvm-harness/src/lib.rs`'s `run<A: IVm>` changes its parameter type from
`fn() -> Any<A>` to `fn() -> Result<Any<A>, Any<A>>`, matching Task 1.
`Ok(v)` keeps today's behavior (`v.to_json()`, unaffected — every existing
fixture is `Ok` and stays `Ok`). `Err(e)` is new: the harness is a
development tool, not FS code, so per A4 ("runners may emit out-of-band
diagnostics… for humans; FS code can never read them") it may render `e`
for a human — a debug/DJS-ish rendering, clearly distinguished from the
successful-JSON-value path — and report failure (a distinct `Result`
variant from the existing `JsonError` for `main.rs`'s exit-code handling, or
a small enum wrapping both, whichever reads better once written against the
real types). No "detect whether the module's value is a function and call
it" logic is needed here at all — the Scope section's restriction (every
Stage 1 `export default` is already an applied call) means the call already
happened inside `module()` itself; the harness only ever sees the `Result`
of a value that may or may not have involved one.

#### Fixtures

Concrete `nanvm-harness/fixtures/*.mjs` additions, each also added to
`package.json`'s `gen` script (the same explicit-list convention every
existing fixture already follows) and to `nanvm-harness/src/lib.rs`'s
`#[path]` includes and `#[test]`s:

- `export default (...a) => a[0];` called with a literal, e.g. wrapped as
  `const f = (...a) => a[0]; export default f(41);` → `41`. The smallest
  possible static call.
- `const f = (...a) => a[1]; export default f(41);` → `undefined` (only one
  argument supplied, position 1 read) — proves the bounds-checked read from
  Task 3, and that a Stage 1 function tolerates being called with fewer
  arguments than it reads, matching
  [call-like-instructions §6.2](../../../spec/todo/9100-call-like-instructions.md#62-calls-into-non-variadic-functions)'s
  semantics.
- `const f = (...a) => { const first = a[0]; const pair = [first, first]; return [pair, pair]; }; export default f(1);`
  — the [spec/README.md](../../../spec/README.md#functions) sharing example
  verbatim, proving Task 4's per-scope `let`-hoisting directly.
- `const f = (...a) => a; export default f(1, 2, 3);` — the bare-`args`
  read from Task 3, forwarding the whole array back out as the function's
  result.

### Interaction with later stages

- **Stage 2** (`Function<A>` as a real value) will need to either regenerate
  every Stage 1 function with `Code<A>`'s two-parameter shape or wrap the
  one-parameter `fn`s this task produces — an explicitly accepted seam
  (Task 5), not an oversight.
- **Stage 3** (capturing closures) reopens Task 2's `frame === null` check:
  a real, empty captured array will also mean "no captures," and the two
  representations of "nothing captured" will need reconciling.
- **Stage 4** (dynamic calls) is where Task 6's callee restriction — "only a
  node this pass already proved is one of the module's own functions" —
  widens to a callee that is merely *some* `Any<A>`, going through
  `TryFrom<Any<A>> for Function<A>` instead of a compile-time identity
  check.
- **Stage 6** (arity/variadic edge cases) should specifically re-audit the
  bounds-checked read Task 3 introduces against
  [call-like-instructions §6](../../../spec/todo/9100-call-like-instructions.md#6-behind-the-scenes-of-user-defined-function-calls)'s
  full rule set once dynamic calls (Stage 4) can hand a Stage 1-shaped
  function an `args` array of arbitrary, caller-controlled length.

### Open questions

1. **Does `importsFor`'s substring scan pick up `Array<A>` used only in a
   parameter position** (`fn f0<A: IVm>(args: &Array<A>) …`), not just a
   constructor call like today's `Array::default()`/`.to_array()`? Almost
   certainly yes — it is a plain text search over the whole generated body,
   and `Array<A>` fixed against `importCatalog`'s existing `'Array::default'`
   marker will not match, so the marker list itself may need a second,
   narrower entry (`'&Array<A>'` or similar) rather than assuming the
   existing one already covers it. Worth checking directly against a real
   generated fixture rather than assumed.
2. **The deterministic order for naming `f0`, `f1`, ….** The CI drift check
   (`npm run gen` regenerating and diffing every committed `.rs` file)
   requires byte-identical output across runs, so whatever traversal order
   `functionsOf` (Task 5) picks has to be fixed and simple to state — the
   natural candidate is the same first-reached, dependency-respecting
   post-order `sharedNodesOf` already uses for `c0`, `c1`, …, applied to
   `=>` nodes specifically instead of shared nodes generally.
3. **Whether a function referenced from exactly one call site still deserves
   its own named top-level `fn`, or whether it should be inlined at that one
   call site instead.** This document takes the position that it should
   always be a named `fn` — simpler (one code path regardless of reference
   count, matching how `sharedNodesOf` already treats "referenced once" as
   the ordinary case needing no special handling), and inlining buys nothing
   a Rust-level optimizer would not already do for a private, single-call-site
   function on its own. Revisit only if a concrete reason to prefer inlining
   surfaces.

### Tasks

- [ ] Task 1: `pub fn module` returns `Result<Any<A>, Any<A>>`; replace the
      `.` node's `.unwrap()` with `?`; regenerate every committed fixture;
      update `nanvm-harness`'s `run` and its tests.
- [ ] Task 2: fix/rename `isSmallestLambda` to recognize `frame === null`;
      drop the `body[0] === 'undefined'` restriction; remove the phantom
      `function_any()` call.
- [ ] Task 3: print bare `['args']` and `['.', ['args'], i]` (`i` a number
      literal), the latter bounds-checked against `Nullish::Undefined`.
- [ ] Task 4: scope `sharedNodesOf`'s walk to stop at a `=>` node's `body`;
      run `letLines`/`bodyLines` once per scope (module, plus one per
      discovered function).
- [ ] Task 5: add `functionsOf` (or similarly named) — discover every `=>`
      node, refuse one used anywhere but a call's callee position, assign
      deterministic names, emit each as its own `#[rustfmt::skip] fn`.
- [ ] Task 6: print `['()', callee, args]` as a direct call when `callee` is
      a discovered function and `args` is a fresh array literal; add the
      bare-`Array<A>`-without-`.to_any()` printer helper this needs; refuse
      every other argument-list shape explicitly.
- [ ] Task 7: update `nanvm-harness`'s `run`/tests for the `Result`-returning
      `module()`; add the four fixtures above end to end (`.mjs`, generated
      `.rs`, `#[path]` include, `#[test]`, `package.json`'s `gen` entry).

### Related

- [`nanvm-lib/todo/callable-function-objects.md`](../../../nanvm-lib/todo/callable-function-objects.md)
  — the parent, eight-stage plan; this document is its Stage 1 worked out in
  full against the real generator.
- [`fjs/fsc/todo/compile-modules-to-edag.md`](./compile-modules-to-edag.md)
  — Stage 2 of *that* rollout (non-capturing `=>` and `()` in the EDAG and
  the parser) is what makes this document's starting point possible; fully
  shipped, and the reason `['=>', null, body]` and plain calls already lower
  correctly even though nothing prints them to Rust yet.
- [`fjs/edag/todo/entry.md`](../../edag/todo/entry.md) — owns the general
  numeric/computed-index read this document deliberately does not widen;
  Task 3's `args`-index case is a narrow, separate carve-out, not a
  dependency on this landing first.
- [`spec/todo/9100-call-like-instructions.md`](../../../spec/todo/9100-call-like-instructions.md)
  — the arity/argument-count semantics Task 3's bounds check and the
  fixtures verify against.
- [`spec/README.md`](../../../spec/README.md#functions) — source of the
  internal-sharing fixture Task 4 must handle correctly, and of the
  parameter/body grammar this document's Scope section is bounded by.
- [`nanvm-lib/todo/generated-rust-module-rustfmt-skip.md`](../../../nanvm-lib/todo/generated-rust-module-rustfmt-skip.md)
  — an orthogonal cleanup of the same `#[rustfmt::skip]` convention Task 5's
  generated functions also follow; not a dependency, just the same
  precedent.
