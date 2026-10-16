# Built-in Static Functions

**Status:** implemented

```js
const { is, entries } = Object;
const { isInteger } = Number;
export default [Object.is(0, -0), is(NaN, NaN), [1, 1.5].map(isInteger), Number.isFinite("1"), entries({ b: 1, "0": 2 })];
```

The language admits six static functions. `Object.is` is JavaScript's
SameValue, which tells `0` from `-0` and holds `NaN` equal to itself, where
`===` says the opposite of both. `Object.entries` is JavaScript's too: a
fresh array of fresh `[key, value]` pairs, one per enumerable own
string-keyed property in JavaScript's own-key order — array-index keys
ascending, then every other key in insertion order, so the example's last
element is `[["0", 2], ["b", 1]]` — an array's elements and a string's
UTF-16 code units under their index strings, nothing for a number, a
boolean, a `bigint` or a function, and a failure on `null` and
`undefined`. An entry holding `undefined` is listed, as JavaScript lists
it ([undefined-valued properties](../todo/1010-undefined-property.md)).
The four `Number` predicates are
JavaScript's, none converting its argument: `Number.isInteger`,
`Number.isSafeInteger` — an integer within `2^53 - 1` of `0` —
`Number.isNaN` and `Number.isFinite`, so `Number.isFinite("1")` is `false`
where the global `isFinite("1")`, which converts and is not admitted, is
`true`. Each is a value, as in JavaScript — passed,
compared, read as `Object.is.length` — and one function however often it is
read, so `Object.is === Object.is`. Every spelling of the read is that value:
`Object.is` and `Object["is"]`, and the guarded `Object?.is` and
`Object?.["is"]`, since a namespace is never nullish; a call of it, guarded
or not, is a call of that value, and steps after a guarded read go on as
they would after the plain one. Destructuring is sugar
([destructuring](../bindings/destructuring.md)): `const { is } = Object;` is
`const is = Object.is;`, and an object pattern over a namespace reads each
of its keys as that access does, a nested pattern reading through the
function as through any value — `const { entries } = Object;` too, the
namespace admitting `entries` before the rule that refuses a prototype
name, `Array.prototype`'s, as a key. The sugar holds because no admitted static
reads `this`: JavaScript runs `const { is } = Object; is(a, b)` with
`this` undefined, and each admitted function answers alike detached and on
its namespace, which the runtime's proof checks on every engine the suite
runs on ([`fjs/js/static`](../../fjs/js/static/module.f.js)). A built-in that
builds with `this` as its constructor — `Promise.resolve`,
`Uint8Array.from` — throws detached, and is not admissible.

**`Object` is a reserved word**, under the same
[global-name rule](../todo/2365-global-names.md) as `Number` and `String`,
reserved together with the member it admits. A module cannot bind it as a
`const`, parameter or import, and it is no value: the word alone,
`const o = Object;`, an array pattern over it, a member the namespace does
not admit — `Object.keys(o)` — and a computed key, `Object[k]`, are
compilation errors (`reserved word`), a namespace being closed at compile
time. It stands in one other place, the
[`entry` helper](../property-access/entries.md)'s
`Object.getOwnPropertyDescriptor`. A key or a property name remains
ordinary, `{ Object: 1 }.Object` being `1`. `Number`, reserved for its
conversion already, is a namespace the same way, beside the call
`Number(x)` ([number conversion](../conversions/number.md)). Each later member is
an admission of its own ([built-ins](../todo/2360-built-in.md)).

Each read reaches the graph as the node of its name, `['Object.is']` or
`['Number.isInteger']`, and a call of it as the ordinary call,
`['()', ['Object.is'], [a, b]]` ([`fjs/edag`](../../fjs/edag/README.md)). Each
body is written once, in the `static` section of
[`fjs/js/runtime`](../../fjs/js/runtime/README.md), a VM's and no module's —
a module calls the built-in — and checked there against the host's own;
every executor answers the node from it, and an executor with no binding
for it fails, naming it, rather than answer. `Object.entries` alone has no
body, since enumerating keys is what no body can do otherwise: every
executor binds it natively, and its text, `String(Object.entries)`, is
`a => Object.entries(a)`, the function over the built-in, there being no
EDAG to render, and no name, which the language keeps unobservable
([function source](../principles/README.md#function-source-representation-exception)).
The graph outputs write the node back: the FunctionalScript one as its
name, `Object.is`, the Rust one as the binding the VM answers, which NaNVM
reads from the one runtime it holds — the compiled bodies and
`Object.entries`, created beside them — so every read there is one
function too.

## Examples

The compiler demo offers the programs `staticFunctions` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Object.is](https://tc39.es/ecma262/#sec-object.is), [Object.entries](https://tc39.es/ecma262/#sec-object.entries), [Number.isInteger](https://tc39.es/ecma262/#sec-number.isinteger)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is>, <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries>
