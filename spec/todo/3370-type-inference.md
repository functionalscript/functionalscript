# Type Inference

We need type inference to prove that specific values have specific types. Type annotations can help, but we can't trust them.

See [type-annotations](./3360-type-annotations.md) for the annotation form those
would take: an RTTI schema named by an ordinary expression, checked against the
annotated value at compile time.

## Level 1

```rust
enum Type {
    Unknown,
    Null,
    Undefined,
    Bool,
    Number,
    String,
    BigInt,
    Object,
    Array,
    Function,
    // ...
}
```

## Level 2

It is a set. For example,

```rust
Set<Type>
```

On this level, we can extend our `Type` definition with some known finite values:

```rs
enum Type {
    Unknown,
    Null,
    Undefined,
    False,
    True,
    Number,
    String,
    BigInt,
    Object,
    Array,
    Function,
    // ...
    // ...
    EmptyString,
    NumberZero,
    NumberNaN,
    NumberPositive,
    NumberNegative,
    NumberPInf,
    NumberNInf,
    BigIntZero,
    BigIntPositive,
    BigIntNegative,
    EmptyObject,
    EmptyArray,
    FunctionId,
    // ...
}
```

The set is finite and can be implemented using a bit-set.

### Level 3

Compared to level 2, this level contains dynamic information about subsets of the type.

## The inference domain: decide before designing

Nothing else in stage 6 can be specified until this is settled, and once
[668](../../fjs/rtti/todo/668-rtti-function-types.md) lands 7a there is
otherwise no task anyone can pick up to unblock 7b.

- [ ] **Decide the inference domain.** Either the `enum Type` bit-set lattice
      sketched above becomes a lattice *over* RTTI schemas, or RTTI's `Type`
      replaces it outright. They are different designs, not two spellings of
      one: the lattice is a fixed set of bits, while an RTTI schema is an
      open-ended value with structure — records, tuples, unions, literal
      members — and the epic's checking step is `subset(inferred, declared)`
      over that structure.

      Two constraints the choice has to satisfy, both from the epic:

      - the inferred thing must be comparable to a *declared* RTTI schema, so
        whatever the domain is, there has to be a total map from it into
        something `subset` accepts;
      - `subset` is **sound and deliberately incomplete**, so the checker needs
        a third answer — *cannot decide* — and **today's API cannot express
        one**: `subset` is
        `(a: Data) => (b: Data) => boolean`
        ([`data/module.f.mjs`](../../fjs/rtti/data/module.f.mjs)), so a
        `false` conflates a genuine non-inclusion with a documented
        undecidable case such as
        `readonly [number | string] ⊆ readonly [number] | readonly [string]`.
        Tolerating the third answer is not enough — nothing *produces* it. So
        this task also owes one of: a **tri-state inclusion API**, a separate
        **completeness witness** saying whether a given pair falls in the
        decidable fragment, or completing the algorithm in the direction
        [`data/README.md`](../../fjs/rtti/data/README.md) names. Without
        one, stage 6 cannot both reject definite type errors and fall back on
        incomplete ones — it has to pick a single behaviour for `false` and
        will be wrong for one of the two.

- [ ] **Then** specify inference itself against that domain, including the
      fixpoint for a call to an unannotated function, which is inference's own
      recursion rather than a dependency on 668.

## Related

- [rtti-type-system](../../todo/rtti-type-system.md) — the epic; this document
  is its stage 6, and most of its work.

> **Not yet reconciled with the epic.** Two things above predate it and should
> be read with that in mind. The reference to an annotation "named by an
> ordinary expression" (line 6) is superseded: the epic narrows an annotation
> body to a **single identifier**, as
> [3360](./3360-type-annotations.md) now records. And the `enum Type` bit-set
> lattice sketched here is a different design from RTTI's `Type` — this document
> opens by saying type annotations "can help, but we can't trust them", which is
> not the epic's position. Whether the lattice becomes the inference domain
> *over* RTTI schemas, or is replaced by them, is **this document's first
> task** — see below. An earlier draft called it "unowned work and part of
> stage 6", which left it owned by nobody: the epic implements nothing and
> names this document as stage 6, so "part of stage 6" is a pointer back here.
