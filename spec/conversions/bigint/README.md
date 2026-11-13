# BigInt Conversion

**Status:** implemented

```js
export default (...a) => [BigInt(a[0]), BigInt("9007199254740993"), BigInt(true)];
```

`BigInt(exp)` is a unary conversion operator, like
[`Number(exp)`](../number/README.md). **`BigInt` is not a value.** It cannot
be bound, shadowed, passed as an argument, or read on its own. No static
members are admitted. Property names such as `{ BigInt: 1 }` and `o.BigInt`
remain ordinary property names.

The result follows JavaScript's explicit BigInt conversion. A bigint stays
itself; `true` becomes `1n` and `false` becomes `0n`. A finite integral number
converts exactly, including numbers outside the safe-integer range; `-0`
becomes `0n`. Fractions, `NaN`, and infinities fail.

A string is parsed as an integer without rounding through a number.
Surrounding JavaScript whitespace is ignored. Empty or all-whitespace strings
become `0n`; decimal signs and leading zeros are accepted. Unsigned hexadecimal,
octal, and binary prefixes work: `BigInt("0xFF")` is `255n`. A decimal point,
exponent, numeric separator, bigint suffix, signed non-decimal prefix, or
invalid digit fails. `null` and `undefined` fail too.

Containers convert to primitives with the number hint before conversion:
arrays join their elements (`BigInt([7])` is `7n`), and objects try their own
`valueOf` before `toString`. Failures propagate from operand evaluation and
coercion methods. [Failure is one outcome](../../principles/README.md#failure-is-one-outcome).

The operator requires exactly one plain operand. `BigInt()`,
`BigInt(a, b)`, and `BigInt(...a)` are compilation errors (`BigInt takes one
argument`). JavaScript also fails on a zero-argument call, but ignores extra
arguments; FJS follows its existing conversion-operator arity restriction.
`BigInt?.(x)` is refused because the operator is not a value to guard.
Computed numeric property keys continue to require `Number(...)`.

The compiler preserves the operator as `['BigInt', exp]` in EDAG; JavaScript
output writes `BigInt(exp)` and Rust output calls NaNVM's `Any::bigint`.

## Reference

- [ECMA-262: BigInt](https://tc39.es/ecma262/#sec-bigint-constructor)
- [MDN: BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
