# Names and Identity

**Status:** implemented

- A function **carries no name**. Its EDAG is `['=>', length, slots, body]`,
  name-erased, so the function in `{ make: () => 0 }.make`, in
  `const hello = () => 0` and in `export default () => 0` is the same node,
  `['=>', 0, [], 0]`, whatever JavaScript would name it (`make`, `hello`,
  `default`), and no program observes the difference: `f.name` is
  refused at the key of `.`, and `entry(f, 'name')` is `undefined` and
  `hasEntry(f, 'name')` `false`, since `name` is not an enumerable own
  property
  ([reading an entry at run time](../../property-access/entries/README.md)), which is
  the decision that retired the proposals that would have exposed a name. The
  name a JavaScript engine gives a function it loads from the written
  output is the writer's spelling, not a result of the program
  ([principles](../../principles/README.md)).
  Empty and rest-only parameter lists both have `length === 0`.
- A function has **identity**, as an object does, and it is JavaScript's:
  evaluating an arrow makes a new function — once for one written at module
  level, once per call for one written in a body — and a `const` holding one
  is that one function however many references reach it. Under
  `const f = () => 1;`, `f === f` is `true`; under
  `const g = (y) => () => y;`, `g(1) === g(1)` is `false`; and
  `(() => 1) === (() => 1)` is `false`, as two separately written objects are
  two ([shared values](../../bindings/constants/README.md)). Denoting the same function
  is sameness of meaning, not of identity.

## Examples

The compiler demo has no programs for this page yet: its accepted and refused examples are a follow-up.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — identity, not names: a function is
equal to itself, and two written alike are two functions — with every output
`fjs compile` makes of it: the expression graph (EDAG), the Rust and the
WebAssembly that Rust builds to. Its Run button calls the default export
with `0` and `1`, as JavaScript and as WebAssembly, and shows what each call
returned or threw.

```js
const hello = () => 0;
const o = { make: () => 0 };
export default (...a) => [hello === hello, hello === o.make, [hello, o.make][Number(a[0])] === hello];
```

## Reference

- ECMA-262: [Function objects](https://tc39.es/ecma262/#sec-function-objects)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name>
