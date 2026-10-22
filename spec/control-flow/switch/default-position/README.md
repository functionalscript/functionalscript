# A `default` Before a `case` Is Refused

**Status:** refused by design

**`default` is not FunctionalScript.** `switch (n) { default: … case 1: … }` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

In a FunctionalScript `switch` every branch terminates, in `return` or `throw`, so where the `default` stands says nothing about what runs: JavaScript tries every `case` first wherever the `default` is written. The language keeps one spelling, the `default` last, so a reader finds it where it applies ([switch](../README.md)).

The row `st.switch-default` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [switch](../README.md) gives its reason.

## Examples

```js
/** @type {(n: number) => string} */
const name = n => {
    switch (n) {
        default: { return "many"; }
        case 1: { return "one"; }
    }
};
export default name(1);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `one`.

## What to Write Instead

Move the `default` after the last `case`, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(n: number) => string} */
const name = n => {
    switch (n) {
        case 1: { return "one"; }
        default: { return "many"; }
    }
};
export default name(1);
```

It answers `one`. The answer is the same, since JavaScript tries the `case` first in both.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [The switch statement](https://tc39.es/ecma262/#sec-switch-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch>
