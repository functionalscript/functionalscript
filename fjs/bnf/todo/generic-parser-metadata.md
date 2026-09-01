## Make parser metadata generic

**Priority:** P3
**Status:** open

### Problem

`checkMap` currently fixes every implicit rule output to an AST with unknown
leaf metadata. Both parser backends now accept `Meta<M, CodePoint>`; the
remaining work is to carry that generic metadata contract through checked maps
and the descent transformer engine.

Composite rules introduce a second requirement. A sequence such as `[A, A]`
and a repetition receive several child results but must produce one
`Meta<M, T>`. Empty sequences and zero repetitions receive no child metadata at
all. The parser therefore needs a universal way to combine metadata in grammar
order and to construct metadata for an empty match.

The universal operation combines `M`, not complete `Meta<M, T>` pairs. The
parser constructs the composite value from the child values independently:

```ts
type Meta<M, T> = readonly[value: T, metadata: M]

type Metadata<M> = {
    readonly empty: M
    readonly join: (left: M) => (right: M) => M
}
```

`Metadata<M>` has exactly the laws of `Monoid<M>`: `empty` is an identity and
`join` is associative. Use the existing `Monoid<M>` API unless metadata-specific
names make parser call sites materially clearer.

*(Superseded below: a parser transforms metadata, so one type became two and the
monoid became `translate` plus `reduce`. `empty` is the part that did not
survive, and where it went is [43](./043-stateful-parser.md)'s open question.)*

### Proposal

Use one metadata type `M` throughout one parser and its transformer map.
Construct the parser with `Monoid<M>` so its TypeScript type and combining
operation are bound once instead of asking each rule transformer to repeat them.
*(Both halves of that sentence are revised at the end of this section: the type
became `MI` and `MO`, and the monoid became `translate` plus a non-associative
`reduce`. What survives is binding them once at construction rather than per
transformer.)*
Neither the parser nor `checkMap` needs metadata RTTI: metadata is one unchanged
channel, while RTTI exists in `checkMap` only to validate rule values whose
types change at mapping boundaries.

There are two separate mapping APIs. The parser consumes the RTTI-free
`TransformerMap` designed in issue 207: its transformers return bare
`Meta<M, T>`, and a recoverable semantic error is an ordinary `T = Result<V,
E>`. The existing `fjs/bnf/map` API is an optional RTTI-checking layer; its
callbacks continue to return `Result<Meta<M, T>, string>`, and `checkMap`
continues to consume those entries. A parser does not consume a checked RTTI
entry, and `checkMap` does not produce a parser transformer entry. Giving both
APIs one `M` aligns their metadata channel; it does not carry the RTTI layer's
engine-level `Result` into the parser protocol.

Input symbols are `Meta<M, CodePoint>`. The caller supplies their metadata; a
parser must not invent source positions or otherwise interpret `M`.

Metadata reaches each rule kind as follows:

- a terminal preserves its input symbol's metadata;
- a sequence folds child metadata from left to right;
- a string rule behaves as its sequence of terminal rules;
- a variant preserves the selected child's metadata;
- an implicit repetition folds iteration metadata from left to right in its
  default transformer state;
- an empty sequence and an implicit zero repetition use the monoid identity;
- an explicit repetition mapping receives each child `Meta` in `update`, keeps
  any metadata it needs in `S`, and forms its output metadata in `end`;
- an explicit terminal, sequence, or variant mapping receives the derived input
  metadata and may return any value of the same metadata type `M` as its output
  metadata.

Consequently, both mapping APIs should use one `M` instead of independent `MI`
and `MO` parameters. Different metadata *values* across a transformation are
supported; different metadata *types* inside one parser are not. A caller that
needs several channels can use a product metadata type whose monoid combines
the components.

**That last rule is narrower than it reads, and it stops at the parser's
boundary.** A layer *transforms* metadata, so a parser as a whole is
`MI → MO`: a tokenizer reads a number, emits the token symbol for the next layer
and carries the numeric value in its output metadata. Forcing one type there
makes that value ride uselessly through every later rule, or pushes its recovery
into a postprocessing pass. So [43](./043-stateful-parser.md) takes two
parameters, which `StateFold`'s independent `I` and `O` already provide.

What stays true is the rule-by-rule derivation above — the order metadata is
combined in, and which rule kind contributes what. What changes is the algebra
it is written against. `Monoid<M>` needs one type, so with two it becomes two
operations supplied at construction:

```ts
readonly translate: (mi: MI) => MO      // a terminal's metadata, lifted
readonly reduce: Reduce<MO>             // two siblings, combined
```

Everything above a terminal is `MO`, and `reduce` never sees `MI`. Read every
"folds child metadata" above as `reduce`, and every "uses the monoid identity"
as [43](./043-stateful-parser.md)'s open question — a semigroup has no identity,
and the empty sequence, the zero-round repetition and the EOF terminal are
exactly the cases that were spending it.

The single-`M` change to the RTTI mapping API shipped in PR #1828 and is not
reversed by this: a mapping's callback may stay `M → M` inside one layer while
the layer as a whole is `MI → MO`.

Parameterize both parser backends over `M` and make both consume
`readonly Meta<M, CodePoint>[]`. Move the shared pair type out of `descent`; the
backend distinction must not appear in the AST or mapping contracts.

Keep `checkMap` independent of the metadata monoid and metadata RTTI. It checks
only rule value RTTI (`ri` and `ro`). Its implicit AST RTTI may continue to use
`unknown` for leaf metadata: that schema describes the AST value protocol and
does not claim to validate the parser's generic `M`.

The parser and all constructors used to create entries for its transformer map
must come from the same metadata-bound factory. Otherwise structurally
compatible entries could accidentally combine values using a different monoid.
Each factory allocates a fresh opaque runtime token, and its parser and entry
constructors carry that token. `build` rejects an entry whose token differs
from the parser's before validating the map. The existing module-wide RTTI
mapping brand classifies `checkMap` entries only; it neither brands transformer
entries nor establishes factory identity.

### Tasks

- [x] Move the shared `Meta<M, T>`/code-point pair to the matcher layer.
- [x] Make LL(1) and descent accept the same metadata-carrying input.
- [ ] Bind the metadata operations in each transforming parser factory —
      `Monoid<M>` as shipped, `translate`/`reduce` once 43 settles the
      no-children case. LL(1) is complete; descent belongs to stage 3 of
      issue 207.
- [x] Use the factory's single `M` in the parser transformer protocol.
- [x] Replace the RTTI mapping API's `MI`/`MO` parameters with one `M`, without
      changing its separate `Result<Meta<M, T>, string>` contract.
- [ ] Derive metadata for terminal, sequence, string, variant, and repeat rules.
      LL(1) is complete; descent belongs to stage 3 of issue 207.
- [x] Keep metadata out of `checkMap`'s RTTI validation contract.
- [ ] Prove order, explicit overrides, and whatever 43 settles on for the
      no-children cases — the empty sequence, the zero repetition and the EOF
      terminal. The grouping proof is now the *opposite* of the one first
      written here: `reduce` is not required to be associative, so the exact
      left-to-right grouping is pinned rather than shown not to matter. LL(1) is
      complete; descent belongs to stage 3 of issue 207.

### Related

- [`207-bnf-semantic-actions.md`](./207-bnf-semantic-actions.md)
  — broader parser transformation design and metadata rationale.
