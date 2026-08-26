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
decide semantic equivalence. This module owns the data model only: node kinds, operand
shapes, and their schema. Producers and executors are staged work that will
consume it — the [DJS](../djs/) compiler lowering parsed modules to EDAG
([compile-modules-to-edag.md](../djs/todo/compile-modules-to-edag.md)), the
interpreter and Rust code generation executing it — and the dependency is
one-way by design: `fjs/edag` imports nothing from them.

"No normal form" is a statement about the module as a whole, not a licence for
each node kind to admit several spellings of one thing. Where a set of
spellings *can* be cut down to one in the schema, it is: [Chains](#chains) is
the worked case, where four node kinds and three continuation types replace a
flat array of steps that admitted four families of duplicates, and the
uniqueness is structural — the wrong shapes are unspellable rather than
rejected by a validation pass a producer has to remember to run.

The shape is defined once, as an [RTTI](../types/rtti/) schema in
[module.f.mjs](module.f.mjs) — the specification of record, checkable at
runtime with `validate(exp)` (shape only — see Caveats). [types.ts](types.ts) carries the same shape at
the type level, pinned against the schema with `Assert<Check<...>>` so the
two cannot drift. Every tuple in the schema is stated `close`d, so the static
tuples and the runtime ones agree exactly — the approximation
[TupleTs](../types/rtti/ts/types.ts) settles for *is* the closed rendering.
[proof.f.mjs](proof.f.mjs) pins what the schema accepts and rejects, node
kind by node kind — validation behavior, not execution semantics — with
`comma` excepted until its placeholder shape settles. Its `ownJs` and
`chainsJs` sections are the exception that proves the rule: they run the JS
whose behavior the nodes are built around, which is how those semantics were
pinned before anything executed an EDAG. [amnesia](amnesia/README.md) now
does — a tree-walking evaluator for testing the semantics, and deliberately
not a VM to run FunctionalScript on. The broader identity and memoization
choices, including JS-compatible executors, global memoization, and the CAVM,
are compared in [execution-models.md](execution-models.md).

## Nodes

A node is a primitive or a tagged tuple `[tag, ...operands]`. In the schema
and the type-level API, operation nodes are grouped by their `exp`-operand
count — `op0` (`undefined`, `args`, `frame`), `op1` (unary), `op2` (binary)
— not by semantic category. The four chain nodes follow a different rule and
are their own kinds, because what distinguishes them is the hidden control
flow they own rather than how many operands they take; see
[Chains](#chains). This table is an overview; the contract of
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
| `['()', exp, exp]` | call with no receiver: `exp0(...exp1)` — see [Chains](#chains) |
| `['.', exp, index, propertyLambda]` | property access `exp0[exp1]`, owning whatever its receiver is used for |
| `['?.', exp, index, optionPropertyLambda]` | optional property access `exp0?.[exp1]`, owning the rest of its optional region |
| `['?.()', exp, exp, optionLambda]` | optional call `exp0?.(...exp1)`, likewise |
| `['\|()', exp, k]`, `['\|.', index, k]`, `['\|?.()', exp, k]`, `['\|!()', exp, null]` | a chain step and its continuation — only valid in the continuation operand of a node above, or of another step |
| `[',', exps]` | comma: establish all operands, take the value of the last |
| `[id, exp]` | unary operation, `id` one of `String` `Number` `neg` `!` `~` |
| `[id, exp, exp]` | binary operation, `id` one of `=>` `own` `===` `!==` `>` `>=` `<` `<=` `+` `-` `*` `/` `%` `**` `&` `\|` `^` `<<` `>>` `>>>` `&&` `\|\|` `??` |

A `[]` suffix in the form column marks an operand that is an array of the
named schema, not one of it: `['[]', items[]]` holds a whole array of
`items`, and `exps` is likewise `exp[]`. The distinction is easy to lose in
prose and load-bearing in the schema — a single element where the array
belongs still validates plenty of values, just the wrong ones.

A continuation is **not** an array. It is `null` or one step holding the next
continuation, so a chain is a linked list whose link type changes as it goes —
which link type is legal where is the whole of [Chains](#chains) below.

An `index` — the property operand of `.`, `?.`, and the `|.` step — is a
`string`, a `number`, or `['Number', exp]`, a computed index cast to a
number. Widening those positions to a bare `exp` was weighed and rejected:
`exp` and `index` overlap, since `['Number', e]` is both a `numberCast` and
an `op1`, so it would buy a second spelling of every computed key and no new
expressive power. Among the binary ids, `=>` builds a function and `own` reads
an own property, bypassing the prototype chain (including `__proto__` — see
the `ownJs` proof); calling a function is not among them — `()` takes two
`exp` operands and so *is* binary in count, but a call's receiver comes from
the node holding it, which no `op2` id has anywhere to put. A call's
arguments — the last `exp` of `()`, the second of `?.()`, the operand of
every call step — are one node evaluating to the complete argument array, not
a literal operand list: `f(a, b)` is `['()', f, ['[]', [a, b]]]`, and
`f(...xs)` needs no `...` node at all, since `['()', f, xs]` already passes
the whole array through. A `...` node is what mixes the two: `f(a, ...b)` is
`['()', f, ['[]', [a, ['...', b]]]]`.

## Chains

A JS member chain carries two kinds of hidden control flow that its operand
values do not: a property access hands its receiver to a following call as
`this` (`[42].at(0)` is `42`, but `const at = [42].at; at(0)` throws), and an
optional link skips the rest of its chain (`undefined?.a.b` is `undefined`,
but `(undefined?.a).b` throws). Parentheses move both boundaries, so both are
part of what a graph means.

Neither is ever the result of an `exp`. Evaluating an `exp` produces an
ordinary value and nothing else, which is what keeps a node
context-independent and shareable by identity wherever it appears. So the
control flow has to be born, carried, and consumed inside one node — and the
node's **continuation** operand is where it is carried. A continuation is a
*lambda*: a function of the chain's current value whose argument is elided,
which is what the name says. It is not an `exp` and cannot be lifted out as a
shared node — `['|.', 'b', null]` means nothing on its own.

### Two bits, three lambda types

Those two kinds of control flow are two bits of state:

- **P** — a receiver is live
- **O** — a short-circuit region is open

Neither bit live is the definition of a node boundary, so there are three
continuation types and not four:

| | outside an option | inside an option |
|---|---|---|
| **receiver live** | `propertyLambda` | `optionPropertyLambda` |
| **value only** | *(an `exp`)* | `optionLambda` |

Each node hands its continuation the state it produces — `.` a property, `?.`
a property inside a region, `?.()` a value inside a region — and `()`
produces a bare value, which is why it alone has no continuation operand.

### Four steps

| step | effect | meaning |
|---|---|---|
| `['\|.', index, k]` | sets P, keeps O | property access; the input becomes the receiver |
| `['\|()', exp, k]` | clears P, keeps O | call the current value with the current receiver |
| `['\|?.()', exp, k]` | clears P, **sets** O | the same, `undefined` on a nullish current value — and the region it opens owns the rest of the chain |
| `['\|!()', exp, null]` | clears P, **clears** O | the same as `\|()`, but *outside* the region: the parentheses ended it, so a short-circuit does not skip this step |

`?` adds a guard and `!` escapes one, which makes the three call steps a
complete taxonomy of how a call can relate to the region it sits in:

| step | relationship | example |
|---|---|---|
| `\|()` | inherits the region's guard | `a?.b(...c)` — skipped when `a` is nullish |
| `\|?.()` | adds its own | `a?.b?.(...c)` — also checks `b` |
| `\|!()` | escapes it | `(a?.b)(...c)` — happens regardless, receiver kept |

There is no fourth combination, and `!` pairs only with `()` because only
calls consume receivers — a close-then-access `|!.` would just be a `.` node
over the whole chain node, which nesting already spells.

### Which step is legal where

A step needs a production in a state exactly when moving it into a nested
node would be **observable**. Every alternative is justified by a live bit,
and which bit says why it cannot be a node instead:

| state | step | justified by | hands on |
|---|---|---|---|
| `propertyLambda` | `\|()` | P — nesting loses `this` | *(terminal)* |
| | `\|?.()` | P | O |
| `optionLambda` | `\|()` | O — the region must cover the call | O |
| | `\|.` | O | OP |
| `optionPropertyLambda` | `\|()` | O and P | O |
| | `\|.` | O alone | OP |
| | `\|?.()` | O and P | O |
| | `\|!()` | P — the region is closing anyway | *(terminal)* |

`null` is every state's third exit — the chain simply ends and any live bit
is dropped, which is also the correct spelling of a bare `(a?.b)`, since
closing a region with nothing after it is unobservable.

What is *absent* carries as much as what is present. `|!()` outside a region
is not a design decision — there is no bit to clear. The three real decisions
are `|.` in `propertyLambda` and `|?.()`/`|!()` in `optionLambda`: in each,
no live bit would be destroyed by moving the step into its own node, so the
production would be nothing but a second spelling. The sharpest case is `|.`,
which is in `optionPropertyLambda` and not in `propertyLambda` — same step,
same wasted receiver both times, and the difference is that O is live in one,
so the region will not let it leave. That single asymmetry is why `(a?.b).c`
throws where `a?.b.c` does not.

### Spellings

| JS | EDAG |
|---|---|
| `a.b` | `['.', a, 'b', null]` |
| `a.b.c` | `['.', ['.', a, 'b', null], 'c', null]` |
| `a.b(...c)` | `['.', a, 'b', ['\|()', c, null]]` |
| `(0, a.b)(...c)` | `['()', ['.', a, 'b', null], c]` |
| `a.b?.(...c)` | `['.', a, 'b', ['\|?.()', c, null]]` |
| `f(...c)` | `['()', f, c]` |
| `a?.b` | `['?.', a, 'b', null]` |
| `a?.b.c` | `['?.', a, 'b', ['\|.', 'c', null]]` |
| `(a?.b).c` | `['.', ['?.', a, 'b', null], 'c', null]` |
| `a?.b(...c)` | `['?.', a, 'b', ['\|()', c, null]]` |
| `a?.b?.(...c)` | `['?.', a, 'b', ['\|?.()', c, null]]` |
| `(a?.b)(...c)` | `['?.', a, 'b', ['\|!()', c, null]]` |
| `(a?.b.c)(...d)` | `['?.', a, 'b', ['\|.', 'c', ['\|!()', d, null]]]` |
| `(a?.b).c(...d)` | `['.', ['?.', a, 'b', null], 'c', ['\|()', d, null]]` |
| `a?.b(...c).d(...e)` | `['?.', a, 'b', ['\|()', c, ['\|.', 'd', ['\|()', e, null]]]]` |
| `a?.(...c)` | `['?.()', a, c, null]` |
| `a?.(...c).d` | `['?.()', a, c, ['\|.', 'd', null]]` |
| `(a?.(...c))(...d)` | `['()', ['?.()', a, c, null], d]` |

The `chains` section of [proof.f.mjs](proof.f.mjs) pins the shape of every
spelling above, `chainsJs` next to it runs them as JS on the host engine, and
[amnesia/proof.f.mjs](amnesia/proof.f.mjs) evaluates them as nodes.

### What cannot be written

The uniqueness is structural: the duplicate families a flat array of steps
admitted are not forbidden, they are unspellable, and the `unspellable`
section of [proof.f.mjs](proof.f.mjs) is one case per family.

| family | why |
|---|---|
| `a?.b?.c` | no lambda has a `?.` production; `?.` is only ever a node tag, so a guarded property access always starts a node |
| `a.b(...c)?.d` | `propertyLambda`'s `\|()` is terminal, so the chain exits |
| `(a?.(...b))(...c)` | `optionLambda` has no `\|!()`; the outer call is a plain `()` |
| `a?.b(...c)?.(...d)` | `optionLambda` has no guarded step either — the property variant `a?.b(...c)?.d` is family 1 |

The same holds for dead prefixes: `propertyLambda` has no `|.` production, so
plain property paths nest and `a.b.c` has exactly one spelling. "Exactly one"
is literal rather than "up to trailing junk", because every tuple in the
schema is `close`d — `['.', a, 'b', null, 'extra']` does not validate.

Two things the vocabulary makes disjoint deserve stating, because neither is
cosmetic. **The `|` prefix is a correctness requirement.** Unprefixed,
`['()', f, null]` would be simultaneously a well-formed `()` node — call `f`
with `null` as its arguments — and a well-formed `optionLambda` — call the
chain's value with `f` as its arguments, and stop. The two readings have the
same length, so `close` could not have separated them; only disjoint
vocabularies can. **Terminals state their `null`.** `propertyLambda`'s `|()`
and `optionPropertyLambda`'s `|!()` end the chain, and they say so with an
explicit third operand rather than by being one element shorter: a
two-element terminal handed a real continuation would validate as the
terminal with the rest silently dropped.

### Where the host engines disagree

One spelling is not checked in `chainsJs`, because the engines disagree about
it. When `u` is nullish, `(u?.b)(d)` must throw: the parentheses end the
chain, so `undefined` is called. V8 does throw; JavaScriptCore (hence
`bun test`) carries the short-circuit through the parentheses and evaluates to
`undefined` instead. That case is exactly the `|!()` step, so no JavaScript
oracle can establish it on every supported runner. The EDAG follows the
specification — `['?.', u, 'b', ['|!()', d, null]]` denotes the throwing
reading, and an executor must produce it whatever its host does — as
[amnesia](amnesia/module.f.mjs) does, where
`optionRegion.throw.closeStepOnUndefined` in
[amnesia/proof.f.mjs](amnesia/proof.f.mjs) evaluates the node and pins the
throw on every runner. `(u?.b).c`, the property counterpart, throws everywhere
and is what `chainsJs` pins for this boundary.

One pair of spellings has no proof **anywhere**, and it is worth being exact
about why. `a.b(...c)` and `(a?.b)(...c)` are both `TypeError` on a nullish
base and differ only in whether the arguments ran: the first throws at the
access with `c` untouched, the second short-circuits, evaluates `c`, and
throws at the call. `(a?.b.c)(...d)` against `(a?.b).c(...d)` is the same pair
one step further in. JavaScript cannot pin them, because they are `|!()`
terms; and neither can the node, because *both* readings throw, this language
has no mutation for a skipped operand to record itself with, and a `throw`
case is pass/fail rather than payload-inspecting (`fjs/AGENTS.md` §1.5). What
`amnesia/proof.f.mjs` pins is that each side throws where it should. The order
itself is carried by the shape of `callProperty` in
[amnesia/module.f.mjs](amnesia/module.f.mjs) — it takes the argument *node*
and evaluates it inside the call expression, so JavaScript's own order applies
— and by that function's JSDoc, which says so. Take an evaluated array there
instead and every test still passes.

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

### The cost

Every property access carries a continuation operand, so a plain `a.b` is
`['.', a, 'b', null]` in every graph: more tuple elements to store and hash,
though no ambiguity, since `propertyLambda` has no `|.` production and a
property path keeps its unique spelling.

The deeper cost is purity, and it is unchanged from any other shape that
spells chains out of steps. A continuation is structured now, but it is still
not an `exp`: the `a.b` inside `['.', a, 'b', ['|?.()', c, null]]` cannot be
shared, substituted, or hashed. That is the price of expressing control flow
that no value can carry, and it is confined to exactly the positions that
need it.

## Caveats

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
  In particular `parse` is not a way to canonicalize a graph: it constructs a
  fresh container at every position it visits, so two edges reaching the same
  input reference come back as two distinct outputs, flattening the one
  property the representation exists to carry.
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

## Design

The semantics and operation vocabulary are decided subject by subject in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md); the module
boundary and the plan for generating the Rust types from this schema live in
[edag-spec.md](../../todo/edag-spec.md). Both predate [Chains](#chains) above
and describe the chain nodes as one call tag carrying a flat `lambdas` array
of steps; that array is gone, and this file is the record for what replaced
it and why.
