# A `throw` Beside an Export Is Refused

**Status:** refused by design

**`throw 1; export default 2;` is not FunctionalScript.** A `throw` before
or after a module's exports is valid JavaScript, and `fjs compile` refuses
it by design: the demo below shows what it prints.

A module is a function ([module structure](../README.md)), and a body ends
in `return` or in `throw`, not in both. So a module's `throw` stands where
its `export default` would, in place of it: after its imports and every
`const`, and with nothing after it. JavaScript runs the statements in order,
so `throw 1; export default 2;` fails at every load, and the export after it
is one no importer can read.

The row `mod.throw-position` of
[refused constructs](../../todo/refused-constructs.md) registers the refusal,
and [module structure](../README.md) gives its reason.

## Examples

```js
throw 1;
export default 2;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: none, since importing it throws `1`.

## What to Write Instead

Keep one ending: the export, as [`alternative.f.js`](./alternative.f.js)
does, or the `throw` alone, for a module meant to fail.

```js
export default 2;
```

It answers `2`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the `export`. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line `alternative.f.js`
writes, as `help`. The page compiles the alternative too, so the suggestion
is one the compiler accepts.

## Reference

- ECMA-262: [Modules](https://tc39.es/ecma262/#sec-modules)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw>
