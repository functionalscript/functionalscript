# A Global Is Refused

**Status:** refused by design

**`globalThis` is not FunctionalScript.** `globalThis` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A FunctionalScript module has no free names: everything it reads it binds or imports. Unadmitted JavaScript globals, such as `JSON`, `globalThis` and `Promise`, are no exception, so a name no `const`, parameter or import binds is refused (`const not found`). The built-ins the language admits, such as `Number`, `String`, `Object.is` and `Math.log2`, are recognized by name ([built-ins](../../built-ins/README.md)).

The row `name.unbound` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [global names](../../todo/2365-global-names.md) gives its reason.

## Examples

```js
export default globalThis.Math.max(1, 2);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `2`.

## What to Write Instead

Write the function, or import it from a module, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(a: number, b: number) => number} */
const max = (a, b) => a < b ? b : a;
export default max(1, 2);
```

It answers `2`.

## A Better Message

Today `fjs compile` prints `const not found` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [The Global Object](https://tc39.es/ecma262/#sec-global-object)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis>
