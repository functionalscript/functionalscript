# 66B-djs-serializer-shared-ref-predicate. `djs/serializer`: name the "shared reference" test

**Priority:** P4
**Status:** done

## Problem

`fs/djs/serializer/module.f.ts` extracts repeated values into `const`
declarations so the emitted DJS reuses them. A value is worth extracting when it
is referenced more than once — that is the central concept of the const-hoisting
pass — but the test for it is open-coded as a `refs.get(...)` lookup plus a
`!== undefined && [1] > 1` guard in the two phases that need it:

```ts
// getConstants — decide which values become consts  (:42-43)
const refCounter = refs.get(djs)
if (refCounter !== undefined && refCounter[1] > 1 && !state.added.has(djs)) { … }

// serializeWithConst — emit a reference to an already-hoisted const  (:134-136)
const refCounter = refs.get(value)
if (refCounter !== undefined && refCounter[1] > 1) {
    return [`c${refCounter[0]}`]
}
```

where the counter is `type RefCounter = readonly [number, number]` — `[index,
count]` (`:21`). Both sites:

1. look the value up in `refs`,
2. ask the same question — "does this value have a counter, and is its `count`
   (`[1]`) greater than 1?", and
3. on success read the same `index` field (`[0]`) to form the const name
   (`serializeWithConst`) or are followed by `getConstants` allocating the const.

The predicate `refCounter !== undefined && refCounter[1] > 1` is the definition
of "this value is shared / worth a const", and it is spelled out twice. A reader
has to reconstruct that meaning from the tuple indexing at each site.

## Proposal

Lift the lookup-and-test into one named helper at module scope that returns the
counter only when the value is shared, so call sites both branch on it and read
`[0]` from the same result:

```ts
const sharedRef = (refs: Refs) => (v: Unknown): RefCounter | undefined => {
    const rc = refs.get(v)
    return rc !== undefined && rc[1] > 1 ? rc : undefined
}
```

Then:

```ts
// getConstants
if (sharedRef(refs)(djs) !== undefined && !state.added.has(djs)) { … }

// serializeWithConst
const rc = sharedRef(refs)(value)
if (rc !== undefined) { return [`c${rc[0]}`] }
```

This names the "shared value" concept once, removes the duplicated tuple-index
guard, and keeps the two serializer phases asking the same question through a
single definition — so a future change to what "shared" means (e.g. a size
threshold) lives in one place.

## Why this qualifies

- **DRY.** Two real consumers of the same lookup-and-test, at the second-consumer
  bar in `AGENTS.md`. The varying part is only which map the caller already holds
  (it is the same `refs` both times).
- **Separation of concerns / clarity.** "Is this value referenced more than
  once?" is the serializer's core decision; today it is expressed as raw tuple
  indexing inline in two phases. Naming it documents the invariant that drives
  const hoisting.

## Caveats

- `stringify`'s `constSerialize` (`:187-191`) also does `refs.get(entry)` but
  there the counter is **known** to exist (the entry came from `getConstants`),
  so it `throw`s on `undefined` and uses `[0]` unconditionally. That site is a
  different contract (lookup-or-invariant-violation, not a shared test) and
  should keep its own `refs.get` — don't fold it into `sharedRef`.
- The helper returns the counter (not a `boolean`) specifically so
  `serializeWithConst` can read `rc[0]` without a second lookup; `getConstants`
  only needs the `!== undefined` check.

## Tasks

- [x] Add the `sharedRef` helper at module scope in
      `fs/djs/serializer/module.f.ts`.
- [x] Route `getConstants` and `serializeWithConst` through it.
- [x] Confirm `fs/djs` proofs still pass (`fjs t`) with full coverage and
      `npx tsc` is clean.

## Related

- [i157-json-djs-shared-core](./157-json-djs-shared-core.md) — the shared
  JSON/DJS value layer; this is an internal DJS-serializer cleanup independent
  of it.
