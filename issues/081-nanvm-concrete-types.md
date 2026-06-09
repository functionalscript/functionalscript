# 81. `nanvm_lib` needs concrete wrap types.

**Priority:** P3
**Status:** done

Currently, `nanvm_lib` relies on traits, such as `Any`, `Object`, `Array`, and `String16`. The problem is that one type can implement multiple traits; for example, `struct A { ... }` can implement both `String16` and `Object` traits. It makes implementing generic operators, serialization, etc., challenging for the traits. We need concrete wrap types. For example, `struct Any<T: Vm>(T::Any);`. In this case, we can implement different operators and traits for the generic `Any<T>` type instead of a trait.

## Resolution

Implemented in `nanvm-lib`. The VM now exports concrete wrapper types from
[`nanvm-lib/src/vm/mod.rs`](../nanvm-lib/src/vm/mod.rs):

- [`Any<A>`](../nanvm-lib/src/vm/any/mod.rs)
- [`Array<A>`](../nanvm-lib/src/vm/array/mod.rs)
- [`Object<A>`](../nanvm-lib/src/vm/object/mod.rs)
- [`String<A>`](../nanvm-lib/src/vm/string/mod.rs)
- [`BigInt<A>`](../nanvm-lib/src/vm/bigint/mod.rs)
- [`Function<A>`](../nanvm-lib/src/vm/function/mod.rs)

Operators, conversions, serialization, equality, indexing, and other behaviours
are implemented on these wrapper types rather than on ambiguous VM traits.
