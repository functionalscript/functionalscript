# Predefined Object And Properties

## Global Objects

Global objects. Global objects can't be assigned to something `const r = Object`. They can only be used as namespaces `Object.getOwnProperties()`.

### Value properties

- [x] `Infinity`
- [x] `NaN`
- [x] `undefined`
- [ ] `globalThis`

### Function properties

- [ ] `eval`
- [x] `isFinite()`
- [x] `isNan()`
- [x] `parseFloat()`
- [x] `parseInt()`
- [ ] `encodeURI()`
- [ ] `encodeURIComponent()`
- [ ] `decodeURI()`
- [ ] `decodeURIComponent()`

### Fundamental objects

- [x] `Object`. For example `Object.entries`, `Object.fromEntries`.
- [ ] `Function`
- [ ] `Boolean`
- [ ] `Symbol`

### Error objects

- [ ] `Number`
- [ ] `BigInt`
- [ ] `Math`
- [ ] `Date`

### Text processing

- [ ] `String`
- [ ] `RegExp`

### Indexed collections:

- [x] `Array`. For example `x instanceof Array`
- [ ] `Int8Array`
- [ ] `UInt8Array`
- [ ] `UInt8ClampedArray`
- [ ] `Int16Array`
- [ ] `UInt16Array`
- [ ] `Int32Array`
- [ ] `UInt32Array`
- [ ] `Float32Array`
- [ ] `Float64Array`
- [ ] `BigInt64Array`
- [ ] `BigUint64Array`

### Keyed collections:

- [ ] `Map`
- [ ] `Set`
- [ ] `WeakMap`
- [ ] `WeakSet`

### Structured data:

- [ ] `ArrayBuffer`
- [ ] `SharedArrayBuffer`
- [ ] `Atomics`
- [ ] `DataView`
- [x] `JSON`. For example `JSON.stringify`

### Control abstraction objects

- [ ] `Promise`
- [ ] `Generator`
- [ ] `GeneratorFunction`
- [ ] `AsyncFunction`
- [ ] `AsyncGeneratorFunction`

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

## Prohibited Properties

Allowed types:

- object `{}`
  - `null` has no properties
- array `[]`
- number `-3`
- bigint `42n`
- string `"xx"`
- boolean `true`
- function `x => x * x`
- `undefined` has no properties

### Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

- [ ] ! `constructor`. The property can create a new function. For example
  ```js
  const f = (() => undefined).constructor('a', 'return a * a')
  ```
- [ ] deprecated `__proto__`
- [ ] ! deprecated `__defineGetter__`. The property can mutate an object.
- [ ] ! deprecated `__defineSetter__`. The property can mutate an object.
- [ ] deprecated `__lookupGetter__`
- [ ] deprecated `__lookupSetter__`

### Array

These properties can mutate an array:

- [ ] ! `copyWithin`.
- [ ] ! `fill`
- [ ] ! `pop`
- [ ] ! `push`
- [ ] ! `reverse`
- [ ] ! `shift`
- [ ] ! `sort`
- [ ] ! `splice`
- [ ] ! `unshift`
