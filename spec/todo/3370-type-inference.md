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
> *over* RTTI schemas, or is replaced by them, is unowned work and part of
> stage 6.
