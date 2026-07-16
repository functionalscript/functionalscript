# Flow: dataflow graphs with deferred input binding

**Priority:** P3
**Status:** open

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
node once (read a file once for both `c` and `d`), fuse stages, stop
reading a source as soon as no consumer needs more, or distribute the
computation.

Prior art: Apache Beam (pipeline graph + runners), TensorFlow 1.x
placeholders, Akka Streams blueprints + materializer, LINQ expression
trees, fs2 pipes, Clojure transducers. The collection-kind side (ordered
sequence vs unordered bag vs set, and which operations each kind admits)
is the Boom hierarchy; see the *Future work* section.

## Proposal

Start minimal: one input kind — an ordered sequence bound to
`fs/types/list` — and a naive in-process engine. No RTTI yet: input types
are checked by TypeScript.

### Module

`fs/flow/module.f.ts` defines `Flow<E, O>`: a node of the graph, describing
a sequence of `O` computed from an environment of type `E`. A `Flow` is
*cold* — an immutable description, not a running computation (cf. Kotlin's
`Flow`, which is also a cold, later-bound stream description). The
environment is the *input schema*: instead of RTTI-typed named inputs, an
input node holds an accessor `(env: E) => List<O>`, so binding is fully
type-checked by TypeScript and the "names" are the fields of `E`:

```ts
type Env = { readonly text: List<string> }
const text = input((env: Env) => env.text)
const lengths = map((s: string) => s.length)(text)
const { result } = transduce(sum)(lengths)
run({ text: ['hello', 'world'] })(result) // [10]
```

### The universal operator: `Transducer`

One operator shape covers every stage; an engine interprets nothing else:

```ts
type Terminal<O, A> = readonly ['done', readonly O[], A]

type Step<S, O, A> = |
    readonly ['next', readonly O[], S] |
    Terminal<O, A>

type Transducer<I, S, O, A> = {
    readonly init: S
    readonly update: (state: S, item: I) => Step<S, O, A>
    readonly end: (state: S) => Terminal<O, A>
}
```

- `update` consumes one input item and emits a chunk of outputs; it either
  continues with a new state (`next`) or terminates early (`done`) — e.g.
  `take`/`takeWhile`, or a parser aborting on invalid input. Early
  termination is the "cancellation" that lets an engine stop reading a
  source (stop IO) as soon as the stage needs no more input.
- `end` is the end-of-input signal: the stage flushes buffered outputs
  (parsers, decoders — e.g. `utf8Decode` finishing a multi-byte sequence)
  and produces the final result `A`.
- `A` is a summary produced *alongside* the output sequence (Akka's
  "materialized value"): a fold's total, a parser's final `Result`, bytes
  consumed. Stages with no summary use `A = null`.

Design decisions, in the order they were made:

- **Explicit state `S`, not self-returning closures** (cf. `Scan` in
  `fs/types/function/operator`): a transducer is a record of closed
  module-scope functions plus plain-data state, so operators can be
  content-addressed, deduplicated, and shipped to remote engines, and an
  engine can checkpoint `S` mid-stream and resume (how Flink does
  fault-tolerant streaming). The closure form is derivable, not canonical.
- **`end` is a separate function, not an end-marker input to `update`**:
  its return type is `Terminal`, so "refuses to terminate at end of input"
  is unrepresentable, rather than a runtime error an engine must handle.
- **Chunked emission `readonly O[]` everywhere**: makes the operator
  universal — `filter`, `flatMap`, `flat` are directly expressible, and
  `fold` honestly emits nothing per item — at the cost of the structural
  1:1 invariant (see *Engines*: that information returns later as node
  metadata, which is where optimizing engines want it anyway). Frozen
  arrays are plain data (serializable, unlike `List` thunks) and every
  `readonly O[]` already *is* a `List<O>` for the engine.
- **A single terminal variant carrying a flush chunk**: `['done', [i], a]`
  is `take` emitting its last element while stopping, `['done', [], a]` is
  `takeWhile` stopping without emitting, and `end` returning
  `['done', flush, a]` is a parser's final production. In automata terms
  the operator is a *subsequential* transducer — a Mealy machine with a
  terminal output word.
- **No error channel**: the core is total; every stage always completes.
  Failure is ordinary data — see the failure convention below. (An
  `['error', E]` variant was considered and dropped: it taxed every
  signature with a fifth type parameter and duplicated what `done` +
  `A = Result` already express.)

