# New PL

If we can start from scratch how would it look like.

## JSON compatibility

JSON and its derivatives such as YAML are the most popular data formats. It has the most essential types that are used in modern information technologies:

- `boolean`
- `string`
- `number`
- `array`
- `object` - essentially a dictionary
- `null`

And this is understandable because JSON (JavaScript Object Notation) is derived from JavaScript and uses its basic types.

```json
{
    "a": "hello",
    "b": [12, -34.67, null],
    "c": false,
}
```

Even if we don't always like the syntax, the semantics of these basic types make a lot of practical sense in modern computer science and software engineering, having the most popular basic types and allowing grouping by order (arrays) and mapping (objects).

## Data JavaScript

FunctionalScript already defines a subset of JavaScript which is stricter, has no side effects and supports all JSON types. We also would like to make it serializable, which makes it a kind of ideal PL for handling data and communications, including as data for AI agents and models. Example:

```js
export const hello = "Hello, world!"
export const add = (a, b) => a + b
```

One of the subsets of FunctionalScript is DJS (Data JavaScript), when the module contains only data, for example

```js
export default {
    "a": "hello",
    "b": [12, -34.67, null],
    "c": false
}
```

Or

```js
export default {
    a: 'hello',
    b: [12, -34.67, null],
    c: false
}
```

You just need to add `export default` at the beginning of your JSON.

Moving further, we will use FunctionalScript as a foundation to build our programming language.

## Content-Addressability

FunctionalScript programs can be run as content-addressable, but their behavior could be different compared to running the same program on a JavaScript engine, for example:

```js
const assert = (a, b) => {
    if (a !== b) { throw `${a} !== ${b}` }
    return null
}

export default assert([], [])
```

Under content-addressability, both `[]` literals refer to the same canonical empty-array value, so `assert` passes. Running the same code on a standard JS engine would throw because `[] !== []` (different references).

While content-addressability makes some FunctionalScript very cool, we still would like to have some additional features in a programming language designed from scratch. For example, we would like to have a hash of an object — a kind of universal, serializable object identity.

```js
const emptyArrayId1 = Object.id([])
const emptyArrayId2 = Object.id([])

export default assert(emptyArrayId1, emptyArrayId2)
```

`Object.id` returns the canonical content-hash of its argument, so two structurally equal values always yield the same id. Without this `Object.id` core function, FunctionalScript could be more like content-equatable instead of fully content-addressable.

## Numbers

Currently, the literal `2` has type `number` which is, usually, a 64-bit floating-point number (IEEE 754 double). Initially, JavaScript didn't have biginteger, but currently they are in the ECMAScript standard. Because ECMAScript can't break backward compatibility, they introduced another syntax to describe bigint literals: `2n`, but JSON doesn't support this syntax. While we can have JSON parsers and writers that read and write bigints, the syntax is not the same anymore. So, in a PL designed from scratch we would like to have bigint by default:

```ts
const a = 2   // typeof(a) === 'bigint'
const b = 2.0 // typeof(b) === 'number' (IEEE 754 64-bit double)
```

## UTF8 String

Current implementation of a `string` in JavaScript is UTF-16. While we can have a proposal that ECMAScript supports a new type `utf8`, something like `u'Hello, world!'`, the default JS string will always be UTF-16. In a new PL, we don't want to have UTF-16 at all, only UTF-8.

## Separation Between Arrays and Objects

Arrays shouldn't be a subset of objects. It should be a separate type.

```js
assert(typeof([]) === 'array') // I wish
```

## Always Lexicographical Order

Properties inside objects should be sorted in lexicographical order. Currently, JS objects preserve insertion order:

```js
JSON.stringify({b:0,a:0}) // returns `{"b":0,"a":0}`
```

In the new PL, all keys are strings and always sorted lexicographically (pure string comparison, no special numeric treatment).

```ts
const x = { 11: 11, 2: 2, a: 3, b: 5 } // { '11': 11, '2': 2, a: 3, b: 5 }
const y = { 2: 2, b: 5, a: 3, 11: 11 } // { '11': 11, '2': 2, a: 3, b: 5 }
```

Note: JS already sorts integer-like keys numerically before string keys, so the output above matches current JS behavior. In the new PL the same result would be produced by pure lexicographic order (`'11' < '2' < 'a' < 'b'`), which happens to agree here. The key difference is that JS's numeric-key special-casing is eliminated — the rule is simply: sort by string comparison.

## Assigning

Assigning `undefined` to a property should remove the property.

```ts
const x = { a: undefined } // {}
```

This way we can also keep better compatibility with JSON.

## Pipeline Operator

```js
a |> b
```

## Automatic Binding

```ts
const m = [42].at
m(0) // 42
```

This would break JavaScript compatibility.

## `BigInt.bitLen`

ECMAScript proposal for `BigInt.bitLen()`

## Type Annotations

Switch back to `.js` extension if [Type Annotations](https://github.com/tc39/proposal-type-annotations) lands in ECMAScript.

## Module Identity

Because content-addressability is a core goal, module identity should be hash-based rather than path-based. A module is identified by the hash of its content, not its file path. Paths become human-friendly aliases that resolve to a hash at publish time. This enables reliable deduplication, caching, and dependency pinning without a lockfile.

## Last Expression is Return and Export (Compatible with JSON)

Currently, this JavaScript code doesn't export the object the way JSON would:

```js
{ "a": 5 }
```

**Proposal:** The last expression is the result of a function. In the case of a module, the last expression is exported.

```js
const g = () => 5

const f = () => { g() }

const a = f()

{ a } // exported as `{ "a": 5 }`.
```

## Effect Syntax Sugar

Algebraic effects generalize `async`/`await`, exceptions, and other control-flow abstractions into a single declarative mechanism. The proposed syntax mirrors `async`/`await` but is not tied to a specific effect type:

```js
const a = effect() => {
    const x = perform b()
    return perform c(x)
}
```

`effect` marks a function that may perform effects; `perform` suspends the computation and delegates to the nearest handler, similar to how `await` delegates to the runtime scheduler.
