# A Prototype's Name Is Refused

**Status:** refused by design

**`a.toString` is not FunctionalScript.** `a.toString` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

A property name that a built-in prototype defines, `toString`, `push`, `constructor` and the rest, is refused as a read: in JavaScript `{}.toString` finds a function on `Object.prototype`, which FunctionalScript does not have, so the read would answer something the value does not own. `length` is the one exception. To read what a value owns under such a name, the `entry` helper does ([entries](../entries/README.md)).

The row `acc.prototype-name` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [property accessor](../../todo/2330-property-accessor.md) gives its reason.

## Examples

```js
export default typeof {}.toString;
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `function`.

## What to Write Instead

Read an own entry with the `entry` helper (spec/property-access/entries), as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(a: object, b: string) => unknown} */
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
export default typeof entry({}, "toString");
```

It answers `undefined`. `{}` owns no `toString`, so the read is `undefined`.

## A Better Message

Today `fjs compile` prints `prohibited property name` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- ECMA-262: [Property accessors](https://tc39.es/ecma262/#sec-property-accessors)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString>
