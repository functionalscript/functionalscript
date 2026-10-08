# Property Accessor

**Status:** the constant-key read is in the language
([spec: property access](../README.md#property-access)): an own-property
read, with every built-in prototype name but `length` a compilation error,
the names held by [`fjs/js/prototype`](../../fjs/js/prototype/module.f.js),
and an access on a numeric literal read as JavaScript reads it — `-1 .x` is
`-(1 .x)`, the unary minus binding looser than the access. So is the
computed key, `a[Number(b)]`, the EDAG's `['.', a, ['Number', b]]`, in an
access, a method call and an optional chain; every other value in brackets
is refused at its first token, and a negative constant is written as the
string it names. Method calls follow the
[current function specification](../README.md#functions).

The runtime key is `entry`, in the language
([spec: entry](../README.md#reading-an-entry-at-run-time)): the explicit
enumerable-entry helper, recognized whole and lowered to the EDAG's
`['entry']`. It superseded the old descriptor-value-only source pattern and
the `Object.hasOwn`-based alternative. `Object.hasOwn` and
`obj.hasOwnProperty(...)` are prohibited source operations, not operations to
reinterpret. [Enumerable presence](./2345-has-own-property.md) proposes a
separate `hasEntity` pattern. All such instructions follow
[statement-aware AST recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md).

What this file still owns is `a[+i]`, beside the numeric index
`a[Number(i)]` that is in the language, where the program knows no `bigint`
reaches the index — unary `+` waits on the
[operators](./2340-operators.md) admitting it. Where a program knows its
index to be a number, `a[Number(i)]` is the spelling to write, `entry`
being the read for a key of any type.

Syntax examples (planned computed/runtime-key forms included):

```js
const a = { b: 45, c: [3] }
// static read: EDAG '.'
const c0 = a.b
// the same static-read operation, with another permitted constant key
const c1 = a["c"]
// numeric-index read: EDAG '.' with a Number operand
const c2 = c1[Number(0)] // Number(...) is required when index type is unknown at compile time
// runtime enumerable-entry read, with entry defined by the pattern below
const c3 = entry(a, c2)
```

In this note we consider whether or not to support JS's property accessors, maybe also
considering partial support. A very important aspect is - whether or not accessing
a given property (in this or that way) might enable side effects - if implemented in
100% JS-compliant way, such a property caused violations of FJS's design principles.
So the most straightforward way to deal with such a property in FJS could be a compilation
error. In other cases we might decide to provide a limited property access.
Finally, some JS standard properties / methods are 100% FJS-legit and so will be implemented
in full.

A runtime data-entry read bypasses prototypes through an explicitly written
JavaScript pattern, rather than changing ordinary bracket access or standard
reflection semantics. This permits dynamic data names without exposing every
own property or a descriptor value.

Absence of side effects is necessary, not sufficient for admission. An admitted
operation must preserve its source's successful JavaScript behavior. The
[built-in plan](./2360-built-in.md) also prohibits reflection operations for
which the language intentionally offers a narrower, explicitly spelled pattern.

One important detail regarding run-time access to instance properties, methods is
`obj[<expression>]` syntax when <expression> can evaluate to a string. On one hand,
in JS that syntax enables possibilities to abuse; on another hand, it's a regular
syntax for array indexing, legit in FJS. Our current approach is to force FJS users to
wrap `<expression>` in `Number(...)` in cases when `<expression>` type is not known at
compile time.

The runtime-key helper, with a JavaScript behavior example, which the
compiler reads as the helper and every executor answers alike:

```js
const entry = (object, property) => {
    const descriptor = Object.getOwnPropertyDescriptor(object, property);
    return descriptor?.enumerable ? descriptor.value : undefined;
};
const values = [7];
export default [values.length, entry(values, "length")]; // [1, undefined]
```

Its complete parsed function body is recognized after statements, expressions
and binding relationships are known. The matcher does not read newlines or
repair statement boundaries. Descriptor use is permitted only inside the
whole helper; extracting or returning a descriptor is still refused. The
helper's calls are ordinary calls, and no internal operation stands beside
the node ([`fjs/edag`](../../fjs/edag/README.md)). None is a fallback for
ordinary static access.

## Source-to-EDAG mapping

**P1 reconciliation:** source operations, EDAG nodes and bytecode
specializations are different layers. The former rule that non-built-in
static names generate `own_property` is superseded. Every admitted
constant-key read uses `.`; a name's absence from a built-in table does not
select the enumerable-entry operation.

| Source | EDAG | Status |
|--------|------|--------|
| `a.foo`, `a["foo"]` | `['.', A, 'foo']` | Current, for permitted names |
| `a[0]` | `['.', A, 0]` | Current |
| `a[Number(i)]` | `['.', A, ['Number', I]]` | Current |
| `a.foo(x)` | `['.', A, 'foo', ['\|()', Args]]` | Current receiver-preserving lowering, for permitted names |
| The `entry` helper, recognized whole | `['entry']` | Current ([spec: entry](../README.md#reading-an-entry-at-run-time)) |
| `entry(a, key)` | `['()', E, [A, K]]` | Current, an ordinary call of that helper |

`A`, `K` and `E` denote lowered receiver, key and helper expressions;
`Args` denotes the lowered argument list. The method-call
continuation preserves the receiver; a detached `()` over a completed
property read does not. Parsing these constructs into a JavaScript-subset AST
is separate from admitting and lowering them into EDAG.

Backend names such as `instance_property`, `at` and `own_property` in older
sketches are not source-to-EDAG rules. A backend may specialize `.` for a
known receiver/key, or share a lookup helper where the semantics agree,
without replacing it with an enumerable-only operation. This does not rename
host helpers or change an existing opcode. The EDAG's former `own` operation
went with the helper's arrival: `.` represents ordinary static reads, and
`['entry']` the one read of a computed key.

## Instance Property

```js
obj.property
obj["property"]
```

Both forms lower to `['.', O, 'property']` when the name is permitted.
AST-to-EDAG compilation rejects prohibited names; other permitted names do not
fall back to `own`. Static access keeps its ordinary successful JavaScript
meaning, including non-enumerable `length`, whereas the proposed `entry`
helper intentionally excludes non-enumerable properties.

The former `InstanceProperty` structure and built-in-index/`own_property`
split described possible bytecode specialization, not distinct EDAG
operations. A backend may optimize an admitted array-length or other known
read, but must preserve its semantics. No particular bytecode layout is
required here.

The property inventories below are research notes, not additional source
admissions or new runtime-failure rules. The current prohibited-name policy
above remains authoritative; any later admission must preserve its source
behavior.

[Object Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_properties): `__proto__` and `consructor`

The current decision is to prohibit both.

|name         |side-effect                   |
|-------------|------------------------------|
|`__proto__`  |access to function constructor|
|`constructor`|access to function constructor|

Examples of how to abuse (in JS) so FJS should strictly prohibit (compile-time and, most likely, run-time as well):

```js
const f = () => {}
{
    const c = f.constructor
    const g = c(`console.log('hello')`)
    g() // side effect
}
{
    const p = f.__proto__
    const c = Object.getOwnPropertyDescriptor(p, 'constructor').value
    const g = c(`console.log('hello')`)
    g() // side-effect
}
```

[Array Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#instance_properties)

|name    |side-effect|
|--------|-----------|
|`length`|no         |

[Function Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function#instance_properties)

|name         |side-effect|run-time |
|-------------|-----------|---------|
|`arguments`  |no         |error    |
|`caller`     |no         |error    |
|`displayName`|no         |         |
|`name`       |no         |error    |
|`prototype`  |no         |undefined|

'Error' in run-time column above means: we plan to have a run-time error in the intial
implementation for the sake of simplicity, since correspondent functionality has better
alternatives. However we need to investigate whether or not we want to change that
for the sake of supporting JS legacy in cases when that is FJS-safe.

[Map Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#instance_properties)

|name  |side-effect|
|------|-----------|
|`size`|no         |

## Instance Method Call

Syntax examples:

```js
// static property step owns the call and its receiver
const c4 = a.b(c)
// the same receiver-preserving EDAG chain
const c5 = a["b"](c)
// numeric-key chain, not a runtime entry read
const c6 = a[Number(b)](c)
```

Instance method call is different from property access in JS because of `this` considerations.

JavaScript-only receiver example, not admission of these built-in methods:
```js
const a = ["bison"]
a.indexOf("bison") // returns 0
const p = a.indexOf
p("bison") // run-time exception in JS, so FJS should throw an exception here as well
```
The example explains why admitting a method requires preserving its receiver;
absence of side effects alone does not admit it.

```js
obj.property(parameters)
obj['property'](parameters) // where 'property' is a property name well-known at compile time
```

For admitted names, the property step owns the call:
`['.', O, 'property', ['|()', Args]]`. The older `InstanceMethodCall`
structure is a possible bytecode specialization, not another EDAG node.
A backend may specialize the chain only while preserving the receiver and
argument behavior. Admission of additional built-in methods, or of their
use as detached values, remains separate from this lowering rule.

[Object Instance Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_methods)

This inventories side effects, not permission to call each method. In
particular, `hasOwnProperty` remains prohibited; the explicit enumerable
patterns are the source API instead.

|name                  |side-effect     |
|----------------------|----------------|
|`__defineGetter__`    |mutate          |
|`__defineSetter__`    |mutate          |
|`__lookupGetter__`    |'__proto__'     |
|`__lookupSetter__`    |'__proto__'     |
|`hasOwnProperty`      |no              |
|`isPrototypeOf`       |no              |
|`propertyIsEnumerable`|no              |
|`toLocaleString`      |access to locale|
|`toString`            |no              |
|`valueOf`             |no              |

As stated above, all rows that have other than 'no' in side-effect column should be prohibited
(both at compile time when possible and run-time when the property name got calculated at run time).

TODO: file a separate .md regarding custom `toString`, `valueOf` implementations, and maybe other methods listed here as well.

[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)

Regarding `iterator` in notes column: why do we want to prohibit 'naked' iterator access (as opposite to iterable objects
like arrays that can produce iterators via `a[Symbol.iterator]`)? Iterators could be mutated not only via `next`,
but also implicitly byt `for of` loops:

```js
const i = ["bison"].entries()
const f = (j) => {
    let s = 0
    for (const k of j) {
        s += k.length
    }
    return s
}
f(i) // returns 5
f(i) // returns 0 thanks to side effects!
```

|name                  |side-effect|notes   |
|----------------------|-----------|--------|
|`at`                  |no         |        |
|`concat`              |no         |        |
|`copyWith`            |no         |        |
|`entries`             |yes        |iterator|
|`every`               |no         |        |
|`fill`                |yes        |mutate  |
|`filter`              |no         |        |
|`find`                |no         |        |
|`findIndex`           |no         |        |
|`findLast`            |no         |        |
|`findLastIndex`       |no         |        |
|`flat`                |no         |        |
|`flatMap`             |no         |        |
|`forEach`             |no         |        |
|`includes`            |no         |        |
|`indexOf`             |no         |        |
|`join`                |no         |        |
|`keys`                |yes        |iterator|
|`lastIndexOf`          |no         |        |
|`map`                 |no         |        |
|`pop`                 |yes        |mutate  |
|`push`                |yes        |mutate  |
|`reduce`              |no         |        |
|`reduceRight`         |no         |        |
|`reverse`             |yes        |mutate  |
|`shift`               |yes        |mutate  |
|`slice`               |no         |        |
|`some`                |no         |        |
|`sort`                |yes        |mutate  |
|`splice`              |yes        |mutate  |
|`toReversed`          |no         |        |
|`toSorted`            |no         |        |
|`toSpliced`           |no         |        |
|`unshift`             |yes        |mutate  |
|`values`              |yes        |iterator|
|`with`                |no         |        |

[Function Instance Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function#instance_methods)

|name   |side-effect|notes                      |
|-------|-----------|---------------------------|
|`apply`|no         |`this` needs considerations|
|`bind` |no         |`this` needs considerations|
|`call` |no         |`this` needs considerations|

[Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)

|name     |side-effects|notes |
|---------|------------|------|
|`clear`  |yes         |mutate|
|`delete` |yes         |mutate|
|`entries`|no          |      |
|`forEach`|no          |      |
|`get`    |no          |      |
|`has`    |no          |      |
|`keys`   |no          |      |
|`set`    |yes         |mutate|
|`values` |no          |      |

## At

```js
obj[42]
obj[Number(index)]
```

Constant numeric indices use EDAG `.` too, and so does the `Number(...)`
form, `['.', O, ['Number', I]]`, in the language
([spec: property access](../README.md#property-access)); `at` is only a
possible backend specialization, not a separate EDAG tag or an
enumerable-entry read.

```js
import m from './m.f.js'
const a = [2, 3]
export default {
    "a": a[0],
    // we don't know what is the type of `m` so we force it to be a `number` via `Number(...)`.
    "b": a[Number(m)]
}
```

In `obj[index]`, `index` has to be a `number`. If we don't know what `index` is, wrap it in
`Number(...)`. The expression inside the `[]` is either `Number(...)`, a number literal,
or a string literal (excluding the prototype names); anything else is refused at its first
token. FJS may try deeper analyses in the future, and type inference can help a lot.

## Regression requirements

- Preserve static `.` lowering for ordinary and missing fields, numeric
  indices and non-enumerable `length`; reject prohibited names during
  AST-to-EDAG compilation. Cover receiver-preserving calls and source round
  trips as their writer support lands.
- When implementing `entry`, compare the complete helper with JavaScript,
  including the `length` distinction above. Keep unmatched descriptor uses
  refused. Backend helper reuse must not merge these semantic contracts.

## Iterators

Direct access to an object with the [`Iterator` protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)
is not allowed in FJS.

```ts
type Value<T> = { done: true } | { done?: false, value: T }
type Iterator<T> = {
    next: () => Value<T>
}
```

However, FJS allows access to objects with the `Iterable` protocol.

```ts
type Iterable<T> = {
    [Symbol.iterator]: () => Iterator<T>
}
```

For example, JS Array implements the `Iterable` protocol.

If we need to implement support for [generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) in the FJS,
the generator function has to be wrapped into `Iterable` interface. For example,

```js
// compilation error!
const iterator = *() {
    yield 4
    yield 2
}
// ok
const iterable = {
    *[Symbol.iterator]() {
        yield 4
        yield 2
    }
}
```

**Open Questions**

- Generator detection (has a `Symbol.iterator` property and it's not an array)
- Serialization/Deserialization of generators.
