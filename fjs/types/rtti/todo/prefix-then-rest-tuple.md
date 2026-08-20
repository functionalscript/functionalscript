# A tuple schema with a fixed prefix and a homogeneous rest, spelled inline

**Priority:** —
**Status:** closed — not pursuing

## The gap

A `Tuple` schema (`readonly Type[]`) pins one schema per position. There is no way to
write "this literal tag, then any number of further positions, all matching this one
schema" as a single `Const` tuple — `array`/`record` say exactly that, but only as
their *own* single schema position, not spread inline into a bigger tuple's remaining
slots.

## Decided: `edag` will not chase the spec's flat spelling

The EDAG spec's structural-operations table writes array and object constructors
flat and variadic: `['[]', ...elements]`, `['{}', ...entries]`. `edag/module.f.mjs`
cannot write that as an rtti schema (the gap above), so it nests the variadic part
one position deeper instead — `['[]', [elem, elem, ...]]`, `['{}', [entry, entry,
...]]`.

That nested form is not a workaround standing in for the flat one — it is the decided
representation. Growing the rtti `Type` ADT to match the flat spelling has no other
motivating consumer in this codebase, so there is nothing open here to track.

## Related

- [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — `array`/`object` use the
  nested form.
- [`close-type.md`](./close-type.md) — a different tuple-shape gap (stating an *exact*
  length), not this one (stating a *variadic* tail); that one is still open.
- `../ts/types.ts`, `TupleTs`'s doc comment — the type-level side of a related but
  distinct problem: rendering an *existing* open tuple's TypeScript type, not
  constructing a schema with this shape in the first place.
