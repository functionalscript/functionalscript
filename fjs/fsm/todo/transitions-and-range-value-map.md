## transitions-and-range-value-map. `addEntry` mixes the walk with the transition build, and three helpers map a range entry's value

**Priority:** P4
**Status:** open

### Problem

`addEntry` in [`module.f.mjs`](../module.f.mjs) does three jobs in one
body: the memoised recursion over the subset construction (`at(s)(dfa)`,
then the recursion into each new state), the computation of one state's
transition map (`fold(foldOp(set))(emptyList)(grammar)`), and the
rendering of the map's keys (`toArray(keyEntries(setMap))`). A reader
who wants the transition function has to find it inside the walk.

Three helpers beside it each destructure a `RangeEntry` to rewrite its
value and keep its bound:

```js
// labelRange
const labelRange = ruleOut => ([inSet, max]) => [inSet ? [ruleOut] : [], max]
// keyEntry
const keyEntry = ([sortedSet, max]) => [toKey(sortedSet), max]
// entryValue
const entryValue = ([value]) => value
```

"Map the value of a range entry" is [`fjs/types/range_map`](../../types/range_map/module.f.mjs)'s
to offer; it does not yet, so `fsm` spells it per use.

### Proposal

`range_map` exports `mapValue: (f) => ([v, max]) => [f(v), max]` and
`values`. Then `labelRange = ruleOut => mapValue(b => b ? [ruleOut] : [])`,
`keyEntry = mapValue(toKey)`, and `entryValues` is `values`. In `fsm`,
`transitions = grammar => set => fold(foldOp(set))(emptyList)(grammar)`
is pulled out, so `addEntry` is only the memoised walk, and the
transition function is a name.

### Tasks

- [ ] `mapValue` and `values` in `range_map`, proved.
- [ ] `transitions` in `fsm`; `addEntry` over it; `labelRange` and
      `keyEntry`, the two that keep the bound, through `mapValue`;
      `entryValues`, which drops it, replaced by `values`.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [recognizer-backend](../../ebnf/todo/recognizer-backend.md) — names
  `fsm` as an engine to reuse; a named transition function is what it
  would reuse.
