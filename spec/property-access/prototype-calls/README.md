# A Prototype's Method Is Refused

**Status:** refused by design

**`a.hasOwnProperty(k)` is not FunctionalScript.** `a.hasOwnProperty(k)` is valid JavaScript, and
`fjs compile` refuses it by design: the demo below shows what it prints.

Calling a method a built-in prototype defines, such as `o.hasOwnProperty(k)`, is refused: the method is found on the prototype chain, which FunctionalScript does not have, and an object can shadow it with an own entry of the same name. The built-ins the language admits are listed one by one, and these are not among them. Whether a value owns an entry is asked with the `hasEntry` helper ([entries](../entries/README.md)).

The row `acc.prototype-call` of [refused constructs](../../todo/refused-constructs.md)
registers the refusal, and [built-ins](../../todo/2360-built-in.md) gives its reason.

## Examples

```js
export default ({ a: 1 }).hasOwnProperty("a");
```

The demo on this page compiles [`sample.mjs`](./sample.mjs), the module
above, with this build's `fjs compile`, and shows the line it prints and the
token it refuses. Below that it shows what JavaScript answers for the same
module: `true`.

## What to Write Instead

Ask whether a value owns an entry with the `hasEntry` helper (spec/property-access/entries), as [`alternative.f.js`](./alternative.f.js) does:

```js
/** @type {(a: object, b: string) => boolean} */
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
export default hasEntry({ a: 1 }, "a");
```

It answers `true`.

## A Better Message

Today `fjs compile` prints `prohibited member function` at the refused token. The demo
proposes what it should print instead: the reason at the same token, what
JavaScript does there, and the allowed spelling, the line
`alternative.f.js` writes, as `help`. The page compiles the alternative
too, so the suggestion is one the compiler accepts.

## Reference

- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty>
