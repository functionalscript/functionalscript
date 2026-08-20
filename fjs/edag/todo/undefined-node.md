# A dedicated `['undefined']` node, instead of bare `undefined` as a primitive

**Priority:** P2
**Status:** open

## Problem

`Primitive` (`../types.ts`) includes bare `undefined`, so `exp` accepts it as an
ordinary value — indistinguishable from what JS itself hands back when a tuple
position is simply absent (`arr[i]` past the end is `undefined` either way). Every
fixed-arity operand position typed `exp` inherits this, so a *missing* operand reads
as valid, not as an error:

```js
validate(exp)(['Number'])              // ok — operand missing, reads as undefined
validate(exp)(['()'])                  // ok
validate(exp)(['.()', 'o', 'x'])       // ok — third operand missing
```

`parse(exp)` makes it worse: it doesn't just accept these, it *materializes* the
missing position as an explicit `undefined` in the rebuilt value, so a truncated
serialized input and a complete one can both be accepted and even normalize to the
same parsed shape — for operations (`numberCast`, `call`, `propertyCall`, …) that are
supposed to have a fixed canonical arity. (Raised as a PR #1653 review comment,
`fjs/edag/module.f.mjs:104`.)

This is unrelated to the already-decided open-on-the-right behavior (`args`'s
`extraTailIsIgnored`, tracked via `../../types/rtti/todo/close-type.md`) — that's about
a tuple accepting *more* positions than declared; this is about a declared position
being silently satisfiable by *absence*.

## Proposed fix

Remove `undefined` from `Primitive`, and add `['undefined']` — a tagged tuple, the
same shape as `['args']` — as the way an `Exp` represents the JS value `undefined`.

With that change, a missing tuple position (JS's out-of-bounds `undefined`) no longer
matches any `exp` alternative: `Primitive` no longer admits bare `undefined`, and
`['undefined']` requires an actual array element to be present. So every `exp`-typed
operand position — `numberCast`'s operand, `call`'s and `propertyCall`'s operands,
`array`'s elements, `object`'s entry values, `propertyAccessor`'s object, `property`'s
value, and so on — gets the fix at once, from one change to `Primitive`/`exp`, rather
than needing a bespoke arity check per node kind.

## Consequences

- Every place in `../module.f.mjs` and `../types.ts` that currently accepts bare
  `undefined` as a `Primitive`/`Exp` value needs to represent it as `['undefined']`
  instead — this is a breaking change to what counts as a well-formed `Exp`, not just a
  documentation update.
- `../proof.f.mjs`'s `missingTailIsUndefined`-style cases (`call`, `numberCast`) assert
  the *current* behavior as correct (`assertOk`) — this fix would flip them to
  `assertNoMatch`, matching what `propertyAccessor`'s `missingIndexIsError` already
  does for its `index` position (which never admitted `undefined` in the first place).
- Anywhere an EDAG genuinely needs to represent "the value `undefined`" (e.g. `const x
  = undefined`) writes `['undefined']` from then on.

## Related

- [`../module.f.mjs`](../module.f.mjs) — `primitive`/`exp`.
- [`../proof.f.mjs`](../proof.f.mjs) — the `missingTailIsUndefined`-style cases that
  would need to flip.
- [`../../types/rtti/todo/close-type.md`](../../types/rtti/todo/close-type.md) — the
  other direction of tuple openness (extra positions), not this one.
