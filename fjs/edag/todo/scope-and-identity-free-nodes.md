## A node reached from two function bodies

**Priority:** P2 — blocks
[#4111](https://github.com/functionalscript/functionalscript/pull/4111)
**Status:** wip — proposal, awaiting the task owner's decision

### Problem

[`analysis`](../analysis/module.f.js) refuses a node reached from two
scopes — `a node shared across a function boundary` — and the refusal is
structural: it asks where a node is reached from, never what the node is.
The rule is stated as the design
([`../README.md`](../README.md), identity-dependent canonicality;
[`../execution-models.md`](../execution-models.md), transformations 2):
`['[]', []]` inside a body is a fresh array per call and outside it is one
array, so a graph that puts the same node in both places was taken to say
two things at once.

The rule makes an EDAG's validity depend on which of its nodes are one
object. Nothing that builds an EDAG can promise that.

**The compiler cannot.** It is written in FunctionalScript and builds nodes
with array literals inside its functions, `['self']`, `['arg', 0]`,
`['[]', []]`. Under the
[value-identity proposal](../../../spec/todo/value-identity.md) two arrays
of equal content may be one, and a literal that reads no argument is the
plainest case: an executor may build it once and answer it at every call.
[#4111](https://github.com/functionalscript/functionalscript/pull/4111)
does exactly that, and CI's self-compilation shows the result. The
compiler compiles itself to `first.f.js`; `first.f.js`, run to compile the
compiler again, stops in 1.9 s with
`a node shared across a function boundary`: the compiled compiler hands
its own analysis one `['self']` in two bodies.

**No producer on a content-addressable VM can.** There equal content is
one value always, so two equal nodes in two bodies are one node, and every
graph with a repeated leaf is refused.

**It has already cost a crash without either.** `fjs/compiler/edag` kept
`['undefined']` as a module-level constant and returned it for every
occurrence, so `export default [undefined, (...a) => undefined];` linked to
a graph whose analysis threw. The linker now builds a node per occurrence,
which is the care the rule asks of every producer and the care a producer
cannot take.

What exists to keep the rule shows its weight:
[`ownBodies`](../value/function/module.f.js) copies the body of every
function of an evaluated value, because two functions made from one arrow
share its nodes and whatever analyses the value would refuse it.

### Proposal

**A node belongs to every scope it is reached from.** A scope is the
module level or one function's body. A node reached from a scope is a
computation of that scope: evaluated once per invocation of it, its
`['arg', N]`, `['frame', N]`, `['rest']` and `['self']` read from that
invocation. One node object reached from two scopes is two computations
that are written alike, as two equal node objects are today. Nothing is
refused.

Within one scope nothing changes: a node reached twice is one computation,
evaluated once, which is what a writer hoists into a `const` and an
executor caches.

```js
const x = ['[]', []]
// today: refused. Proposed: the same graph as
//   ['[]', [['[]', []], ['=>', 0, [], ['[]', []]]]]
const graph = ['[]', [x, ['=>', 0, [], x]]]
```

This is not a second meaning for the node. The array `x` makes at the
module level and the array it makes in the body were always two
computations; the rule only refused to let one object spell both.

**Why this is sound.** A program cannot tell the two readings apart beyond
what value identity already leaves unspecified. Whether the outer array
and the inner one are one object was never the graph's to say: an executor
may share equal values or not. What the graph says is which computations
each scope has, and the proposal reads that from the graph's content and
each scope's own sharing.

**The table.** [`Analysis`](../analysis/types.ts) keeps one entry per node
and scope, so `scope` stays a function of the entry. What changes is the
walk: its `visited` map is keyed by node and scope where it is keyed by
node, and a node met again in another scope is walked again there. An
entry is an index, as before, and no consumer of the table reads a node's
identity through it.

**Cost.** A subgraph reached from `k` scopes is walked `k` times and has
`k` sets of entries. That is the size of the graph the same producer would
have built with a node per occurrence, which is what the rule required of
it, so nothing grows that was not already that size.

### What it changes

- [`analysis`](../analysis/module.f.js): the walk above, in `analysis` and
  `identityAnalysis` alike, and the refusal goes.
- [`sharing`](../sharing/module.f.js) counts by node identity within one
  scope and stops at a function boundary already; a node of two scopes is
  counted in each.
- Executors read the table by entry and cache per invocation, and need
  nothing.
- Writers ([`to_fast`](../to_fast/module.f.js), the FunctionalScript and
  Rust writers) take the table and need nothing where they read entries; a
  walk of their own over node identity, if one is found, takes the same
  key.
- `ownBodies` has no reason left. Its callers pass the value as it is, and
  it is deleted.
- The linker's node per occurrence of `undefined` becomes a choice and not
  a correctness fix.
- [`../README.md`](../README.md) and
  [`../execution-models.md`](../execution-models.md) state the rule as
  identity-dependent canonicality; both say instead what a scope's node
  is. Transformation requirement 2, *merging never crosses a `=>`
  boundary*, becomes: a merge across a boundary is not a merge, since each
  scope computes its own.

### Alternatives considered

1. **The rule stands, and every producer builds a node per occurrence.**
   A producer written in FunctionalScript cannot, for the reasons above.
   It would also mean precomputation must never be applied to code that
   builds EDAGs, a property of a function no compiler can see.
2. **Admit only nodes that mint nothing**, `['undefined']` and the other
   leaves, in any number of scopes. This is the earlier form of this
   proposal. It is not enough: `['[]', []]` and `['()', f, []]` are merged
   by the same precomputation and mint identity. It also needs a class,
   "identity-free and denoting the same value everywhere", that `['arg',
   N]` falls outside of, where reading a node within its scope needs no
   class at all.
3. **Make precomputation leave such literals alone.** It cannot tell an
   array that is a node from one that is data, and a content-addressable
   VM merges them regardless.

### Open questions

1. **The self-compilation fixpoint.** CI requires `first.f.js` and
   `second.f.js` to be identical. With the refusal gone the second
   compilation completes, and whether the two texts agree is then the
   question. The compiled compiler shares more nodes within a scope than
   the source compiler does: for `fjs/types/list/module.f.js` its
   `.edag.data.js` is 19 491 bytes against 19 749, one `["self"]` hoisted
   where the source compiler writes two. A writer hoists what is shared
   within a scope, so its text depends on that sharing. Either the writers
   decide sharing from content for a node that mints nothing, as
   `analysis` already merges such nodes, or the fixpoint is stated over
   content and not text.
2. **Within a scope.** One node reached twice is one computation, and two
   equal nodes are two. Value identity makes the difference a matter of
   how often something is evaluated, never of a result. Whether a producer
   that splits or merges within a scope must be tolerated the same way is
   not asked here; a merge is harmless, and a split can repeat a call.
3. **Supplied graphs.** An `.edag.data.js` document read back may now hold
   a node in two scopes, written as one `const`. It reads back as the same
   graph, and admission has one check fewer. Nothing else about admitting
   a supplied graph changes.

### Tasks

- [ ] The task owner's decision on the proposal.
- [ ] `analysis` and `identityAnalysis` key the walk by node and scope;
      the `crossScope` proofs pin two entries where they pin a refusal.
- [ ] Any other walk keyed by node identity across scopes, found by
      running the compiled compiler.
- [ ] Delete `ownBodies` and pass values as they are.
- [ ] Restate the rule in `../README.md` and `../execution-models.md`.
- [ ] Open question 1, once the second compilation completes.

### Related

- [`analysis.md`](./analysis.md) — the table the rule lives in.
- [`../execution-models.md`](../execution-models.md) — where a scope is
  defined.
- [`../../../spec/todo/value-identity.md`](../../../spec/todo/value-identity.md)
  — why node identity is not a producer's to promise.
- [#4111](https://github.com/functionalscript/functionalscript/pull/4111)
  — precomputation, and the self-compilation that fails on the rule.
