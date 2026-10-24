# Bigints

**Status:** implemented

A `bigint` is written as a number's integer part — `0`, or digits not
starting with `0` — followed directly by a lowercase `n`: `0n`, `34n`,
`123456789012345678901234567890n`. Like a number it is unsigned: `-34n` is
the [unary minus](../numbers/README.md) applied to `34n`, which lowering folds into the
leaf `-34n` as it folds a negated number, and `-0n` is `0n`, since a `bigint`
has no negative zero, as in JavaScript.

```js
export default [0n, 34n, -34n];
```

A hexadecimal integer part, as a [number](../numbers/README.md) writes it, takes the
`n` too: `0x10n` is `16n` and `0XFFn` is `255n`, exact at any width, and
`-0x8000000000000000n` folds into the leaf `-9223372036854775808n`. An
output writes `0x10n` exactly as it writes `16n`, and one that refuses a
`bigint` refuses it whatever its spelling: `.json` refuses every one.

```js
export default [0x10n, 0XFFn, -0x8000000000000000n];
```

A binary integer part also takes `n`: `0b101n` and `0B101n` are `5n`.
Numeric separators may occur between digits in every admitted base,
`1_000n`, `0xFF_FFn` and `0b1010_0011n`, under the same separator rules as
[numbers](../numbers/README.md). Values remain exact at any width and outputs use decimal.

The syntax is those integer parts and the `n`, so the JavaScript spellings
it leaves out are not recognized: no octal prefix (`0o7n`). A fraction or
an exponent (`1.5n`, `1e3n`), a leading zero (`01n`) and an uppercase `N` are
errors in both languages. JSON has no spelling for a `bigint`, so a `.json`
output refuses one ([output](../../command-line/output.md)).

## Examples

The compiler demo has no programs for this page yet: its accepted and refused examples are a follow-up.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — `bigint` literals, arithmetic on one,
and its `typeof` — with every output `fjs compile` makes of it: the
expression graph (EDAG), the Rust and the WebAssembly that Rust builds to.
Its Run button calls the default export with `0`, `1` and `2`, as JavaScript
and as WebAssembly, and shows what each call returned or threw.

```js
export default (...a) => [[0n, 34n, -34n][Number(a[0])] * 2n, typeof 34n];
```

## Reference

- ECMA-262: [The BigInt type](https://tc39.es/ecma262/#sec-ecmascript-language-types-bigint-type)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt>
