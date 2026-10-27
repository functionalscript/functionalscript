## Preserve earlier eager work before shared-owner placement

**Priority:** P1
**Status:** open

Common [`fromAnalysis`](../module.f.mjs) can establish a shared owner before an
earlier eager computation that remains inline. This changes divergence into
failure for separately supplied, valid EDAG data. The defect is present in the
parent of the module-level `while` change; that change does not fix general
shared-owner placement.

A minimal graph uses the same `bad` node twice:

```js
const forever = ['=>', 0, [], ['()', ['self'], []]]
const diverge = ['()', forever, []]
const bad = ['throw', 2]
const graph = ['[]', [diverge, bad, bad]]
```

`identityAnalysis` and `checked` admit this graph. Both the memo and Amnesia
executors continue evaluating the first array element indefinitely. Common
conversion and preparation instead produce the equivalent of:

```js
const forever = () => { while (true) {} }
const bad = (() => { throw 2 })()
return [forever(), bad, bad]
```

Native execution fails before entering `forever`. The distinction is failure
versus divergence, not which throw payload or finite failing operation occurs
first. The same behavior was reproduced with `to_fast/module.f.mjs` from
`79dd0f1f17a75bf5749f458501b3d77513f021ae`, before module-level `while` support.

A source declaration that establishes `bad` before the array has a different
required order. However, a later inlined IIFE can introduce the shared owner
at its original operand position. The following admitted source also diverges
natively, while its graph still diverges in both represented executors and its
currently emitted source fails:

```js
let i = 0
while (i < 1) { i = i + 1 }
const forever = () => { while (true) {} return 0 }
export default [forever(), (() => {
    const bad = null.x
    return [bad, bad]
})()]
```

The writer moves `const bad = null.x` ahead of the call to `forever`. The
leading finite module loop is not needed for the placement defect, but shows
that newly admitted module-loop programs can reach it. Removing that prefix
and running both `from_fast` and `to_fast` from the parent revision reproduces
the same failing native output; the source bug therefore predates module-level
`while` admission. Source-derived required anchors, local IIFE order, and strict
emitted-source fixed points must remain
intact while fixing or explicitly refusing the placement case.

Choose an owner placement or a focused refusal that preserves earlier eager
work, successful sharing, and lazy-region selection. Keep the decision in
common conversion rather than adding a target-specific serializer walk. Prove
the graph above against the represented executors and emitted native code;
cover an earlier lazy region before a later shared demand as well. Naming
owners solely by canonical node index is insufficient to establish their
execution order.
