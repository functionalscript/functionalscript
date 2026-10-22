# Binding a Literal Word Is Refused

**Status:** refused by design

**`const undefined` is not FunctionalScript.** `const undefined = 1` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`undefined`, `NaN` and `Infinity` are names in JavaScript, not keywords, so a module may bind them: after `const undefined = 1`, `undefined` is `1`. FunctionalScript reads the three as the values they spell everywhere, so binding one is refused, and a reader can trust what the word means.

The row `name.literal-word` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [literal words](../../todo/2445-literal-words-as-references.md) gives its reason.

## Examples

```js
const undefined = 1;
export default undefined;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `1`.

## What to Write Instead

Give the constant a name of its own, as [`alternative.f.js`](./alternative.f.js) does:

```js
const one = 1;
export default one;
```

It answers `1`.

## A Better Message

Today `fjs compile` prints `reserved word` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined>
