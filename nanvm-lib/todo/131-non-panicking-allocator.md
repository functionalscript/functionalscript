## 131. An allocator for `nanvm` that doesn't panic.

**Priority:** P3
**Status:** open

An allocator for `nanvm` that doesn't panic. Instead, it should return `Result<T, Any>`.

### Sites that still abort

`spread_array` reserves its elements through `Vec::try_reserve` and throws the
`RangeError` of an array whose elements the machine cannot hold
(`vm/unstable/mod.rs`; the test `spread_array_unbacked` is the abort it used to
be: `memory allocation of 103079215080 bytes failed`). It is not fully
fallible: the array it then builds with `to_array` is a second allocation of
the same size (`naive/container.rs`'s `new` collects into an `Rc<[Any]>`), so a
machine that holds the elements but not a copy of them still aborts, which is
the second kind below. Other places size an allocation from a count or an
operand a program controls and cannot fail that way. Two kinds:

- **A buffer the operation allocates itself, infallibly.**
  `BigInt`'s `*` (`vm/bigint/mul.rs`) sizes its result from the operands'
  lengths, `lhs + rhs + 1` words, through `common/vec.rs::with_default`, which
  calls `Vec::with_capacity`. The quotient of `/` and `%` (`abs_divmod_vec`)
  is sized from the dividend, so it adds no growth. `<<` already reserves
  fallibly (`vm/bigint/shl.rs`) and is the model.
- **A container the constructor allocates.** `spread_array`'s final
  `to_array`, and `array/create.rs`'s `create`, which bounds the length at
  `2³² − 1` and then builds the array from an iterator, and so do the string
  builders that call it: `repeat`, `padStart`/`padEnd`,
  `concat`. `<<` meets this one too, in its second allocation (the TODO in
  `shl.rs`). `'a'.repeat(2 ** 32 - 1)` is a count under the limit that the
  machine may not back.

The first kind needs `with_default` to become a fallible `try_with_default`.
For `*` that is more than local: `Mul for BigInt` is infallible
(`type Output = Self`), has no size limit and no `RangeError` of its own, so a
fallible `*` changes its signature, as `<<` returns a `Result`, and every
caller of the operator with it. The second kind needs a fallible container
constructor in `IVm`, which is the general task.
