## Keep value-block anchors after earlier operand work

**Priority:** P1
**Status:** wip

`fromFast` can float a later operand's required evaluations before an earlier
operand that fails or diverges. Required work inside a value block must remain
at that operand's execution point. Keeping the correct order in `to_fast`
alone does not make the graph produced by the reverse conversion correct.

For example, this admitted EDAG evaluates the noncallable `0` before reaching
the explicit throw in its second array item:

```js
const graph = ['[]', [
    ['()', 0, []],
    [',', [['throw', 'later'], 1]],
]]
```

The represented executor returns an implicit failure (`['undefined']`), and
direct native output throws `TypeError`. After
`fromFast(assertOk(toFast(graph)))`, the explicit `'later'` throw moves ahead
of the call. Its emitted source is equivalent to:

```js
const unused = (() => { throw 'later' })()
export default [0(), 1]
```

The same floating can reintroduce a shared-owner ordering defect after output
conversion has correctly localized the owners in the later operand:

```js
const bad = ['.', null, 'x']
const both = ['[]', [bad, bad]]
const graph = ['===', ['throw', 'earlier'],
    ['.', bad, 'f', ['|()', [both, both]]],
]
```

Direct represented evaluation throws `'earlier'`. With localized owner
placement, direct output keeps `bad` and `both` inside the right operand and
throws `'earlier'` too. Reverse graph construction floats both definitions to
the enclosing prefix, so its graph and native output fail at `null.x` first.
The right operand needs two anchors: member lookup precedes the argument read,
so the complete anchor list cannot be elided from its result's demand prefix.
That does not authorize moving the list before the left operand.

Both defects were independently reproduced with `from_fast` and `to_fast`
from `30e0652bb948d8a161173a90e7e7c5f0a8d0ba48`, before the shared-owner
ordering fix. The first case already has correct direct output there; the
second also exposes that revision's earlier output-placement defect. Its
reverse conversion remains wrong even when given FAST with the correctly
localized later operand. This is a graph-construction follow-up, not permission
to weaken the ordering or strict round-trip checks in output conversion.

Preserve operand-local required work through eager operators and containers,
including before later calls, member arguments, spreads and computed keys.
Prove implicit failure versus explicit thrown values, divergence versus
failure, successful shared identity, selected lazy regions, and scope/capture
lifetimes. Any graph-normalization decision must retain those execution
contracts and stabilize without accumulating anchors or helper boundaries.
