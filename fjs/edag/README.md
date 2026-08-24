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
not a VM to run FunctionalScript on. The broader identity and memoization
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
| `['()', exp, lambdas, exp]` | call: the value `exp0` plus `lambdas` arrives at, called with `exp2` — see [Chains](#chains) |
| `['?.', exp, index, lambdas]` | optional property access: `exp0?.[exp1]`, then `lambdas` |
| `['?.()', exp, lambdas, exp, lambdas]` | optional call: `exp0` plus the first `lambdas`, called optionally with `exp2`, then the second `lambdas` |
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

An `index` — the property operand of `.`, `?.`, `|.`, and `|?.` — is a
`string`, a `number`, or `['Number', exp]`, a computed index cast to a
number. Among the binary ids, `=>` builds a function and `own` reads an own
property, bypassing the prototype chain (including `__proto__` — see the
`ownJs` proof); calling a function is not among them, since `()` carries a
`lambdas` and so is not binary. A call's arguments — the last `exp` of `()`,
the third of `?.()`, the operand of `|()`/`|?.()` — are one node evaluating
to the complete argument array, not a literal operand list: `f(a, b)` is
`['()', f, [], ['[]', [a, b]]]`, and `f(...xs)` needs no `...` node at all,
since `['()', f, [], xs]` already passes the whole array through. A `...`
node is what mixes the two: `f(a, ...b)` is
`['()', f, [], ['[]', [a, ['...', b]]]]`.

## Chains

A JS member chain carries two kinds of hidden control flow that its operand
values do not: a property access hands its receiver to a following call as
`this` (`[42].at(0)` is `42`, but `const at = [42].at; at(0)` throws), and an
optional link skips the rest of its chain (`undefined?.a.b` is `undefined`,
but `(undefined?.a).b` throws). Parentheses move both boundaries, so both are
part of what a graph means.

Neither is ever the result of an `exp`. Evaluating an `exp` produces an
ordinary value and nothing else, which is what keeps a node
context-independent and shareable by identity wherever it appears. Instead
the three nodes that own a `lambdas` — `()`, `?.`, `?.()` — interpret it as a
sequence of steps, and the receiver and the short-circuit live only in that
interpretation. Each step is one `lambda`: a function of the current chain
value whose argument is elided, which is what the name says.

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
carries no continuation: the rest of the chain is the rest of the `lambdas`.
An optional step whose input is nullish produces `undefined` and skips every
step after it there, leaving its own `index`/argument operand unevaluated —
as does `?.`/`?.()` itself, which is why `a?.[k]` does not evaluate `k` when
`a` is nullish. The empty `lambdas` does nothing: no further steps, no
receiver.

That makes one `lambdas` the whole optional region, and grouping the thing
that ends it:

| JS | EDAG |
|---|---|
| `a?.b` | `['?.', a, 'b', []]` |
| `a?.b.c` | `['?.', a, 'b', [['\|.', 'c']]]` |
| `(a?.b).c` | `['.', ['?.', a, 'b', []], 'c']` |
| `a?.b.c?.d.e` | `['?.', a, 'b', [['\|.', 'c'], ['\|?.', 'd'], ['\|.', 'e']]]` |

`()` and `?.()` are the only call nodes, and their first `lambdas` is what
decides whether the call keeps a `this` binding — the tag never says. One
ending in a property step leaves a receiver, so `a.b(...c)` is
`['()', a, [['|.', 'b']], c]`; an empty one leaves none, so `f(...c)` is
`['()', f, [], c]`; and one ending in a call step leaves none either, since
the call consumed it. This is why there is no `.()` node: the same
operator also spells receiver chains no property-plus-call form could, such
as `(a?.(...b)?.c)(...d)` — `['()', a, [['|?.()', b], ['|?.', c]], d]`.

A parenthesized non-optional chain is no different from an unparenthesized
one, so `a.b.c(d)` and `(a.b.c)(d)` are the same graph. Which spellings a
compiler emits for a chain whose non-optional prefix could equally be `.`
nodes or `|.` steps is a lowering question, decided in
[compile-modules-to-edag.md](../djs/todo/compile-modules-to-edag.md); both
are valid EDAGs meaning the same thing. The `chains` section of
[proof.f.mjs](proof.f.mjs) pins the shape of every spelling above and the
rest of the grouping cases, and `chainsJs` next to it runs those spellings as
JS on the host engine — the receiver surviving `(a?.b)(d)`, the operands an
optional branch skips, and the grouped forms that throw — so the semantics
the nodes are built around are checked, not just asserted in prose.

One spelling is not checked there, because the engines disagree about it.
When `u` is nullish, `(u?.b)(d)` must throw: the parentheses end the chain,
so `undefined` is called. V8 does throw; JavaScriptCore (hence `bun test`)
carries the short-circuit through the parentheses and evaluates to
`undefined` instead. The EDAG follows the specification — the throwing
reading is what `['()', u, [['|?.', 'b']], d]` denotes, and an executor must
produce it whatever its host engine does. `(u?.b).c`, the property
counterpart, throws everywhere and is what `chainsJs` pins for this
boundary.

## Caveats

- Tuples are open on the trailing side: `['args', 'extra']` validates.
  Deliberate in RTTI
  ([Structs and tuples are open](../types/rtti/README.md#structs-and-tuples-are-open));
  exact arity is future work ([close-type.md](../types/rtti/todo/close-type.md)).
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

## Design

The semantics and operation vocabulary are decided subject by subject in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md); the module
boundary and the plan for generating the Rust types from this schema live in
[edag-spec.md](../../todo/edag-spec.md).
