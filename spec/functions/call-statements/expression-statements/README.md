# An Expression Statement That Is No Call Is Refused

**Status:** refused by design

**`o.x;` is not FunctionalScript.** `o.x;` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A statement whose value is discarded and that is no call, such as `o.x;`, `a + 1;` or `Number(x);`, does nothing a later statement can see: an operator's result thrown away is almost always a mistake. FunctionalScript admits a call statement, which can assert, and refuses the rest. A statement opening with `(`, `[` or a backtick is refused too, since it would continue the line before it ([call statements](../README.md)).

The row `st.expression` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [call statements](../README.md) gives its reason.

## Examples

```js
/** @type {(o: { readonly x: number }) => number} */
const f = o => {
    o.x;
    return o.x + 1;
};
export default f({ x: 0 });
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

The discarded `o.x;` expression in `sample.mjs` is intentional. A code-quality
check correctly reports that it has no effect; removing it would remove the
construct this negative example must show the compiler refusing.

## What to Write Instead

Remove the statement, or bind the value with `const` and use it, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(o: { readonly x: number }) => number} */
const f = o => {
    return o.x + 1;
};
export default f({ x: 0 });
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Expression statement](https://tc39.es/ecma262/#sec-expression-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/Expression_statement>
