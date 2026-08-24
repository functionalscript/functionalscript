# Audit: `const` type parameters

**Priority:** P2
**Status:** implemented — 9 modifiers added, 69 of 268 `@type {const}` casts removed

### Problem

FunctionalScript data is immutable and its types are literal, but TypeScript
widens a literal by default. [fjs/AGENTS.md](../fjs/AGENTS.md) answers that with
the "Pin literal `const`s" rule, and the pin at a *call site* is an inline
`/** @type {const} */` cast — the one inline cast
[inline-type-casts.md](./inline-type-casts.md) deliberately left out of scope
(221 of them at the time it was measured).

A `const` type parameter is the answer that rule cannot give. `<const T>` tells
TypeScript to infer the argument the way `as const` would, so the caller writes
the literal and the callee keeps it:

```js
validate(/** @type {const} */ ({ a: 42 }))   // a reader for `{ a: 42 }`
validate({ a: 42 })                          // the same, with `<const T>`
```

Where the callee is generic over what the caller writes, the cast is the
absence of a modifier on the signature — not a fact about the value.

### What TypeScript supports

Verified against the repository's TypeScript (7.0.2) — every JSDoc spelling
works:

| Form | Legal |
| --- | --- |
| `/** @template const T */`, `/** @template {C} const T */` | yes |
| `/** @type {<const T extends C>(x: T) => R} */` | yes |
| `export type F = <const T>(x: T) => R` in a `types.ts` | yes |
| `export type A<const T> = …` on a **type alias** | **no** — TS1277, `const` is only for a function, method, or class type parameter |

So a type alias cannot carry the modifier; a *function type* named by an alias
can, which is how `_MakeType1` gets it below.

### Method

Every `/** @type {const} */` cast in `fjs/` was enumerated mechanically (268),
and each was probed against a clean `npx tsc` baseline with that one cast
deleted. Passing `tsc` is not sufficient for a *declaration* pin — dropping one
widens the type silently — so the probe was used only to find candidates, and
each removal was then justified by its callee: a `const` generic (equivalent to
the cast by construction) or a non-generic parameter (the cast was decorative).

Two further checks, both from the earlier audit's corrections:

1. **Declaration-emit diff.** `tsc --noEmit false --emitDeclarationOnly` before
   and after. The only differences are the intended `const` modifiers, the
   `Or<[…]>` → `Or<readonly […]>` change below, and the added assertions.
2. **Every modifier must be load-bearing.** Each added `const` was removed again
   in isolation to confirm `npx tsc` then fails. Of the 16 tried, 13 changed
   nothing on removal. Seven of those were dropped outright — the six internal
   helpers in the `validate`/`parse` visitors, whose signatures are erased at
   the `any` dispatch boundary, and `bnf` `repeat0Plus`. The rest got the
   assertions listed below, and writing them exposed the rule that makes this
   worth stating: for a *primitive* argument TypeScript already keeps the
   literal when the type parameter's constraint admits primitives, so
   `validate(42)` reads `42` with or without the modifier. Only object and
   array literals need it, so that is what the assertions use.

`npx tsc` and `fjs t` (3128 proofs) pass.

### What landed

| Signature | Modifier | What it buys |
| --- | --- | --- |
| `types/rtti` `or` | `@template {readonly Type[]} const T` | `or(42, number)`, `or(false, 42, 'hello')`; the rest tuple is `readonly` |
| `types/rtti` `option` | `@template {Type} const T` | `option([42, string])` |
| `types/rtti` `_MakeType1` (`array`, `record`) | `<const T extends Type>` | `array('hello')`, `record({ a: number })` |
| `types/rtti/validate` `validate` | `<const T extends Type>` | `validate({ a: 42, b: 'hello' })` |
| `types/rtti/parse` `parse` | `<const T extends Type>` | `parse([42, 'hello'])` |
| `types/result` `ok`, `error` | `@template const T` / `const E` | `error(['notImplemented', 'read'])` stays a tuple of literals |
| `bnf` `option` | `@template {Rule} const S` | drops the cast inside `repeat0Plus` |
| `protocol/mcp` `toolEntry` | `@template {Type} const T` | an inline schema literal reaches the handler as `Ts<T>` — the shape `../fjs/protocol/mcp/README.md` documents |

69 casts went with them, the densest clusters being the two rtti reader proofs
(54) and `media/json/schema/proof` (6). Four assertions in
[`fjs/types/rtti/proof.f.mjs`](../fjs/types/rtti/proof.f.mjs) and one each in the
`validate`, `parse`, `result`, and `protocol/mcp` proofs pin the inference, so
dropping a modifier fails the build rather than silently widening a schema.

**API change.** `or` takes its arguments as a rest parameter, so `const`
inference also makes the inferred tuple `readonly`: an exported schema built
with `or` is now `Or<readonly [A, B]>` where it was `Or<[A, B]>`. That is the
`range_map` mistake from the previous audit — a purely functional library
publishing a mutable array type — fixed by the same modifier, and it is a
breaking change for anyone who spelled `Or<[A, B]>` by hand.

### Where a `const` type parameter does not help

The 199 remaining casts are not this rule's to remove:

| Shape | Count | Why the modifier cannot reach it |
| --- | --: | --- |
| Declaration pin — `const x = /** @type {const} */ (…)` | 119 | the literal widens at the declaration, before any call; the "Pin literal `const`s" rule governs, and a later `validate(x)` only sees what `x` already is |
| Inside a literal or an argument to a non-generic parameter | 46 | mostly decorative: `eq(…)`, `toData(…)` and the `rows` tables take a plain `Type`, so the cast changes nothing the callee can observe. Removable, but as inline-cast cleanup, not as this rule |
| Result of an arrow passed to `.map`/`.flatMap` | 21 | the callee is `Array.prototype.map`; there is no signature here to modify |
| `for (const x of /** @type {const} */ ([…]))` | 5 | no callee at all |
| Other | 8 | — |

### Considered and not adopted

- **`effects` `pureOk` / `pureError`.** `pureOk([])` is the idiomatic "empty"
  lift; `const` makes it `readonly []`, which then will not unify with the
  `Vec[]` branch beside it in `cas/module.f.mjs`. A general-purpose value
  lifter should not over-fit its argument.
- **`bnf` `repeat0Plus`, `repeat1Plus`, `join1Plus`, `join0Plus`.** More precise
  `Rule` types, but nothing consumes the precision and no cast goes away, so the
  modifier would be noise. `option` alone carries its weight.
- **`media` `dialectEntry`, `types/array` `includes`.** Every caller passes an
  already-pinned named schema. Worth revisiting the day one inlines a literal.
  `toolEntry` was rejected on the same ground and then reinstated: its
  `README.md` documents an inline schema literal, so the API's front door is a
  call site even where the tree has none.
- **`asserts` `assertEq`, `effects/memory` `create`.** `const` narrows the wrong
  way here — `assertEq(x, 42)` infers from both arguments, and a memory cell
  keyed by a literal type is over-narrow.

### Follow-ups

- The 46 decorative casts belong to
  [inline-type-casts.md](./inline-type-casts.md)'s remit; that audit excluded
  `@type {const}` wholesale, and this one shows the exclusion was too broad.
- A **checked** pin for the 119 declaration sites: `export const x = type({…})`
  with `type` a `<const T extends Type>(t: T) => T` identity would pin *and*
  check that the literal really is a `Type`, which `as const` never does. It
  costs a runtime function, so it needs its own design discussion before
  anything moves.
- [eslint.md](./eslint.md) — nothing stops the removed casts from coming back.
