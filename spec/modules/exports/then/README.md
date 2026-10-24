# Exporting `then` Is Refused

**Status:** refused by design

**`export const then` is not FunctionalScript.** `export const then = …;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

JavaScript treats any object whose `then` member is a function as a promise, a module namespace included: `await import("./m.mjs")` of a module that exports a function `then` calls it, and answers what it passes on rather than the module. A `then` that is no function is ignored, so whether importing a module answers the module would depend on the type of one export. FunctionalScript reserves `then` as an export name, whatever its value, and nowhere else: a local `const`, a parameter or an import may be called `then` ([exporting a value](../README.md)).

The row `name.reserved-export` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [exporting a value](../README.md) gives its reason.

## Examples

```js
/** @type {(resolve: (value: number) => void) => void} */
export const then = resolve => resolve(1);
export default 0;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `0`, its default export as a static import reads it. The same
module loaded with `await import()` answers `1`, what `then` passed on.

## What to Write Instead

Export the value under another name, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(resolve: (value: number) => void) => void} */
export const next = resolve => resolve(1);
export default 0;
```

It answers `0`. `await import()` of this module answers the module.

## A Better Message

Today `fjs compile` prints `reserved export name then` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Promise Resolve Functions](https://tc39.es/ecma262/#sec-promise-resolve-functions)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#thenables>
