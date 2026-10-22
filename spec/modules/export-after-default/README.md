# An Export After `export default` Is Refused

**Status:** refused by design

**`export default 1; export const` is not FunctionalScript.** `export default 1; export const a = 2;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A module reads in one order: imports first, then constants, then `export default`, last. JavaScript lets the statements stand in any order; FunctionalScript keeps the one, so a reader finds the module's answer at its end ([module structure](../README.md)).

The row `mod.export-after-default` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [module structure](../README.md) gives its reason.

## Examples

```js
export default 1;
export const a = 2;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Move `export default` to the end of the module, as [`alternative.f.js`](./alternative.f.js) does:

```js
export const a = 2;
export default 1;
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Exports](https://tc39.es/ecma262/#sec-exports)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export>
