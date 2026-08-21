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
`comma` excepted until its placeholder shape settles.

## Nodes

A node is a primitive or a tagged tuple `[tag, ...operands]`. In the schema
and the type-level API, operation nodes are grouped by their `exp`-operand
count — `op0` (`undefined`, `args`, `frame`), `op1` (unary), `op2` (binary)
— not by semantic category. This table is an overview; the contract of
record for each node is the JSDoc in [module.f.mjs](module.f.mjs) — on the
node's export and, for the operations, on the `op0Id`/`op1Id`/`op2Id`
vocabularies.

| form | meaning |
|---|---|
| `null`, `boolean`, `number`, `string`, `bigint` | itself |
| `['undefined']` | `undefined` — tagged, because a bare `undefined` is indistinguishable from a missing tuple position |
| `['[]', items]`, each an `exp` or a `spread` | array literal; `[a, ...b]` splices `b`'s elements in at that position |
| `['{}', properties]`, each `[':', key, value]` or a `spread` | object literal; ordered entries applied in written order, duplicates allowed with the later winning; the key is an `exp`, one form for `a:`, `"a":`, and computed `[exp]:` keys; the `:` descriptor is a structural operand, not a node — only its key and value are; `{...a}` splices `a`'s own properties in at that position |
| `['...', exp]` | spread — only valid as an `items`/`properties` entry above, never a top-level `Exp` |
| `['args']` | the function's arguments |
| `['frame']` | the captured frame |
| `['.', exp, index]` | property access: `exp0[exp1]` |
| `['.()', exp, index, exp]` | property call: `exp0[exp1](...exp2)` |
| `[',', exps]` | comma: establish all operands, take the value of the last |
| `[id, exp]` | unary operation, `id` one of `String` `Number` `neg` `!` `~` |
| `[id, exp, exp]` | binary operation, `id` one of `=>` `own` `()` `===` `!==` `>` `>=` `<` `<=` `+` `-` `*` `/` `%` `**` `&` `\|` `^` `<<` `>>` `>>>` `&&` `\|\|` `??` |

An `index` — the property operand of `.` and `.()` — is a `string`, a
`number`, or `['Number', exp]`, a computed index cast to a number. Among the
binary ids, `=>` builds a function, `()` calls one, and `own` reads an own
property, bypassing the prototype chain (including `__proto__` — see the
`ownJs` proof). A call's arguments — `()`'s second operand and `.()`'s last
— are one node evaluating to the complete argument array, not a literal
operand list: `f(a, b)` is `['()', f, ['[]', [a, b]]]`, and `f(...xs)`
needs no `...` node at all, since `['()', f, xs]` already passes the whole
array through. A `...` node is what mixes the two: `f(a, ...b)` is
`['()', f, ['[]', [a, ['...', b]]]]`.

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
  with primitives and `null` simply contributing nothing (`{...null}` is
  `{}`). Object spread copies own enumerable properties *through* getters,
  unlike `own`, which reads the descriptor's value and never calls one.
- `index` does not yet exclude `constructor`/`__proto__` —
  [excluded-string-values.md](../types/rtti/todo/excluded-string-values.md).

## Design

The semantics and operation vocabulary are decided subject by subject in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md); the module
boundary and the plan for generating the Rust types from this schema live in
[edag-spec.md](../../todo/edag-spec.md).
