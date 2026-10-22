# Binding a Built-in's Name Is Refused

**Status:** refused by design

**`const String` is not FunctionalScript.** `const String = 1` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

`Array`, `Number`, `Object` and `String` name built-ins the language recognizes: `Number(x)` is a conversion and `Object.is` a static function. A module that binds one of these names would make the same text mean something else, so the names are reserved: binding one, or reading one as a value (`export default String`), is refused.

The row `name.intrinsic` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [built-ins](../../todo/2360-built-in.md) gives its reason.

## Examples

```js
/** @type {(x: number) => string} */
const String = x => "s" + x;
export default String(1);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `s1`.

## What to Write Instead

Give the function a name of its own, as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(x: number) => string} */
const s = x => "s" + x;
export default s(1);
```

It answers `s1`.

## A Better Message

Today `fjs compile` prints `reserved word` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String>
