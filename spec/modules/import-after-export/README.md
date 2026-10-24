# An Import After an Export Is Refused

**Status:** refused by design

**`export const a = 1; import b from` is not FunctionalScript.** An import
after an export is valid JavaScript, and `fjs compile` refuses it by design:
the demo below shows what it prints.

A module reads in one order: imports first, then constants, then
`export default`, last. JavaScript hoists every import above the module's
other statements, so where an import is written says nothing about when it
is read; FunctionalScript keeps the one order, so a module's imports, its
parameters ([a module is a function](../README.md#a-module-is-a-function)),
are where a reader looks for them, at its top.

The row `mod.import-after-export` of
[refused constructs](../../todo/refused-constructs.md) registers the refusal,
and [module structure](../README.md) gives its reason.

## Examples

```js
export const a = 1;
import b from "./a.f.js";
export default [a, b];
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with [`a.f.js`](./a.f.js) beside it, using this build's
`fjs compile`, and shows the line it prints and the token it refuses. Below
that it shows what JavaScript answers for the same module: `1,1`, the import
read before the export it follows.

## What to Write Instead

Move the import to the top of the module, as
[`alternative.f.js`](./alternative.f.js) does:

```js
import b from "./a.f.js";
export const a = 1;
export default [a, b];
```

It answers `[1, 1]`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the `import`. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line `alternative.f.js`
writes, as `help`. The page compiles the alternative too, so the suggestion
is one the compiler accepts.

## Reference

- ECMA-262: [Imports](https://tc39.es/ecma262/#sec-imports)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import>
