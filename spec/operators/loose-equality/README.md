# Loose equality: AST admission, deferred FJS support

**Status:** syntax AST implemented; FAST lowering deferred

`a == b` is retained in syntax and resolved source AST as `['==', a, b]`,
with JavaScript equality precedence and left associativity. The language designer
approved AST admission and deferred FJS support in the
[working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).
AST-to-FAST conversion explicitly fails, even for unreachable occurrences.
The [TODO](../../todo/loose-equality.md) tracks semantics and lowering.
`!=` remains unsupported syntax.

JavaScript's `==` and `!=` convert their operands before comparing them, by rules that depend on both types: `0 == ""` and `0 == "0"` are `true` while `"" == "0"` is `false`, and `null == undefined` is `true` while `null == 0` is `false`. A reader cannot tell what a comparison does without knowing both types, so AST admission alone does not enable their execution. `===` and `!==` compare without converting, and a conversion that is meant is written, `Number(x)` or `String(x)`.

The row `op.loose-equality` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [operators](../README.md) gives its reason.

## Examples

```js
/** @type {(a: unknown, b: unknown) => boolean} */
const same = (a, b) => a == b;
export default same(0, "");
```

The demo compiles [`sample.mjs`](./sample.mjs), the module above,
and displays the AST-to-FAST conversion failure. Below that it shows what JavaScript answers for the same
module: `true`.

## What to Write Instead

Compare with `===`, and write the conversion you mean, `Number(b)` or `String(a)`, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(a: number, b: string) => boolean} */
const same = (a, b) => a === Number(b);
export default same(0, "");
```

It answers `true`. `""` converts to `0`, the conversion `==` made, now written where a reader sees it.

## A Better Message

Today `fjs compile` prints `== AST-to-FAST conversion is not implemented`
for the module. The demo proposes additional guidance: the reason for the module, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Equality operators](https://tc39.es/ecma262/#sec-equality-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Equality>
