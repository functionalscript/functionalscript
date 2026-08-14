## `toRangeMap` bakes in an FSM payload

**Priority:** P3
**Status:** open

### Problem

Everything else in `byte_set` is `ByteSet → ByteSet`/`boolean` bitmask
algebra. `toRangeMap` (`module.f.mjs:56-66`) alone drags in `list`,
`range_map`, and `sorted_set`, and hardcodes a `SortedSet<string>` state-name
payload:

```js
/** @type {(n: ByteSet) => (s: string) => (i: number) => RangeMap<SortedSet<string>>} */
const toRangeMapOp = n => s => i => { ... prev ? [s] : [] ... }
```

That is a DFA-construction concept: its only caller is `fsm`'s `foldOp`
(`fjs/fsm/module.f.mjs:55`), which merges the result into a
`RangeMap<SortedSet<string>>` keyed by rule name. A `types` leaf naming
`string` and `SortedSet` for one higher-level consumer is a layering
inversion (DESIGN.md §4: move logic to its natural module even with a
single consumer when it is conceptually distinct).

[bit-set-factory](../../todo/bit-set-factory.md) already decided `toRangeMap`
does not belong in the shared bitmask factory; this issue is about the other
half — the payload and the dependency direction.

### Proposal

Either move `toRangeMap` into `fjs/fsm`, or make the payload generic —
`(n: ByteSet) => <T>(v: T) => RangeMap<T>` — so `byte_set` stops naming
`string`/`SortedSet<string>` and drops its dependency on two higher-level
container modules.

### Tasks

- [ ] Pick a home (move to `fjs/fsm`) or generalize the payload type
- [ ] Update `fsm.foldOp` and the proofs

### Related

- [bit-set-factory](../../todo/bit-set-factory.md) — rules `toRangeMap` out
  of the factory; this issue covers what remains
