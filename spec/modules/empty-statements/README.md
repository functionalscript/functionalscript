# An Empty Statement Is Refused

**Status:** refused by design

**`;;` is not FunctionalScript.** `const a = 1;;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

JavaScript reads a stray `;` as an empty statement that does nothing. FunctionalScript has one terminator per statement, so `;;` is an error rather than a statement, and a stray `;` cannot hide a statement that was meant to be there ([module structure](../README.md)).

The row `st.empty` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [module structure](../README.md) gives its reason.

## Examples

```js
const a = 1;;
export default a;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Remove the extra `;`, as [`alternative.f.js`](./alternative.f.js) does:

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

- ECMA-262: [Empty statement](https://tc39.es/ecma262/#sec-empty-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/Empty>
