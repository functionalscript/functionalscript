# Dataflow graphs with deferred input binding

**Priority:** P3
**Status:** wip

## Problem

We want to describe computations on sequences as an immutable graph whose
external inputs and outputs are bound *later*, by an engine:

```ts
const input = externalInput('name', rtti.number)
const c = map(g)(input)
const d = flatMap(g)(input)
const u = scan(utf8Decode)(input)
```

Different engines (backends) bind inputs and outputs to the same graph and
run it. Because the graph is data — a deep embedding, not eagerly executed
combinators — an engine may optimize it before running: evaluate a shared
node once (read a file once for both `c` and `d`), fuse stages, or
distribute the computation.

Prior art: Apache Beam (pipeline graph + runners), TensorFlow 1.x
placeholders, Akka Streams blueprints + materializer, LINQ expression
trees, fs2 pipes. The collection-kind side (ordered sequence vs unordered
bag vs set, and which operations each kind admits) is the Boom hierarchy;
see the *Future work* section.

## Proposal

Start minimal: one input kind — an ordered sequence bound to
`fs/types/list` — and a naive in-process engine. No RTTI yet: input types
are checked by TypeScript.

### Module

`fs/dataflow/module.f.ts` defines `Node<E, O>`: a graph node describing a
sequence of `O` computed from an environment of type `E`. The environment
is the *input schema*: instead of RTTI-typed named inputs, an input node
holds an accessor `(env: E) => List<O>`, so binding is fully type-checked
by TypeScript and the "names" are the fields of `E`:

```ts
type Env = { readonly text: List<string> }
const text = input((env: Env) => env.text)
const lengths = map((s: string) => s.length)(text)
const total = fold(addition)(0)(lengths)
run({ text: ['hello', 'world'] })(total) // [10]
```

### Primitives

Four node kinds; an engine interprets only these:

- `input` — a deferred external input, read from the environment.
- `flatMap` — a stateless stage: zero or more outputs per input element.
- `scan` — a stateful stage (`Scan<I, O>` from
  `fs/types/function/operator`): exactly one output per input element.
- `fold` — the only stage that observes the *end* of its source: emits a
  single final value (a one-element sequence), `init` for an empty source.

The set is minimal in a precise sense: `flatMap` cannot express state,
`scan` cannot drop or duplicate elements, and neither can detect the end
of the input, which `fold` does.

### Derived operations

Everything else composes from the primitives, so adding an engine never
grows beyond the four interpreters:

- `map(f)` = `flatMap(x => [f(x)])`
- `filter(p)` = `flatMap(x => p(x) ? [x] : null)`
- `last` = `fold` into a 0/1-element `List` accumulator, then flatten
  with `flatMap(identity)` — empty source gives an empty output.
- `reduce(op)` = `scan(reduceToScan(op))` then `last`.
- (future) `stateScan`/`foldScan` = `stateScanToScan`/`foldToScan` from
  the operator module applied before `scan`.

### Engines

`run` in the same module is the first, naive engine: it binds the graph
directly to `fs/types/list` operations and recomputes shared nodes. Node
variant types stay private until an external engine needs to pattern-match
on them.

Planned engine work, each a separate change:

- **Engine interface** — export the node variants (or a visitor/fold over
  the graph) so engines can live in their own modules.
- **Memoizing engine** — evaluate a node referenced by several consumers
  once (per-run cache keyed by node identity).
- Longer term: incremental, streaming (chunked), and distributed engines;
  output binding (multiple named outputs per graph).

### Future work: RTTI and collection kinds

- Replace the TypeScript-only environment with RTTI-described named inputs
  (`fs/types/rtti`), so a graph can be validated, serialized, and shipped
  to a remote engine.
- Add collection kinds beyond the ordered sequence: `UnorderedBag`, `Set`,
  ordered-per-key. Operations then declare the algebraic laws they need
  (associativity, commutativity, idempotency) and kinds declare the laws
  they provide — `scan` requires order, `reduce` over a bag requires a
  commutative operation, etc. (Boom hierarchy). Engines may exploit
  declared laws (tree reduction, out-of-order merge, retry safety).

## Tasks

- [x] `fs/dataflow/module.f.ts` — `Node<E, O>`, four primitives, derived
  `map`/`filter`/`last`/`reduce`, naive `run` engine over `types/list`
- [x] `fs/dataflow/proof.f.ts` — full proof coverage
- [ ] engine interface for external engine modules
- [ ] memoizing engine (shared node evaluated once per run)
- [ ] RTTI-typed named inputs
- [ ] unordered collection kinds with law-constrained operations

## Related

- [fs/types/list/module.f.ts](../fs/types/list/module.f.ts) — the sequence
  type the naive engine binds to
- [fs/types/function/operator/module.f.ts](../fs/types/function/operator/module.f.ts)
  — `Scan`, `StateScan`, `Fold`, `Reduce` and their conversions
- [fs/types/rtti](../fs/types/rtti) — runtime type descriptions for the
  future named-input schema
- [fs/effects](../fs/effects) — the same deep-embedding idea for effects:
  describe now, interpret later
