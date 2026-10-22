# A Key Computed at Run Time Is Refused

**Status:** refused by design

**`a[i]` is not FunctionalScript.** `a[i]` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

In JavaScript `a[i]` reads whatever key `i` names, and the key may name anything the value inherits: `a["constructor"]`, `a["__proto__"]`, `a["push"]`. The compiler cannot see which, so a bracket read with a key computed at run time is refused. Where the key is an index, `a[Number(i)]` says so and reads an element; for a key of any type, the `entry` helper reads an own entry ([entries](../entries/README.md)).

The row `acc.runtime-key` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [property accessor](../../todo/2330-property-accessor.md) gives its reason.

## Examples

```js
/** @type {(a: readonly string[], i: number) => string | undefined} */
const at = (a, i) => a[i];
export default at(["x", "y"], 1);
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `y`.

## What to Write Instead

Read an element with `a[Number(i)]`, or an own entry with `entry(a, i)` (spec/property-access/entries), as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(a: readonly string[], i: number) => string | undefined} */
const at = (a, i) => a[Number(i)];
export default at(["x", "y"], 1);
```

It answers `y`. `Number(i)` makes the key an index, which reads an element and nothing an array inherits.

## A Better Message

Today `fjs compile` prints `computed key is not Number(...)` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Property accessors](https://tc39.es/ecma262/#sec-property-accessors)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors>
