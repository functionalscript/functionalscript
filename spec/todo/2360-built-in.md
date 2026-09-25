# Built-in Objects and Functions

The built-in objects are special. We can call a permitted function, but cannot
use its global namespace as an ordinary value. Some operations are permitted
only inside a complete recognized pattern, not as independent calls.

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

Some of the JS built-in objects and functions are "not allowed" in FS. It means, an FS compiler rejects code that contains "not allowed" objects and functions.

## Global Scope

Global objects can't be assigned to a variable (`const r = Object`). They can only be used as namespaces (`Object.entries()`).

None of these names may be *bound* by a module either, or admitting one
later would change what a module already means:
[`2365-global-names.md`](./2365-global-names.md), which lands first.

A ticked box below marks a name the language is to admit, not one it admits
today. Only `Infinity`, `NaN` and `undefined` are implemented, as reserved
words ([numbers](../README.md#numbers)); every other global is refused as an
unbound name (`const not found`), so `export default isFinite(1);` does not
compile yet. An unticked box is a name not yet decided, or, where it says
so, never admitted.

### Value Properties

- [x] `Infinity`
- [x] `NaN`
- [x] `undefined` — a literal global like the two above it
- [ ] `globalThis` — never, not not-yet: it is the global object itself

### Function Properties

- [ ] `eval` — never, not not-yet: it runs source at run time. Binding the
      word is refused already, and by JavaScript rather than by us
- [x] `isFinite()`
- [x] `isNaN()`
- [x] `parseFloat()`
- [x] `parseInt()`
- [ ] `encodeURI()`
- [ ] `encodeURIComponent()`
- [ ] `decodeURI()`
- [ ] `decodeURIComponent()`

### Fundamental Objects

- [x] `Object`
- [ ] `Function`
- [ ] `Boolean`
- [ ] `Symbol`

### Number and Math

- [ ] `Number`
- [ ] `BigInt`
- [ ] `Math`
- [ ] `Date`

### Text Processing

- [ ] `String`
- [ ] `RegExp`

### Indexed Collections

- [x] `Array`
- [ ] `Int8Array`
- [ ] `Uint8Array`
- [ ] `Uint8ClampedArray`
- [ ] `Int16Array`
- [ ] `Uint16Array`
- [ ] `Int32Array`
- [ ] `Uint32Array`
- [ ] `Float32Array`
- [ ] `Float64Array`
- [ ] `BigInt64Array`
- [ ] `BigUint64Array`

### Keyed Collections

- [ ] `Map`
- [ ] `Set`
- [ ] `WeakMap`
- [ ] `WeakSet`

### Structured Data

- [ ] `ArrayBuffer`
- [ ] `SharedArrayBuffer`
- [ ] `Atomics`
- [ ] `DataView`
- [x] `JSON`

### Control Abstraction Objects

- [ ] `Promise`

`Generator`, `GeneratorFunction`, `AsyncFunction` and
`AsyncGeneratorFunction` stood here and are gone: no global object has them
— they are intrinsics reached through a prototype — so admitting one would
mean inventing a global JavaScript does not have. `AsyncIterator` and
`AsyncGenerator` are the same case.

### Reflection

- [ ] `Reflect`
- [ ] `Proxy`

### Internalization

- [ ] `Intl`

### WebAssembly

- [ ] `WebAssembly`
- [ ] `WebAssembly.Module`
- [ ] `WebAssembly.Instance`
- [ ] `WebAssembly.Memory`
- [ ] `WebAssembly.Table`
- [ ] `WebAssembly.CompileError`
- [ ] `WebAssembly.LinkError`
- [ ] `WebAssembly.RuntimeError`

## Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

### Reflection boundary

`Object.hasOwn`, `Object.getOwnPropertyNames` and
`Object.getOwnPropertyDescriptors` are prohibited in FJS source. They keep
their JavaScript meanings; do not redefine them over enumerable properties.
`obj.hasOwnProperty(...)` is not a replacement source spelling.

Use explicit enumerable-entry patterns instead:
[`entry`](../../fjs/edag/todo/entry.md) reads a data value, and
[enumerable presence](./2345-has-own-property.md) proposes a separate
`hasEntity` pattern. `Object.getOwnPropertyDescriptor` is permitted only as
part of a complete approved AST pattern, never as an exposed descriptor API.

[Statement-aware recognition](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
resolves statements, expressions and bindings before matching. No built-in
receives a whitespace-insensitive token-parser shortcut. A standard operation
must either retain its successful JavaScript behavior or remain prohibited.

The table below inventories side effects, **not unconditional admission**.
Having no side effects is necessary but not sufficient. It neither overrides
the reflection restrictions nor changes host-side implementation helpers.

|Function                 |side-effect                |
|-------------------------|---------------------------|
|assign                   |mutate                     |
|create                   |creates a special prototype|
|defineProperties         |mutate                     |
|defineProperty           |mutate                     |
|entries                  |no                         |
|freeze                   |mutate                     |
|fromEntries              |no                         |
|getOwnPropertyDescriptor |no                         |
|getOwnPropertyDescriptors|no                         |
|getOwnPropertyNames      |no                         |
|getOwnPropertySymbols    |return symbols             |
|getPrototypeOf           |return prototypes          |
|groupBy                  |return null-property object|
|hasOwn                   |no                         |
|is                       |no                         |
|isExtensible             |no                         |
|isFrozen                 |no                         |
|isSealed                 |no                         |
|keys                     |no                         |
|preventExtensions        |mutate                     |
|seal                     |mutate                     |
|setPrototypeOf           |mutate                     |
|values                   |no                         |

## Array

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

|Function                 |side-effect|
|-------------------------|-----------|
|from                     |no         |
|fromAsync                |?          |
|isArray                  |no         |
|of                       |no         |

## BigInt

|Function                 |side-effect|
|-------------------------|-----------|
|asIntN                   |no         |
|asUintN                  |no         |

## JSON

|Function    |side-effect|
|------------|-----------|
|`isRawJSON` |no         |
|`parse`     |no         |
|`rawJSON`   |no         |
|`stringify` |no         |

## Others

|Function                 |side-effect|
|-------------------------|-----------|
|`decodeURI()`            |no         |
|`decodeURIComponent()`   |no         |
|`encodeURI()`            |no         |
|`encodeURIComponent()`   |no         |
|`eval()`                 |runs source; never admitted|
|`isFinite()`             |no         |
|`isNaN()`                |no         |
|`parseFloat()`           |no         |
|`parseInt()`             |no         |

|Property    |side-effect|
|------------|-----------|
|`Infinity`  |no         |
|`NaN`       |no         |

## Prohibited Properties

The two lists that decide this today — every prototype name refused as a
property read, `length` excepted, and the member functions refused as a
call — are [`fjs/js/prototype`](../../fjs/js/prototype/module.f.mjs)'s
`prototypeNames` and `prohibitedCalls`, with one row per name and its reason
in [its README](../../fjs/js/prototype/README.md). The notes below predate
them and are kept as the record of the reasoning.

### Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

- [ ] ! `constructor` — can create a new function, e.g. `(() => null).constructor('a', 'return a * a')`
- [ ] deprecated `__proto__`
- [ ] ! deprecated `__defineGetter__` — can mutate an object
- [ ] ! deprecated `__defineSetter__` — can mutate an object
- [ ] deprecated `__lookupGetter__`
- [ ] deprecated `__lookupSetter__`

### Array

These instance methods mutate an array:

- [ ] ! `copyWithin`
- [ ] ! `fill`
- [ ] ! `pop`
- [ ] ! `push`
- [ ] ! `reverse`
- [ ] ! `shift`
- [ ] ! `sort`
- [ ] ! `splice`
- [ ] ! `unshift`