Naming follows the closest conventions elsewhere: the concept and the
three functions are Clojure's transducer (`init`/`step`/`completion`
arities, `reduced` = early `done`); the record shape matches the Web
Streams `Transformer` (`start`/`transform`/`flush`); `Step` and its
variants match Haskell's `machines` (`Yield`/`Stop`); `next` is Rx's
`onNext`; `A` is Akka's materialized value.

### Graph operations

Two primitives:

- `input((env: E) => List<O>)` — a deferred external input.
- `transduce(t)(source)` — apply a `Transducer`; returns **two** flows
  sharing one stage: `{ out: Flow<E, O>, result: Flow<E, A> }` (`result`
  is a one-element sequence).

Everything else derives, so an engine only interprets the two primitives:

- `map(f)`: `update = (s, i) => ['next', [f(i)], s]`
- `filter(p)`: `update = (s, i) => ['next', p(i) ? [i] : [], s]`
- `flat`: `update = (s, chunk) => ['next', chunk, s]`; `flatMap(f)` =
  `flat` after `map(f)`
- `scan(op)`: state = accumulator, one output per item
- `fold(op)(init)`: emits nothing per item, accumulates into `S = A`,
  consumers read `result`; `reduce` likewise with the first item as init
- `take(n)`: counts down, `['done', [i], null]` on the last item;
  `takeWhile(p)`: `['done', [], null]` on the first failing item
- stateful decoders/parsers (`utf8Decode`, tokenizers): buffer in `S`,
  flush in `end`, report `A = Result`

### Failure convention

There is no error channel, so a failing stage *ends its output sequence
early* — and downstream cannot distinguish "input ended" from "input
broke" unless told. To avoid silent-truncation bugs (a decoder fails
mid-file, a downstream parser succeeds on the prefix), fallible stages
must surface failure in one of two ways:

1. **In-band**: emit `O = Result<T, Err>` items, forcing downstream to
   confront failure per item (the Rust iterator convention), or
2. **In the summary**: report through `A = Result<..., Err>`, and the
   final program result is assembled by combining the `result` flows of
   the stages that matter — making "who checks what" visible in the graph
   instead of implicit in the engine.

### Engines

`run` in the same module is the first, naive engine: it binds the graph
directly to `fs/types/list` and recomputes shared nodes. Flow variant
types stay private until an external engine needs to pattern-match on
them.

Planned engine work, each a separate change:

- **Engine interface** — export the node variants (or a visitor/fold over
  the graph) so engines can live in their own modules.
- **Memoizing engine** — evaluate a node shared by several consumers once
  per run (this includes `out`/`result` of one `transduce` stage).
- **Structured node kinds as optimization metadata** — `Transducer` is the
  universal *semantics*, but an opaque transducer looks maximally stateful
  and order-dependent, so an optimizing engine must assume the worst case.
  Reintroduce derived operations (`map`, `filter`, `scan`, …) as visible
  node kinds that *carry* their lowering to `Transducer`: simple engines
  lower and interpret one operation; smart engines pattern-match the
  structure first (fusion of adjacent stages is free — transducers are
  closed under composition).
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

- [ ] `fs/flow/module.f.ts` — `Flow<E, O>`, `Transducer`/`Step`/`Terminal`,
  primitives `input` and `transduce`, derived operations, naive `run`
  engine over `types/list`
- [ ] `fs/flow/proof.f.ts` — full proof coverage, including early
  termination, `end` flush, and a fallible stage using `A = Result`
- [ ] memoizing engine (shared node evaluated once per run)
- [ ] structured node kinds carrying their `Transducer` lowering
- [ ] RTTI-typed named inputs
- [ ] unordered collection kinds with law-constrained operations

## Related

- [fs/types/list/module.f.ts](../fs/types/list/module.f.ts) — the sequence
  type the naive engine binds to
- [fs/types/function/operator/module.f.ts](../fs/types/function/operator/module.f.ts)
  — `Scan`, `StateScan`, `Fold`: the closure-form operators `Transducer`
  generalizes (its JSDoc already frames them as Mealy machines)
- [fs/types/rtti](../fs/types/rtti) — runtime type descriptions for the
  future named-input schema
- [fs/effects](../fs/effects) — the same deep-embedding idea for effects:
  describe now, interpret later
- [Clojure transducers](https://clojure.org/reference/transducers) — the
  `init`/`step`/`completion` arities and `reduced` early termination
- [Web Streams `Transformer`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream)
  — the platform-JS `{start, transform, flush}` analogue
