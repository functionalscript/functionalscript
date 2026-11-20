## A reference map as an evaluated value of its own

**Priority:** P2
**Status:** open — one of three options for the interpreters' reference map; none is chosen ([the options](./host-values.md#options))

### Problem

The interpreters answer the EDAG's `['refMap']` with
[`fjs/js/ref_map`](../../js/ref_map/module.f.js), a list of pairs searched
with `===`, so a call takes `O(n)` steps where the
[contract](../../../spec/built-ins/reference-map/README.md) asks `O(log n)`.
The measurement is in [host values](./host-values.md#problem): 8,000 keys
set and read take 477 s.

### Proposal

Keep `EdagValue` as it is and add one form to it, a map the interpreter made:

```js
['refMapRt', map, pairs]
```

- `map` is the host's reference map,
  [`fjs/types/ref_map`](../../types/ref_map/module.f.js), keyed on the
  evaluated values themselves. An interpreter is FunctionalScript run by a
  host, and an evaluated array, object or closure is a node whose identity
  is the value's ([`../value/README.md`](../value/README.md), "Identity is
  kept"), so the host's map finds it. A read and a write take `O(log n)`
  steps, and an older map is still the map it was.
- `pairs` is what was set, newest first, as a linked list
  `[key, value, rest]`, so a write adds to it in one step. The host's map
  cannot be enumerated; `pairs` is what the map is written out from.

The form is the interpreter's alone. It is no EDAG, and it is normalized
where a value leaves the interpreter, on serialization and on conversion to
FAST: to the fold over the empty map that the
[design record](../../../spec/design/object-identity.md#reference-map)
describes, or to the runtime's function with its pairs, as a map is written
today.

Nothing is threaded through invocations: the value carries its own index.

### What a design has to settle

- **`EdagValue` is no longer a subset of `Exp`.** The check
  (`_Subset` in [`../value/types.ts`](../value/types.ts)) holds for every
  form but this one. Whether the type is split into what an interpreter
  holds and what is written, and where normalization is the boundary
  between them.
- **A map is a function.** A call of it, its `length`, `typeof` and its
  text each need a case, where today a map is an ordinary closure and needs
  none.
- **Keys that are no closure.** A static function is one function however
  often read, and an intrinsic is fresh where its node is established
  ([`../value/types.ts`](../value/types.ts)). Whether the nodes the
  interpreters hold for them keep those identities, so that the host's map
  answers as `===` does.
- **What is written.** `pairs` holds every write, a key set twice
  included. Whether the written map keeps them all or the newest for each
  key.

### Tasks

- [ ] Check the identity of static and intrinsic function values as keys.
- [ ] Add the form, its call and its normalization.
- [ ] Time the reference-map program of [host values](./host-values.md#problem)
  and the whole compiler evaluated, 19 min 25 s at `9a14b1d`. What is left
  says how much the other two costs named there are.

### Related

- [Host values](./host-values.md) — the options side by side, and the wider
  one.
- [A store for reference maps](./reference-map-store.md) — the index kept
  outside the value.
- [`fjs/types/ref_map`](../../types/ref_map/module.f.js) — the host's map.
