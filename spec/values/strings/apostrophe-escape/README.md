# `\'` in a Double-Quoted String Is Refused

**Status:** refused by design

**`"\'"` is not FunctionalScript.** `"\'"` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A double-quoted string is a JSON string in FunctionalScript, so that a JSON document is a module's value as it stands, and JSON has no `\'` escape. JavaScript reads `"\'"` as `"'"`; FunctionalScript refuses the escape, and the apostrophe is written as itself, or escaped in a single-quoted string ([strings](../README.md)).

The row `lit.double-quoted-apostrophe` of [refused constructs](../../../todo/refused-constructs.md)
registers the refusal, and [strings](../README.md) gives its reason.

## Examples

```js
export default "\'";
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `'`.

## What to Write Instead

Write the apostrophe as itself, as [`alternative.f.js`](./alternative.f.js) does:

```js
export default "'";
```

It answers `'`.

## A Better Message

Today `fjs compile` prints `unexpected token` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [String literals](https://tc39.es/ecma262/#sec-literals-string-literals)
- RFC 8259: [Strings](https://www.rfc-editor.org/rfc/rfc8259#section-7)
