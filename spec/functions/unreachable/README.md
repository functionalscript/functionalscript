# A Statement After `return` Is Refused

**Status:** refused by design

**`return 1; const a` is not FunctionalScript.** `return 1; const a = 2;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

Nothing after `return`, `throw`, or a `switch` with a `default` ever runs. JavaScript admits the text and ignores it; FunctionalScript refuses it, since code that cannot run is a mistake or a leftover, and a reader should not have to work out that it is dead ([functions](../README.md)).

The row `st.unreachable` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [functions](../README.md) gives its reason.

## Examples

```js
/** @type {() => number} */
const f = () => {
    return 1;
    const a = 2;
};
export default f();
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Remove what follows the `return`, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {() => number} */
const f = () => {
    return 1;
};
export default f();
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [The return statement](https://tc39.es/ecma262/#sec-return-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return>
