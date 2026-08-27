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

- [`../../edag/module.f.mjs`](../../edag/module.f.mjs) — `array`/`object` use the
  nested form.
- [Open containers](../README.md#open-containers) — `rest(c, r)` states a
  prefix and a homogeneous tail, so the shape above is now spellable as one schema.
  It is still not *inline* in a bigger `Const` tuple, which is the gap this file
  describes, and `edag`'s nested form stays the decided representation either way.
- `../ts/types.ts`, `RestTs`'s doc comment — the type-level side of a related but
  distinct problem: rendering an *existing* open tuple's TypeScript type, not
  constructing a schema with this shape in the first place.
