# Exclude specific string values from a schema

**Priority:** P3
**Status:** open

## Problem

rtti's `Type` ADT has no negation. `Const`, `Tag0`/`Tag1`, and `Or` are all *positive*
— they state what a value must match, never what it must not be. There is no way to
write "any string except these" as a schema.

## Why it matters for `../../../edag`

`index`'s `string` branch (`../../../edag/module.f.mjs`) is meant to admit any property
name *except* `'__proto__'` and `'constructor'` — see "the current decision is to
prohibit both" in [`../../../../spec/todo/2330-property-accessor.md`](../../../../spec/todo/2330-property-accessor.md).
Today it admits every string, prohibited names included:
`validate(exp)(['.', 'a', 'constructor'])` returns `ok`.

This can't be fixed by composing existing rtti primitives — there is nothing to
subtract a finite set from `string` with. It needs either:

- a new rtti schema variant for "primitive minus an enumerated set" (a real addition to
  the `Type` ADT, with its own `Ts<>` mapping — likely `Exclude<string, Denylist[number]>`
  is enough on the type side, so this is mostly a runtime/`validate`/`parse` addition), or
- a value-aware check layered on top of `validate(exp)`/`parse(exp)` specifically for
  `edag`, outside the schema — the same shape as the cycle-detection concern this
  module's input boundary also has.

Which of these is worth it depends on whether any other schema in the codebase turns
out to need the same "all but a few" shape; if `edag` stays the only caller, the
layered check is probably simpler than growing the `Type` ADT for one consumer.

## Related

- [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — `index`'s doc comment
  notes the gap and points here.
- [`../../../../spec/todo/2330-property-accessor.md`](../../../../spec/todo/2330-property-accessor.md)
  — the prohibited-name list this would enforce.
- [Closed containers](../README.md#closed-containers) — the other extension to the
  `Type` ADT (exact/closed containers), for comparison: it shipped because its
  data-form mapping was worked out end to end first; this one has no mapping yet.
