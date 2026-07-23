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

FunctionalScript already defines a subset of JavaScript, has no side effects, and supports all JSON types. We also would like to make it serializable, which makes it a kind of ideal PL for handling data and communications, including as data for AI agents and models. Example:

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

Moving further, we will use FunctionalScript as a foundation to build our programming language. A key design constraint is that most existing FunctionalScript modules should be reusable in the new language with little or no modification. This gives us a large library from day one and means the new PL can be validated incrementally against real code.

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

One invariant must always hold within a VM version: the same object always produces the same id. However, the concrete hash value is not guaranteed to be stable across VM versions — if a future VM switches to a different hash algorithm (e.g. for security or collision-resistance reasons), the same object would produce a different id. This means persisted ids are implicitly tied to the VM version that produced them, and cross-version id comparison requires a migration or a version-tagged id format.

Function identity is a harder problem. Two functions are semantically equal if they produce the same output for every possible input, but proving that in general is undecidable (equivalent to the halting problem, see also [Rice's theorem](https://en.wikipedia.org/wiki/Rice's_theorem)). The practical solution is structural equality: two functions are considered the same if they have the same normalized AST (the stable, canonical representation of functions — bytecode is VM-internal and version-dependent). This is decidable and cheap to compute.

The catch is that normalization is not fixed forever — a smarter normalizer in a future VM version may canonicalize more aggressively, causing functions that were distinct under the old normalizer to become equal. This means function hashes are implicitly versioned by the normalizer that produced them. We likely need to encode the normalizer version in the hash (or the VM version), so that old and new hashes remain meaningful and comparable across VM generations.

### Numbers

Currently, the literal `2` has type `number` which is, usually, a 64-bit floating-point number (IEEE 754 double). Initially, JavaScript didn't have biginteger, but currently they are in the ECMAScript standard. Because ECMAScript can't break backward compatibility, they introduced another syntax to describe bigint literals: `2n`, but JSON doesn't support this syntax. While we can have JSON parsers and writers that read and write bigints, the syntax is not the same anymore. The deeper problem is not the `n` suffix itself, but that built-in operations which logically require integers — such as array indexing (`array[i]`) — accept `number` (float) instead of `bigint`. This creates an impedance mismatch: code must either use `number` throughout (losing precision for large integers) or use `bigint` and constantly convert at API boundaries. In a PL designed from scratch, `bigint` is the default integer type and such APIs accept it natively, so no suffix or conversion is needed:

```ts
const a = 2   // typeof(a) === 'bigint'
const b = 2.0 // typeof(b) === 'number' (IEEE 754 64-bit double)
```

**JS compatibility.** The `n` suffix stays valid too, as an accepted-but-redundant alternate spelling: `2n` parses to the same `bigint` value as `2`. This costs nothing in the grammar (`n` is not needed to disambiguate anything once bare integers are already `bigint`) and keeps the parser compatible with existing JS/FunctionalScript/djs source that already spells bigints as `123n` — matching this document's own design constraint that "most existing FunctionalScript modules should be reusable in the new language with little or no modification." `2.0n` (fraction with a bigint suffix) is a syntax error, same as in JS.

Python provides a useful precedent. Python 2 had two integer types: `int` (fixed-width, 32 or 64-bit) and `long` (arbitrary-precision), with `2L` as the bigint literal — mirroring JavaScript's current split between `number` and `bigint`. [Python 3 unified them](https://docs.python.org/3/whatsnew/3.0.html#integers): `int` is now always arbitrary-precision and `long` was removed ([PEP 237](https://peps.python.org/pep-0237/)). The literal `2` is a bigint in Python 3 with no special suffix needed — exactly the behaviour proposed here.

**Mixed arithmetic.** Current JS throws when an operator mixes `bigint` and `number`:

```js
2n + 2.0 // TypeError: Cannot mix BigInt and other types, use explicit conversions
```

**Proposal:** keep JS's behavior — an operation that mixes `bigint` and `number` throws a `TypeError` rather than implicitly converting either operand. This matches the [TC39 `proposal-bigint`](https://github.com/tc39/proposal-bigint) design rationale ("Design Goals, Or Why Is This Like This?"): implicit coercion has no single correct answer (`bigint`→`number` risks silent precision loss; `number`→`bigint` breaks on non-integer floats like `1.5`), so the proposal "errs on the side of throwing an exception rather than rely on type coercion and risk giving an imprecise answer." Explicit conversion is required at the boundary instead.

Contrast with Python 3, which goes the other way and promotes `int` to `float` silently:

```python
2 + 2.0        # 4.0 (float) — int promoted to float, no error
10**30 + 1.0   # 1e+30 — silent precision loss, everything past ~15-17 significant digits is gone
```

