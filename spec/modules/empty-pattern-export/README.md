# An Export That Binds Nothing Is Refused

**Status:** refused by design

**`export const {}` is not FunctionalScript.** `export const {} = {};` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

An exported pattern exports each name it binds, so `export const {} = {};` exports nothing, and a module made of it is a module with no export ([no export](../no-export/README.md)). JavaScript admits the text; FunctionalScript refuses it as `module exports nothing`.

The row `mod.empty-pattern-export` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [module structure](../README.md) gives its reason.

## Examples

```js
export const {} = {};
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `undefined`.

## What to Write Instead

Export a name, as [`alternative.f.js`](./alternative.f.js) does:

```js
export const a = 1;
export default a;
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `module exports nothing` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Exports](https://tc39.es/ecma262/#sec-exports)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring>
