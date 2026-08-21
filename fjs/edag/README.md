# EDAG

An **e**xpression **DAG** — the canonical data representation of a function
body. A body is a single root expression node; a shared subexpression is one
node referenced from several places, not a copy — sharing is observable
(`{} === {}` is `false`), so it is part of the function's meaning, not a
serialization trick. There is no normal form: a function's hash is the
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
runtime with `validate(exp)`. [types.ts](types.ts) carries the same shape at
the type level, pinned against the schema with `Assert<Check<...>>` so the
two cannot drift. [proof.f.mjs](proof.f.mjs) pins the runtime behavior of
every node kind.

## Nodes

A node is a primitive or a tagged tuple `[tag, ...operands]`.

| form | meaning |
|---|---|
| `null`, `boolean`, `number`, `string`, `bigint` | itself |
| `['undefined']` | `undefined` — tagged, because a bare `undefined` is indistinguishable from a missing tuple position |
| `['[]', exps]` | array literal |
| `['{}', properties]`, each `[':', key, value]` | object literal; the key is an `exp`, one form for `a:`, `"a":`, and computed `[exp]:` keys |
| `['args']` | the function's arguments |
| `['frame']` | the captured frame |
| `['.', exp, index]` | property access: `exp0[exp1]` |
| `['.()', exp, index, exp]` | property call: `exp0[exp1](exp2)` |
| `[',', exps]` | comma: establish all operands, take the value of the last |
| `[id, exp]` | unary operation, `id` one of `String` `Number` `neg` `!` `~` |
| `[id, exp, exp]` | binary operation, `id` one of `=>` `own` `()` `===` `!==` `>` `>=` `<` `<=` `+` `-` `*` `/` `%` `**` `&` `|` `^` `<<` `>>` `>>>` `&&` `||` `??` |

An `index` — the property operand of `.` and `.()` — is a `string`, a
`number`, or `['Number', exp]`, a computed index cast to a number. Among the
binary ids, `=>` builds a function, `()` calls one, and `own` reads an own
property, bypassing the prototype chain (including `__proto__` — see the
`ownJs` proof).

## Caveats

- Tuples are open on the trailing side: `['args', 'extra']` validates.
  Deliberate in RTTI
  ([Structs and tuples are open](../types/rtti/README.md#structs-and-tuples-are-open));
  exact arity is future work ([close-type.md](../types/rtti/todo/close-type.md)).
- Neither `validate` nor `parse` is identity-aware, each in its own way:
  `validate` returns the original value — sharing intact — but re-walks a
  shared subgraph once per incoming edge (exponential in depth) and
  overflows the stack on a cycle instead of rejecting it; `parse` rebuilds
  every container, so sharing is lost —
  [identity-aware-parse.md](../types/rtti/todo/identity-aware-parse.md).
- `[',', exps]` is a known-incomplete placeholder; the settled shape must
  express "at least one operand, last is the result".
- `index` does not yet exclude `constructor`/`__proto__` —
  [excluded-string-values.md](../types/rtti/todo/excluded-string-values.md).

## Design

The semantics and operation vocabulary are decided subject by subject in
[edag-stage1-discussion.md](../../todo/edag-stage1-discussion.md); the module
boundary and the plan for generating the Rust types from this schema live in
[edag-spec.md](../../todo/edag-spec.md).
