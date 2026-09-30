## drop-proxy. Stop giving host functions a text rendered from their EDAG

**Priority:** P2
**Status:** open

### Problem

[`withText`](../module.mjs) wraps each function the evaluator makes in a
`Proxy` whose `toString` answers the writer's rendering of its `=>` node.
The host then carries a text that FunctionalScript made up from the EDAG,
not a text the host produced. That is the wrong layer for it: a host
function should not be constructed with our string
([review on #2418](https://github.com/functionalscript/functionalscript/pull/2418)).
It also costs:

- **A `Proxy` per function value.** Every call goes through the proxy, and
  calls were about 4.5 times slower in a Node measurement.
- **Conversions the host decides.** The trap only sees the hint, so a
  refused text refuses `+f` and `f < 5` as well as `f < "z"`
  ([README](../README.md)), where `nanvm-lib` answers the first two.
- **A host-only path.** The FunctionalScript runner and `memo` cannot build
  the adapter, so they still answer the wrapper's source.

### Direction

Remove the adapter and the `withText` hook, and have the function's text
answered by what owns the conversion rather than by the host function.
Where the evaluator converts a function itself, it can render the node it
holds. That leaves the question of how the corpus's `host` cases
(`fjs/nanvm`) are checked on the JavaScript side, or whether they return to
being `nanvm-lib`'s alone.

### Tasks

- [ ] Choose where a function's text comes from without the `Proxy`.
- [ ] Remove `fjs/types/function/text`, the `withText` hook in
      `fjs/edag/operations` and `fjs/edag/amnesia`, and `fjs/nanvm/text`.
- [ ] Settle what runs the corpus's `host` cases.

### Related

- [../README.md](../README.md): the adapter and its limits.
- [../../../../nanvm-lib/todo/to-primitive.md](../../../../nanvm-lib/todo/to-primitive.md):
  Stage 3, step 6.
