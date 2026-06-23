# New PL

**Priority:** P3
**Status:** open

## Problem

If we can start from scratch how would it look like.

## Proposal

### JSON compatibility

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

### Data JavaScript

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

## Multiple Syntaxes

Because the canonical identity of a program is the content hash of its semantic representation (AST/IR), not its source text, syntax becomes a rendering preference. Multiple surface syntaxes can compile to the same semantic node and therefore share the same hash — they are literally the same program.

This means we could support, for example, both a JavaScript-style and a Python-style syntax:

```js
// JS-style
const add = (a, b) => a + b
```

```python
# Python-style
add = lambda a, b: a + b
```

Both would produce identical content hashes. Tooling can display any module in whichever syntax the developer prefers, and cross-syntax references just work — a module written in Python syntax can import a function written in JS syntax with no friction, since the identity layer is below syntax.

### Content-Addressability

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

Function identity is a harder problem. Two functions are semantically equal if they produce the same output for every input, but proving that in general is undecidable (equivalent to the halting problem). The practical solution is structural equality: two functions are considered the same if they have the same normalized AST or bytecode. This is decidable and cheap to compute.

The catch is that normalization is not fixed forever — a smarter normalizer in a future VM version may canonicalize more aggressively, causing functions that were distinct under the old normalizer to become equal. This means function hashes are implicitly versioned by the normalizer that produced them. We likely need to encode the normalizer version in the hash (or the VM version), so that old and new hashes remain meaningful and comparable across VM generations.

### Numbers

Currently, the literal `2` has type `number` which is, usually, a 64-bit floating-point number (IEEE 754 double). Initially, JavaScript didn't have biginteger, but currently they are in the ECMAScript standard. Because ECMAScript can't break backward compatibility, they introduced another syntax to describe bigint literals: `2n`, but JSON doesn't support this syntax. While we can have JSON parsers and writers that read and write bigints, the syntax is not the same anymore. The deeper problem is not the `n` suffix itself, but that built-in operations which logically require integers — such as array indexing (`array[i]`) — accept `number` (float) instead of `bigint`. This creates an impedance mismatch: code must either use `number` throughout (losing precision for large integers) or use `bigint` and constantly convert at API boundaries. In a PL designed from scratch, `bigint` is the default integer type and such APIs accept it natively, so no suffix or conversion is needed:

```ts
const a = 2   // typeof(a) === 'bigint'
const b = 2.0 // typeof(b) === 'number' (IEEE 754 64-bit double)
```

Python provides a useful precedent. Python 2 had two integer types: `int` (fixed-width, 32 or 64-bit) and `long` (arbitrary-precision), with `2L` as the bigint literal — mirroring JavaScript's current split between `number` and `bigint`. [Python 3 unified them](https://docs.python.org/3/whatsnew/3.0.html#integers): `int` is now always arbitrary-precision and `long` was removed ([PEP 237](https://peps.python.org/pep-0237/)). The literal `2` is a bigint in Python 3 with no special suffix needed — exactly the behaviour proposed here.

### UTF8 String

Current implementation of a `string` in JavaScript is UTF-16. While we can have a proposal that ECMAScript supports a new type `utf8`, something like `u'Hello, world!'`, the default JS string will always be UTF-16. In a new PL, we don't want to have UTF-16 at all, only UTF-8.

### Separation Between Arrays and Objects

Arrays shouldn't be a subset of objects. It should be a separate type.

```js
assert(typeof([]) === 'array') // I wish
```

### Always Lexicographical Order

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

### Assigning

Assigning `undefined` to a property should remove the property.

```ts
const x = { a: undefined } // {}
```

This way we can also keep better compatibility with JSON.

### Pipeline Operator

```js
a |> b
```

### Automatic Binding

```ts
const m = [42].at
m(0) // 42
```

This would break JavaScript compatibility.

### `BigInt.bitLen`

ECMAScript proposal for `BigInt.bitLen()`

### Type Annotations

Switch back to `.js` extension if [Type Annotations](https://github.com/tc39/proposal-type-annotations) lands in ECMAScript.

### Module Identity

Because content-addressability is a core goal, module identity should be hash-based rather than path-based. A module is identified by the hash of its content, not its file path. Paths become human-friendly aliases that resolve to a hash at publish time. This enables reliable deduplication, caching, and dependency pinning without a lockfile.

### Last Expression is Return and Export (Compatible with JSON)

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

To make FunctionalScript more compatible with the new PL, it should prohibit non `return` statements at the end of a function, or no `export` at the end of the module.

### Pattern Matching

We adopt the syntax from the [TC39 pattern matching proposal](https://github.com/tc39/proposal-pattern-matching) (`match`/`when`), which avoids conflicting with the existing `switch` statement and covers conditional expressions cleanly:

```js
const area = match (shape) {
    when ({ kind: 'circle', r })  => Math.PI * r * r
    when ({ kind: 'rect', w, h }) => w * h
    when (_)                      => 0
}
```

This keeps compatibility with valid JavaScript syntax and aligns with a likely future ECMAScript direction. Exhaustiveness can be checked statically when combined with type annotations (see Type Annotations section). This also composes naturally with the last-expression-as-return proposal.

### Effect Syntax Sugar

Algebraic effects generalize `async`/`await`, exceptions, and other control-flow abstractions into a single declarative mechanism. The proposed syntax mirrors `async`/`await` but is not tied to a specific effect type:

```js
const a = effect() => {
    const x = perform b()
    return perform c(x)
}
```

`effect` marks a function that may perform effects; `perform` suspends the computation and delegates to the nearest handler, similar to how `await` delegates to the runtime scheduler. See [Effects](../fs/effects/)

## Tasks

- [ ] Decide on integer literal syntax (`2` = bigint, `2.0` = float)
- [ ] Define UTF-8 string type and drop UTF-16
- [ ] Specify `typeof` returning `'array'` for arrays
- [ ] Define lexicographic key ordering rules
- [ ] Specify `undefined`-assignment removes property
- [ ] Specify `Object.id` API and hash algorithm
- [ ] Design function identity scheme (normalized AST hashing + VM/normalizer versioning)
- [ ] Define hash-based module identity scheme
- [ ] Specify last-expression-as-export semantics
- [ ] Specify `effect`/`perform` syntax and handler protocol
- [ ] Evaluate pipeline operator (`|>`) syntax
- [ ] Evaluate automatic method binding semantics
- [ ] Specify `if`/`switch` expression semantics and pattern matching syntax
- [ ] Design canonical semantic IR that multiple syntaxes compile to
