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

Even if don't like sometimes the syntax, the semantic of these basic types makes a lot of practical sense in modern computer science and software engineering, that have most popular basic types and but allow grouping by order (arrays), and mapping (objects).

## Data JavaScript

FunctionalScript already defines a subset of JavaScript which is much more strict, has no side effects and supports all JSON types. We also would like to make it serialazable, which makes it a kind of ideal PL for handling data and communications, including as data for AI agents and models. Example:

```js
export const hello = "Hello, world!"
export const add = (a, b) => a + b
```

One of the subset of FunctionalScript is DJS (Data JavaScript), when the module contains only data, for example

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

FunctionalScript programs can be run as content-addressable, but their behavior could be different compare to running the same program on JavaScript engine, for example:

```js
const assert = (a, b) => {
    if (a !== b) { throw `${a} !== ${b}` }
    return null
}

export default assert([], [])
```

While content-addressability makes some FunctionalScript very cool, we still would like to have some additional features in a programming language that is design from scratch. For example, we would like to have a hash of an object, a kind of universal, serializable object identity.

```js
const emptyArrayId1 = Object.id([])
const emptyArrayId2 = Object.id([])

export default assert(emptyArrayId1, emptyArrayId2)
```

Without this `Object.id` core function, FunctionalScript could be more like content-equatable instead of fully content-addressable.

## Numbers

Currently, the literal `2` has type `number` which is, usually, 64-bit floating point number, also known as `double`. Initially, JavaScript didn't have biginteger, but, currently they are in ECMAScript standard. Because ECMAScript can't break backward compatibility, they introduced another syntax to describe bigint literals: `2n`, but JSON doesn't support the syntax. While we can have JSON parsers and writers that read and write bigints, the syntax is not the same anymore. So, in a PL design from scratch we would like to have bigint by default:

```ts
const a = 2 // typeof(a) === 'bigint'
const b = 2.0 // typeof(b) === 'number'
```

## UTF8 String

Current implementation of a `string` in JavaScript is UTF16. While we can have a proposal that ECMAScript supports a new type `utf8`, something like `u'Hello, world!'`, the default JS string will be always UTF16. In a new PL, we don't want to have UTF16 at all, only UTF8.

## Separation Between Arrays and Objects

Arrays shouldn't be a subset of objects. It should be a separate type

```js
assert(typeof([]) === 'array') // I wish
```

## Always Lexicographical Order

Properties inside objects should be sorted by lexicographical order. Currently, JS objects preserve properties order:

```js
JSON.stringify({b:0,a:0}) // returns `{"b":0,"a":0}`
```

Always in lexicographical order, and a number is not an exception.

```ts
const x = { 11: 11, 2: 2, a: 3, b: 5 } // { '11': 11, '2': 2, a: 3, b: 5 }
const y = { 2: 2, b: 5, a: 3, 11: 11 } // { '11': 11, '2': 2, a: 3, b: 5 }
```

## Assigning

Assigning `undefined` to a property should remove the property

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

Switch back to `.js` extension if [Type Annotations](https://github.com/tc39/proposal-type-annotations) lands in ECMAScript

## Last Expression is Return and Export (Compatible with JSON)

The last expression is a result of a function. In case of a module, the last expression is exported.

```js
const g = () => 5

const f = () => { g() }

const a = f()

{ a } // exported as `{ "a": 5 }`.
```

## Effect Syntax Sugar

```js
const a = effect() => {
    const x = perform b()
}
```

Similar to `async`/`await` but declarative.
