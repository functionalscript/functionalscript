# `eval` Is Refused

**Status:** refused by design

**`eval` is not FunctionalScript.** `eval("1")` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`eval` runs source text it receives at run time. That text is no part of the module the compiler reads, so nothing about it can be checked before it runs: not that it is FunctionalScript, not what it reads, not that it is pure. The built-ins register never admits it.

The row `op.eval` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [built-ins](../../todo/2360-built-in.md) gives its reason.

## Examples

```js
export default eval("1 + 1");
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `2`.

## What to Write Instead

Write the code itself, where the compiler can check it, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default 1 + 1;
```

It answers `2`. The code is part of the module, so the compiler checks it as it checks the rest.

## A Better Message

Today `fjs compile` prints `reserved word` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [eval (x)](https://tc39.es/ecma262/#sec-eval-x)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval>