Python's convenience trades away exactly the precision guarantee that motivates defaulting integer literals to `bigint` in the first place, so JS's stricter behavior is the better fit here despite the extra conversion calls it forces at `bigint`/`number` boundaries.

This `2`/`2.0` split doesn't have to wait for a new PL. [fjs/djs/todo/json-bigint-serialization.md](../fjs/djs/todo/json-bigint-serialization.md) proposes the same convention — a dot-free numeric literal is `bigint`, a literal with a `.` (or exponent) is `number` — as a JSON-*compatible* serialization inside today's `fjs/djs`, and independently lands on the same Python precedent (CPython's `json` scanner uses the identical `frac`/`exp`-presence test to choose `int` vs `float`). It's a concrete, buildable-now instance of this section's idea, scoped to serialization rather than the full language.

[todo/blocked/integer-as-bigint.md](./blocked/integer-as-bigint.md) tracks the ECMAScript-level version of this same idea (`123` becoming the language's own default integer type) — blocked because ECMAScript is unlikely to ever make `bigint` the primary numeric type for compatibility reasons. This section is the escape hatch: a new PL isn't bound by that compatibility constraint, so it doesn't have to wait.

### UTF8 String

Current implementation of a `string` in JavaScript is UTF-16. While we can have a proposal that ECMAScript supports a new type `utf8`, something like `u'Hello, world!'`, the default JS string will always be UTF-16. In a new PL, we don't want to have UTF-16 at all, only UTF-8.

See [todo/blocked/utf8-strings.md](./blocked/utf8-strings.md) — blocked on ECMAScript ever adopting a native UTF-8 string primitive, which a new PL doesn't need to wait for.

### Separation Between Arrays and Objects

An array type shouldn't be derived from an object type. It should be a separate type.

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

See [todo/blocked/lexicographic-integer-keys.md](./blocked/lexicographic-integer-keys.md) — blocked on ECMAScript, which is unlikely to ever drop the numeric-key special-casing for compatibility reasons; a new PL adopts pure lexicographic order directly instead.

### Assigning

Assigning `undefined` to a property should remove the property.

```ts
const x = { a: undefined } // {}
```

This way we can also keep better compatibility with JSON.

See [todo/blocked/undefined-removes-property.md](./blocked/undefined-removes-property.md) — blocked on ECMAScript for compatibility reasons; a new PL isn't bound by that and adopts the behavior directly.

### Pipeline Operator

```js
a |> b
```

See [todo/blocked/pipeline-operator.md](./blocked/pipeline-operator.md) — blocked on the TC39 pipeline operator proposal reaching Stage 4; a new PL can adopt the syntax without waiting on that.

### Automatic Binding

```ts
const m = [42].at
m(0) // 42
```

This would break JavaScript compatibility.

See [todo/blocked/automatic-method-binding.md](./blocked/automatic-method-binding.md) — blocked because ECMAScript is unlikely to ever fix this for compatibility reasons; a new PL, not being bound by that compatibility constraint, can define `this`-free method extraction directly.

### `BigInt.bitLen`

ECMAScript proposal for `BigInt.bitLen()`

See [todo/blocked/bigint-bit-len.md](./blocked/bigint-bit-len.md) — blocked on the same proposal reaching Stage 4 and shipping in Node.js LTS.

### Type Annotations

Switch back to `.js` extension if [Type Annotations](https://github.com/tc39/proposal-type-annotations) lands in ECMAScript.

See [todo/blocked/js-extension-type-annotations.md](./blocked/js-extension-type-annotations.md) — the FunctionalScript-specific tracking issue for this same trigger.

### Type System

The new PL starts with type stripping: type annotations are syntax only and are erased before execution, with no built-in type checker. This keeps the core runtime simple and avoids baking in a specific type system.

In the future, type checking is provided as a library — similar to the existing [RTTI module](../fjs/rtti/) — that users opt into by importing it:

```js
import { check } from 'my-type-system'

const add = check((a: number, b: number): number => a + b)
```

This has several advantages:

- Users choose the type system that fits their needs (simple RTTI, dependent types, gradual typing, etc.)
- The same type-checking logic runs at both compile time and runtime — no separate type-checker binary
- Different modules in the same program can use different type systems
- New type systems can be published as ordinary packages without changes to the core language

### Serializable AST

JavaScript's `Function.prototype.toString()` exposes source text, but it is unreliable: all major engines produce incorrect output for closures that capture variables from an outer scope, because the returned string omits the surrounding context needed to reconstruct the function's meaning.

The new PL exposes the AST directly as a serializable value:

```js
const add = (a, b) => a + b

const ast = Function.getAst(add)   // returns a plain serializable object
const add2 = Function.fromAst(ast) // reconstructs the function

assert(add(1, 2) === add2(1, 2))
```

Because the AST is a plain data value (most likely JSON), it can be stored, transmitted, inspected, and transformed without a parser. Combined with `Object.id`, the AST of a function is also its canonical identity (see Content-Addressability). `Function.fromAst` on a different VM or a future VM version must either reproduce the same behavior or reject the AST explicitly — it must never silently produce a different result.

This also enables runtime metaprogramming and macro-like code generation without resorting to `eval` or string manipulation.

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

`effect` marks a function that may perform effects; `perform` suspends the computation and delegates to the nearest handler, similar to how `await` delegates to the runtime scheduler. See [Effects](../fjs/effects/)

### Result Syntax Sugar

In modern software engineering, `throw` is increasingly treated as a way to signal an *unexpected, fatal* condition — a bug, a broken invariant, a crash. It unwinds the stack, is invisible in a function's signature, and is easy to forget to handle. That model is a poor fit for *expected* failures. IO errors (a missing file, a refused connection, a malformed response) are a normal part of a program's behavior and must be handled deliberately, not caught as exceptions somewhere up the stack. Encoding these errors as values — handling errors instead of throwing exceptions — makes them explicit, type-checkable, and impossible to ignore by accident.

FunctionalScript already has a [`Result`](../fjs/types/result/) type:

```ts
type Ok<T>      = readonly ['ok', T]
type Error<E>   = readonly ['error', E]
type Result<T, E> = Ok<T> | Error<E>
```

The problem is that composing functions that return `Result` is verbose. Every call site has to destructure, test the discriminant, and early-return the error:

```ts
const readConfig = (path: string): Result<Config, IoError> => {
    const [k1, text] = readFile(path)
    if (k1 === 'error') { return ['error', text] }
    const [k2, json] = parseJson(text)
    if (k2 === 'error') { return ['error', json] }
    return ['ok', toConfig(json)]
}
```

**Proposal:** adopt a Rust-style propagation operator. A postfix `?` applied to a `Result` unwraps the `ok` value, or short-circuits the enclosing function by returning the `error` unchanged. The example above becomes:

```ts
const readConfig = (path: string): Result<Config, IoError> => {
    const text = readFile(path)?
    const json = parseJson(text)?
    return ok(toConfig(json))
}
```

`expr?` desugars to:

```ts
match (expr) {
    when (['ok', v])  => v
    when (['error', e]) => return error(e)
}
```

Notes and open questions:

- `?` is only valid inside a function whose return type is a `Result` whose error type is compatible with the propagated error (matching Rust, modulo a `From`-style conversion which we may or may not adopt). This composes naturally with the last-expression-as-return and pattern matching proposals.
- This is purely syntactic sugar over the existing `Result` type and the `ok`/`error` constructors — no new runtime semantics, and it can be lowered to plain FunctionalScript.
- The postfix `?` should not be confused with optional chaining (`a?.b`) or the ternary `? :`. Parsing must disambiguate; a worse-case fallback is a keyword form such as `try expr`.
- A combinator/method form (e.g. `result.map(...)`, `result.andThen(...)`, or a `|>` pipeline of them) covers the cases where short-circuit propagation is not what you want — transforming or recovering from the error inline.
- `throw` remains in the language for genuinely unexpected/fatal conditions (broken invariants, unreachable branches), keeping a clear split: `Result` for expected errors, `throw` for bugs.

## Tasks

- [ ] Decide on integer literal syntax (`2` = bigint, `2.0` = float); accept `2n` as a redundant-but-valid alternate spelling for JS/djs source compatibility
- [ ] Specify the `TypeError` thrown on mixed `bigint`/`number` arithmetic (matching current JS behavior) and the explicit conversion functions required at the boundary
- [ ] Define UTF-8 string type and drop UTF-16
- [ ] Specify `typeof` returning `'array'` for arrays
- [ ] Define lexicographic key ordering rules
- [ ] Specify `undefined`-assignment removes property
- [ ] Specify `Object.id` API and hash algorithm
- [ ] Design function identity scheme (normalized AST hashing + VM/normalizer versioning)
- [ ] Define hash-based module identity scheme
- [ ] Specify last-expression-as-export semantics
- [ ] Specify `effect`/`perform` syntax and handler protocol
- [ ] Specify `Result` propagation operator (`?`) desugaring and error-type compatibility rules
- [ ] Evaluate pipeline operator (`|>`) syntax
- [ ] Evaluate automatic method binding semantics
- [ ] Specify `if`/`switch` expression semantics and pattern matching syntax
- [ ] Design canonical semantic IR that multiple syntaxes compile to
- [ ] Design library-based type system API (opt-in, runtime+compile-time)
- [ ] Specify `Function.getAst`/`Function.fromAst` API and AST schema
