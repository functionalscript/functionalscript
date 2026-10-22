# `export let` Is Refused

**Status:** refused by design

**`export let` is not FunctionalScript.** `export let a = 1;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

An exported `let` is a binding the module could change after an importer has read it. FunctionalScript has no such binding: `let` only opens a loop, over one variable ([let](../../todo/3220-let.md)), so an export is a `const`.

The row `mod.export-let` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [let](../../todo/3220-let.md) gives its reason.

## Examples

```js
export let a = 1;
export default a;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Export a `const`, as [`alternative.f.js`](./alternative.f.js) does:

```js
export const a = 1;
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

- ECMA-262: [Exports](https://tc39.es/ecma262/#sec-exports)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let>
