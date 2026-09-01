## Make parser metadata generic

**Priority:** P3
**Status:** open

### Problem

`checkMap` currently fixes every implicit rule output to
`Ast<CodePointMeta<unknown>>`. The LL(1) parser accepts bare code points while
the descent parser accepts `CodePointMeta<M>`, so a checked mapping cannot be
used by both parsers with one generic metadata type.

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

### Proposal

Use one metadata type `M` throughout one parser and checked map. Construct the
parser/map from both its runtime metadata RTTI and its monoid; this binds the
runtime schema, TypeScript type, and combining operation once instead of asking
each rule mapping to repeat them.

```ts
type ParserMetadata<MT extends Type> = {
    readonly type: MT
    readonly monoid: Monoid<Ts<MT>>
}
```

Input symbols are `Meta<M, CodePoint>`. The caller supplies their metadata; a
parser must not invent source positions or otherwise interpret `M`.

The parser derives parent metadata as follows:

- a terminal preserves its input symbol's metadata;
- a sequence folds child metadata from left to right;
- a string rule behaves as its sequence of terminal rules;
- a variant preserves the selected child's metadata;
- a repetition folds the metadata of its iterations from left to right;
- an empty sequence or zero repetition uses the monoid identity;
- an explicit mapping receives the derived input metadata and may return any
  value of the same metadata type `M` as its output metadata.

Consequently, mapping types should use one `M` instead of independent `MI` and
`MO` parameters. Different metadata *values* across a transformation are
supported; different metadata *types* inside one parser are not. A caller that
needs several channels can use a product metadata type whose monoid combines
the components.

Parameterize both parser backends over `M` and make both consume
`readonly Meta<M, CodePoint>[]`. Move the shared pair type out of `descent`; the
backend distinction must not appear in the AST or mapping contracts.

Parameterize `checkMap` with `ParserMetadata<MT>`. Its implicit AST RTTI uses
`MT` instead of `unknown`, and every touched but unmapped rule retains its AST
value while receiving metadata according to the rules above. `checkMap` still
checks rule value RTTI (`ri` and `ro`); the factory-bound `MT` supplies the one
metadata RTTI shared by every entry.

The parser and all constructors used to create entries for its checked map must
come from the same metadata-bound factory. Otherwise structurally compatible
entries could accidentally combine values using a different monoid. Preserve
that relationship with the existing mapping brand or a new factory brand.

### Tasks

- [ ] Move the shared `Meta<M, T>`/code-point pair to the matcher layer.
- [ ] Make LL(1) and descent accept the same metadata-carrying input.
- [ ] Bind metadata RTTI and `Monoid<M>` in the parser/mapping factory.
- [ ] Replace mapping `MI`/`MO` parameters with the factory's single `M`.
- [ ] Derive metadata for terminal, sequence, string, variant, and repeat rules.
- [ ] Generalize `checkMap`'s implicit AST RTTI from `unknown` to `MT`.
- [ ] Prove order, associativity-independent grouping, explicit overrides, and
      identity metadata for both empty sequence and zero repetition.

### Related

- [`fjs/bnf/todo/207-bnf-semantic-actions.md`](../../../todo/207-bnf-semantic-actions.md)
  — broader parser transformation design and metadata rationale.
