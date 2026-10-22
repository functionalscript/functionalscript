# `var` Is Refused

**Status:** refused by design

**`var` is not FunctionalScript.** `var a = 1` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A `var` is a variable: it can be assigned again, it is visible before its declaration as `undefined`, and its scope is the whole function rather than its block. FunctionalScript binds a name once, with `const`, and admits `let` only as the variable of a loop ([let](../../todo/3220-let.md)), so `var` is refused.

The row `st.var` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [constants](../constants/README.md) gives its reason.

## Examples

```js
var a = 1;
export default a;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Bind the name with `const`, as [`alternative.f.js`](./alternative.f.js) does:

```js
const a = 1;
export default a;
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Variable statement](https://tc39.es/ecma262/#sec-variable-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var>
