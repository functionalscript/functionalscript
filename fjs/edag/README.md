# EDAG

An **e**xpression **DAG** — the canonical data representation of a function
body. A body is a single root expression node; a shared subexpression is one
node referenced from several places, not a copy — sharing is observable
(`{} === {}` is `false`), so it is part of the function's meaning, not a
serialization trick. Evaluation memoizes every node by identity within one
invocation — shared nodes evaluate once, per the baseline in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md), and each
call starts fresh, per the per-invocation memo scope in
[interpret-edag.md](../djs/todo/interpret-edag.md). There is no normal form: a function's hash is the
structural identity of its graph as written, the name-erased source.
Lowering rules make agreed-on spellings coincide; hash equality does not
decide semantic equivalence — the chain conditions in
[Chains](#chains) are such a rule, canonical for chains alone and enforced
by a pass rather than by the schema, not a normal form for `exp`. This module owns the data model only: node kinds, operand
shapes, and their schema. Producers and executors are staged work that will
consume it — the [DJS](../djs/) compiler lowering parsed modules to EDAG
([compile-modules-to-edag.md](../djs/todo/compile-modules-to-edag.md)), the
interpreter and Rust code generation executing it — and the dependency is
one-way by design: `fjs/edag` imports nothing from them.

The shape is defined once, as an [RTTI](../types/rtti/) schema in
[module.f.mjs](module.f.mjs) — the specification of record, checkable at
runtime with `validate(exp)` (shape only — see Caveats). [types.ts](types.ts) carries the same shape at
the type level, pinned against the schema with `Assert<Check<...>>` so the
two cannot drift — exact up to one known approximation: the static tuples
are closed while the runtime ones are open (see Caveats).
[proof.f.mjs](proof.f.mjs) pins what the schema accepts and rejects, node
kind by node kind — validation behavior, not execution semantics — with
`comma` excepted until its placeholder shape settles. Its `ownJs` and
`chainsJs` sections are the exception that proves the rule: they run the JS
whose behavior the nodes are built around, which is how those semantics were
pinned before anything executed an EDAG. [amnesia](amnesia/README.md) now
does — a tree-walking evaluator for testing the semantics, and deliberately
not a VM to run FunctionalScript on. [canonical](canonical/README.md) is the
third pass: the conditions on chain nodes that `array(lambda)` cannot state,
checked over a whole graph. The broader identity and memoization
choices, including JS-compatible executors, global memoization, and the CAVM,
are compared in [execution-models.md](execution-models.md).

## Nodes

A node is a primitive or a tagged tuple `[tag, ...operands]`. In the schema
and the type-level API, operation nodes are grouped by their `exp`-operand
count — `op0` (`undefined`, `args`, `frame`), `op1` (unary), `op2` (binary)
— not by semantic category. The chain steps follow the same rule: the two
property ids share one schema and the two call ids another, split by what
they take rather than by what each id means. This table is an overview; the contract of
record for each node is the JSDoc in [module.f.mjs](module.f.mjs) — on the
node's export and, for the operations, on the `op0Id`/`op1Id`/`op2Id`
vocabularies.

| form | meaning |
|---|---|
| `null`, `boolean`, `number`, `string`, `bigint` | itself |
| `['undefined']` | `undefined` — tagged, because a bare `undefined` is indistinguishable from a missing tuple position |
| `['[]', items[]]`, each an `exp` or a `spread` | array literal; `[a, ...b]` splices `b`'s elements in at that position |
| `['{}', properties[]]`, each `[':', key, value]` or a `spread` | object literal; ordered entries applied in written order, duplicates allowed with the later winning; the key is an `exp`, one form for `a:`, `"a":`, and computed `[exp]:` keys; the `:` descriptor is a structural operand, not a node — only its key and value are; `{...a}` splices `a`'s own properties in at that position |
| `['...', exp]` | spread — only valid as an `items`/`properties` entry above, never a top-level `Exp` |
| `['args']` | the function's arguments |
| `['frame']` | the captured frame |
| `['.', exp, index]` | property access: `exp0[exp1]` |
| `['()', exp, exp]` | call with no receiver: `exp0(...exp1)` — see [Chains](#chains) |
| `['.()', exp, index, exp]` | method call: `exp0.exp1(...exp2)`, with `exp0` as the receiver |
| `['?.', exp, index]` | optional property access: `exp0?.[exp1]` |
| `['?.()', exp, exp]` | optional call of a value: `exp0?.(...exp1)` |
| `['_', exp, lambdas]` | an optional region walked from `exp0`, its value read |
| `['_()', exp, lambdas, exp]` | the same region, called with `exp2` and the receiver its last step left |
| `[id, index]`, `id` one of `\|.` `\|?.` | a `lambda` — one property chain step, only valid inside a `lambdas` operand above |
| `[id, exp]`, `id` one of `\|()` `\|?.()` | a `lambda` — one call chain step, likewise |
| `[',', exps]` | comma: establish all operands, take the value of the last |
| `[id, exp]` | unary operation, `id` one of `String` `Number` `neg` `!` `~` |
| `[id, exp, exp]` | binary operation, `id` one of `=>` `own` `===` `!==` `>` `>=` `<` `<=` `+` `-` `*` `/` `%` `**` `&` `\|` `^` `<<` `>>` `>>>` `&&` `\|\|` `??` |

A `[]` suffix in the form column marks an operand that is an array of the
named schema, not one of it: `['[]', items[]]` holds a whole array of
`items`, and `exps` is likewise `exp[]`. The distinction is easy to lose in
prose and load-bearing in the schema — a single element where the array
belongs still validates plenty of values, just the wrong ones.

A `lambdas` is likewise `lambda[]` — an array of the chain steps described
in [Chains](#chains) below, where a single `lambda` is one such step.

An `index` — the property operand of `.`, `.()`, `?.`, `|.`, and `|?.` — is a
`string`, a `number`, or `['Number', exp]`, a computed index cast to a
number. Among the binary ids, `=>` builds a function and `own` reads an own
property, bypassing the prototype chain (including `__proto__` — see the
`ownJs` proof); calling a function is not among them, even though `()` has two
`exp` operands, because the call nodes are read as one vocabulary with `.()`
and the walkers, and their handler is receiver machinery rather than an
operator over two values. A call's arguments — the last `exp` of every call
node, and the operand of `|()`/`|?.()` — are one node evaluating to the
complete argument array, not a literal operand list: `f(a, b)` is
`['()', f, ['[]', [a, b]]]`, and `f(...xs)` needs no `...` node at all,
since `['()', f, xs]` already passes the whole array through. A `...`
node is what mixes the two: `f(a, ...b)` is
`['()', f, ['[]', [a, ['...', b]]]]`.

## Chains

A JS member chain carries two kinds of hidden control flow (HCF) that its
operand values do not: a property access hands its receiver to a following call
as `this` (`[42].at(0)` is `42`, but `const at = [42].at; at(0)` throws), and an
optional link skips the rest of its chain (`undefined?.a.b` is `undefined`, but
`(undefined?.a).b` throws). Parentheses move both boundaries, so both are part
of what a graph means.

Neither is ever the result of an `exp`. Evaluating an `exp` produces an
ordinary value and nothing else, which is what keeps a node
context-independent and shareable by identity wherever it appears. So an HCF
must be **born, carried, and consumed inside one node**; it cannot be handed
to a neighbouring one.

### The partition

Two questions — does this node carry HCF, and is an optional operator
involved — partition the node kinds, and the seven fall out. It classifies
nodes, not whole expressions: `(a?.b).c` has an optional operator and no HCF
of its own, and is a `.` node over a `?.` one.

| | no HCF | HCF |
|---|---|---|
| **no optional operator** | `.`, `()` | `.()` — the unique case |
| **optional operator** | — | `?.`, `?.()` alone; a region needs a walker |

**`a.b(...c)` is the only expression with no optional operator that carries
HCF.** A short-circuit can only come from an optional operator, so an
expression built without `?.` and `?.()` can carry only *receiver* HCF, and a
receiver exists only where a property access feeds a call — which, with the
optional operators excluded, is `.` feeding `()`. It stays unique under
composition, since longer non-optional chains supply the base rather than
adding cases (`a.b.c(...d)` is `['.()', ['.', a, b], c, d]`), and it covers
the row completely, because a receiver's lifetime is bounded at two
operations: the call consumes the receiver and ends it, so `a.b(...c).d`
starts a fresh lifetime and is `['.', ['.()', a, b, c], d]`. No non-optional
expression ever needs a walker.

`?.` and `?.()` avoid one for a matching reason: their short-circuit skips
nothing beyond their own operands — `a?.b` skips its index, `a?.(...b)` its
arguments, and neither can skip more.

The line is **bounded against unbounded**, not complete against incomplete.
`a?.b(...c)` also has a complete lifetime, and its base, index and arguments
would fit fixed operands; what disqualifies it is that its short-circuit skips
a *separate operation* — the call, arguments included — and once a region
reaches past its own operands the number of operations it can skip is
unbounded (`a?.b(...c).d.e…`). Unbounded needs an array.

| lifetime | bound | node |
|---|---|---|
| receiver — `.` feeding `()` | exactly two operations; the call ends it | `.()` |
| region skipping only its own operands | one operation | `?.`, `?.()` |
| region skipping separate operations | unbounded | a walker |

The two rows of the first table differ exactly there. A call ends a *receiver*
lifetime, so `a.b(...c).d` and `(a.b(...c)).d` are the same expression; a call
does **not** end a *region*, so `a?.b(...c).d` and `(a?.b(...c)).d` are not —
on a nullish `a` the first is `undefined` and the second throws.

Those three are not every bounded shape, and the gap is a choice rather than a
derivation. `a.b?.(...c)` and `(a?.b)(...c)` are bounded by the same criterion
— each skips one operation, its own operands — and both are spelled with a
walker anyway, so that the node set stays small and a `lambdas` keeps one
meaning: an optional region. What the criterion settles on its own is the
other direction: nothing *unbounded* can be a pure node.

### The rows are independent

A language subset with no optional operators needs only the top row — `.`,
`()`, and `.()`. `Lambda`, `Lambdas`, and both walkers drop out entirely, and
the subset still expresses every non-optional chain, receivers included,
because `.()` holds its receiver in operands. That makes the schema
stageable: the optional row can land later without reworking the first, which
matters for
[compile-modules-to-edag.md](../djs/todo/compile-modules-to-edag.md), where
lowering is staged work.

### Steps

A `lambdas` is the operand the two walkers carry, and the one impurity in the
node set. A step is **not** an `exp`: it reads the current chain value
implicitly, so it has no place to hold one and cannot be lifted out as a
shared computation node. Whatever a graph expresses as a step cannot be
shared, cannot be substituted for an equivalent expression, and contributes no
hash of its own; whatever it expresses as an `exp` is all three. That is why
the pure nodes hold every chain whose HCF is complete within them, and why
minimality below is more than tidiness — sharing is observable and part of a
function's meaning, so a non-minimal `lambdas` hides subexpressions where
nothing else can share them.

| `lambda` | meaning |
|---|---|
| `['\|.', index]` | property access; the input becomes the receiver |
| `['\|?.', index]` | the same, `undefined` on a nullish input |
| `['\|()', exp]` | call the current value with the current receiver, then clear it |
| `['\|?.()', exp]` | the same, `undefined` on a nullish current value |

The rows pair up by operand, and that is how the schema carries them: one
`lambdaPropertyAccessor` for the first two, one `lambdaCall` for the last two,
each a tuple of its id vocabulary and its single operand.

A step takes the previous value implicitly, so it holds no operand for it and
carries no continuation: the rest of the region is the rest of the `lambdas`.
An optional step whose input is nullish produces `undefined` and skips every
step after it there, leaving its own `index`/argument operand unevaluated — as
does `?.`/`?.()` itself, which is why `a?.[k]` does not evaluate `k` when `a`
is nullish.

The `|` prefix is a correctness requirement rather than a readability one.
Tuples are open ([Caveats](#caveats)), so an unprefixed step schema
`['.', index]` would also admit a full three-operand `.` **node** — `validate`
accepts `['.', 'base', 'idx']` against it, after which a walk would read
`'base'` as the index and ignore the rest. The same collision hits `()` and
`?.()`. The prefix keeps the two vocabularies disjoint, and marks what the
disjointness is for.

### Reading the tags

The glyphs are a vocabulary: `.` is a property access, `()` a call, `?` the
guard that makes one optional, `_` a walked region. Composition within a tag
is evaluation order — `.()` is a property access **then** a call, `_()` a
region **then** a call.

Two pairs read as parallel and are not. `.()` is property-plus-call; `?.()` is
an optional call of a *value*, with no property — the optional method call
`a?.b(...c)` is `['_', a, [['|?.', b], ['|()', c]]]`, a walker, because its
region extends. And `_` does not say that its node is always optional, though
its conditions guarantee it; `?_` would, but `_()` carries the same condition,
so the pair stays consistent either way and the shorter tag wins.

### The two walkers

They evaluate their base, walk their `lambdas`, and differ only in what
consumes the result:

```js
'_':   value(property(applyLambda(i, lambdas, [i(a)])))
'_()': call (property(applyLambda(i, lambdas, [i(a)])), () => i(args))
```

A region short-circuits when a `|?.` / `|?.()` step meets a nullish value, and
`property` turns that back into the value `undefined` — for `_` to read, or
for `_()` to call. That one word is the whole difference between `u?.b(d)`
being `undefined` and `(u?.b)(d)` throwing.

`_()` keeps a full `lambdas` because it is the only **unguarded** consumer of
a receiver, which makes a leading optional step observable there and
irreducible. Two narrowings of it fail: dropping the operand and recovering
the receiver from the callee `exp` cannot work, since `(0, a.b)(...c)` and
`a.b(...c)` compute the same callee and differ only in the receiver — here the
tag carries it, which is why `.()` can be pure and `_()` still cannot; and
restricting its step ids to `|.` leaves `(a?.b.c)(...d)` unspellable, its
`|?.` sitting inside the region the call consumes.

### Conditions

A `lambdas` is `array(lambda)`, and neither `array(T)` nor `or` states
cardinality or order, so what bounds the walkers is not in the schema. It is
[canonical/module.f.mjs](canonical/module.f.mjs), a pass over a whole graph,
plus the lowering that has to satisfy it:

- **`_`** — at least two steps, at least one of them optional.
- **`_()`** — at least one step, at least one of them optional.
- **Minimality — the shortest valid form.** Where an expression can be split
  into two, it is split. For a walk that means cutting at every available cut
  point and keeping only what cannot be cut.

The two cardinality conditions stop a walker respelling a pure *node* —
without them `['_', a, [['|.', b]]]` respells `a.b`. On their own they do not
stop one respelling a pure *nesting*; minimality is what collapses those, so
an implementation needs all three. Cuts come in three places, because the
parenthesis law below only has something to say once a region is open:

- **Before the region** nothing is guarded, so every step that does no
  required work leaves through the front into the base, whatever its id. The
  one exception is a `|.` supplying the receiver a `|?.()` consumes, since the
  cut would strand it: `['?.()', ['.', a, b], c]` calls a detached `a.b`.
- **Inside it** a cut is available before any optional step that takes no
  receiver from the step before it, because the operator following the closure
  is then itself guarded. None is available before a `|.` or a `|()`, nor
  before a `|?.()` whose predecessor is a property step.
- **At the far end of `_()`**, whose own call is unguarded and takes the last
  step's receiver: a trailing *call* step has already cleared one, so it gives
  way to `['()', …]` over the shorter region.

One consequence bounds the shape rather than describing a procedure: **a
`lambdas` holds at most one `|?.`, and if it holds one it is the first step.**
A `|?.` is a property access, not a call, so it consumes no receiver, nothing
binds it to the step before it, and closing there is never observable — `?.`
being guarded itself. So anything ahead of a `|?.` is cut away into the base,
and a second one starts a new node. That bounds `|?.` and nothing else: a
`|?.()` is not a cut when it is bound to the property step ahead of it, and it
appears in a `lambdas` in one of two roles — **opening** the region, needing no
receiver, or **bound** to that property step.

### The parenthesis law

Closing an optional region is observable exactly when the operator that
follows is *unguarded*:

```
(X).y        ≢  X.y          (a?.b).c   throws  ·  a?.b.c   is undefined
(X)(...y)    ≢  X(...y)      (a?.b)(c)  throws  ·  a?.b(c)  is undefined
(X)?.y       ≡  X?.y
(X)?.(...y)  ≡  X?.(...y)
```

A guarded operator absorbs the `undefined` a closed region yields; an
unguarded one rejects it. A rewrite between two spellings is available only
when the survivor is **fully** equivalent — same values, same throws, same
unevaluated operands. "Both throw" is not enough, which is why the two
`(a?.b.c)(...d)` cases below are distinguished by a proof that evaluates them
rather than by comparing error text.

### Encodings

| JS | EDAG |
|---|---|
| `a.b` | `['.', a, b]` |
| `a.b.c` | `['.', ['.', a, b], c]` |
| `a(...b)` | `['()', a, b]` |
| `(0, a.b)(...c)` | `['()', ['.', a, b], c]` |
| `a.b(...c)`, `(a.b)(...c)` | `['.()', a, b, c]` |
| `a.b.c(...d)` | `['.()', ['.', a, b], c, d]` |
| `a.b(...c)?.d` | `['?.', ['.()', a, b, c], d]` |
| `a?.b` | `['?.', a, b]` |
| `a?.b?.c` | `['?.', ['?.', a, b], c]` |
| `a?.(...b)` | `['?.()', a, b]` |
| `a?.b.c` | `['_', a, [['\|?.', b], ['\|.', c]]]` |
| `a?.b(...c)` | `['_', a, [['\|?.', b], ['\|()', c]]]` |
| `a.b?.(...c)` | `['_', a, [['\|.', b], ['\|?.()', c]]]` |
| `a?.b?.(...c)`, `(a?.b)?.(...c)` | `['_', a, [['\|?.', b], ['\|?.()', c]]]` |
| `a?.(...b)(...c)` | `['_', a, [['\|?.()', b], ['\|()', c]]]` |
| `a.b?.(...c).d` | `['_', a, [['\|.', b], ['\|?.()', c], ['\|.', d]]]` |
| `((a?.b).c)?.(...d)` | `['_', ['?.', a, b], [['\|.', c], ['\|?.()', d]]]` |
| `(a?.b)(...c)` | `['_()', a, [['\|?.', b]], c]` |
| `(a?.b.c)(...d)` | `['_()', a, [['\|?.', b], ['\|.', c]], d]` |

Three rows carry most of the design. `a.b(...c)` against `(0, a.b)(...c)` —
the receiver and its absence — are told apart by the **tag**, which is what
rules out recovering the receiver from the callee expression.
`((a?.b).c)?.(...d)` is why a `|.` step may precede an optional one: the
receiver for `|?.()` comes from `.c` applied to an already-completed region,
and folding it into the base would lose it. And `a.b(...c)?.d` needs no walker
at all, because a call ends a receiver's lifetime — nothing can extend `.()`,
which is what makes it expressible as operands in the first place.

### Where each half is pinned

The `chains` section of [proof.f.mjs](proof.f.mjs) pins the shape of every
spelling above, and `chainsJs` next to it runs those spellings as JS on the
host engine — the receiver surviving `(a?.b)(d)`, the operands an optional
branch skips, and the grouped forms that throw. [amnesia](amnesia/README.md)
evaluates the nodes themselves, and its `distinguished` section pins the pairs
that differ only in where a region ends or whether a receiver survives.
[canonical](canonical/README.md) is the third: which of several spellings of
one expression a lowering is allowed to emit.

A parenthesized non-optional chain is no different from an unparenthesized
one, so `a.b.c(d)` and `(a.b.c)(d)` are the same graph. Where a non-optional
prefix could equally be `.` nodes or `|.` steps, minimality decides: it is `.`
nodes, and the lowering that has to produce them is
[compile-modules-to-edag.md](../djs/todo/compile-modules-to-edag.md).

One spelling is not checked in JS, because the engines disagree about it.
When `u` is nullish, `(u?.b)(d)` must throw: the parentheses end the chain,
so `undefined` is called. V8 does throw; JavaScriptCore (hence `bun test`)
carries the short-circuit through the parentheses and evaluates to
`undefined` instead. The EDAG follows the specification — the throwing
reading is what `['_()', u, [['|?.', 'b']], d]` denotes, and an executor must
produce it whatever its host engine does — as
[amnesia](amnesia/module.f.mjs) does, where
`distinguished.throw.regionCallOnUndefined` in
[amnesia/proof.f.mjs](amnesia/proof.f.mjs) evaluates that node and pins the
throw on every runner. `(u?.b).c`, the property counterpart, throws everywhere
and is what `chainsJs` pins for this boundary.

Two further points about that disagreement, both worth knowing before reading
the commented cases in `chainsJs.throw`. It is the *engine*, not bun's
transpiler: `(u?.b)(d)` is equally wrong through `eval` and `new Function`
under bun, which hand the source straight to JavaScriptCore. And there is a
second, separate defect next to it — bun rejects `` (u?.b)`tag` `` at parse
with `SyntaxError: Cannot use tagged templates in an optional chain`, where
`eval` of the same text throws correctly, so that one *is* the transpiler.
It is [oven-sh/bun#31812](https://github.com/oven-sh/bun/issues/31812), filed
for the `new` sibling `new (baz()?.qux)()`; one root cause, the parenthesis
ceasing to end the chain, so restrictions that hold inside it leak past.

## Caveats

- Tuples are open on the trailing side: `['args', 'extra']` validates.
  Deliberate in RTTI
  ([Structs and tuples are open](../types/rtti/README.md#structs-and-tuples-are-open));
  stating exact arity is now spellable
  ([Closed containers](../types/rtti/README.md#closed-containers)) but not yet
  applied to these nodes.
  The static types render the closed approximation — TypeScript cannot carry
  the open tuple mapping generically (`TupleTs` in
  [ts/types.ts](../types/rtti/ts/types.ts)) — so that same runtime-valid
  `['args', 'extra']` is not assignable to `Op0`.
- Neither `validate` nor `parse` is identity-aware, each in its own way:
  `validate` returns the original value — sharing intact — but re-walks a
  shared subgraph once per incoming edge (exponential in depth) and
  overflows the stack on a cycle instead of rejecting it; `parse` rebuilds
  every container, so sharing is lost —
  [identity-aware-parse.md](../types/rtti/todo/identity-aware-parse.md).
  So `validate` is shape validation, not complete EDAG validation:
  identity-dependent canonicality — acyclicity, and the rule that an
  operation-node identity may be shared only within one function's scope,
  never across a `=>` boundary — goes unchecked. The Stage 2 validator for
  that boundary is tracked in
  [compile-modules-to-edag.md](../djs/todo/compile-modules-to-edag.md).
- `[',', exps]` is a known-incomplete placeholder; the settled contract must
  express "at least two operands, last is the result, each pre-result
  operand a true root" — a single-operand `,` is the identity, an operand
  reachable from a sibling of the same `,` a redundant anchor, both
  non-canonical.
- `['...', exp]` is shape-checked only, and what its operand must evaluate
  to differs by the container it sits in — neither constraint expressible in
  a shape-only schema. In an array the operand must be iterable (`[...1]`,
  `[...null]`, and `[...{a: 1}]` all throw); in an object anything goes,
  contributing the operand's own enumerable properties — of which a number,
  boolean, bigint, symbol, `null`, or `undefined` has none (`{...null}` is
  `{}`), while a string has its indices (`{...'ab'}` is `{0: 'a', 1: 'b'}`).
  Object spread reads those properties *through* getters, unlike `own`,
  which reads the descriptor's value and never calls one.
- `index` does not yet exclude `constructor`/`__proto__` —
  [excluded-string-values.md](../types/rtti/todo/excluded-string-values.md).
- A `lambdas` is `array(lambda)`, which states neither cardinality nor order,
  so `validate` accepts walkers that respell a pure node or a pure nesting.
  [canonical](canonical/README.md) rejects them; a graph is legal only when
  both pass. Stating the conditions in the schema instead is
  [chain-node-grammar.md](todo/chain-node-grammar.md), which replaces
  `Lambdas` with one lambda type per chain state; `close`
  ([Closed containers](../types/rtti/README.md#closed-containers)) can state
  a cardinality lower bound and pin leading positions, but no fixed prefix
  can state a cut, so it buys a partial contract rather than the rule.

## Design

The semantics and operation vocabulary are decided subject by subject in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md); the module
boundary and the plan for generating the Rust types from this schema live in
[edag-spec.md](../../todo/edag-spec.md).
