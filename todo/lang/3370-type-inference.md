# Type Inference

We need type inference to prove that specific values have specific types. Type annotations can help, but we can't trust them.

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
