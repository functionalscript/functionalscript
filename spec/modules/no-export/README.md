# A Module With No Export Is Refused

**Status:** refused by design

**`const a = 1;` is not FunctionalScript.** `const a = 1;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A FunctionalScript module is a function of its imports, and what it answers is its exports. A module that exports nothing answers nothing anyone can read, and having no effects it can do nothing else, so a module needs at least one export ([module structure](../README.md)).

The row `mod.no-export` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [module structure](../README.md) gives its reason.

## Examples

```js
const a = 1;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `undefined`.

The unused `a` binding in `sample.mjs` is intentional. A code-quality check
correctly reports it as unused: the example must have no exports. Exporting
`a` would remove the refusal, and deleting the binding would leave an empty
module instead of the nonempty module this example demonstrates.

## What to Write Instead

Export what the module computes, as [`alternative.f.js`](./alternative.f.js) does:

```js
const a = 1;
export default a;
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `unexpected end` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Modules](https://tc39.es/ecma262/#sec-modules)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export>
