## Select through a spread by the evaluated lengths

**Priority:** P3
**Status:** open

### Problem

The `.json` output refuses a value with a shared node, and the sharing
sweep in [`../ast/module.f.mjs`](../ast/module.f.mjs) (`sharing`) decides
it from the syntax. A key into an array literal selects one item —
`literalAt`, through `selected` and `refsAlong` — unless the literal holds
a spread: then which item a key names depends on how many elements each
spread yields, so `selectable` says no and the walk reads every item the
key may select.

That is never a wrong value, but it refuses a module whose selected item
shares nothing:

```js
const x = {};
const a = [...[], 1, [x, x]];
export default a[1]; // 1, refused: "no JSON spelling for a shared node"
```

The unselected `[x, x]` is counted, and it holds `x` twice.

### Proposal

Resolve the key against the evaluated lengths, as `elementKeys` already
expands an each-element key against the evaluated value: a spread's width
is the number of elements its operand yields — evaluated with the module's
`consts` and imports, the state `values` ran with — and a key names the
value item or the spread element at that position. The value view then
depends on that state, so it is made per sweep rather than once.

### Tasks

- [ ] The value view built from the run state, its `through` and `spread`
      selecting by the evaluated widths.
- [ ] Proofs: the module above writes `1`, and the same with `a[2]` is
      still refused.

### Related

- [spread](../../../spec/README.md#spread) — what a spread contributes to
  an array.
