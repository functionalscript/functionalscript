# Built-in Objects and Functions

The built-in objects are special. We can call a function, like `Object.getOwnPropertyDescriptor()`, but not the `Object` or the function.

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

Some of the JS built-in objects and functions are "not allowed" in FS. It means, an FS compiler rejects code that contains "not allowed" objects and functions.

## Global Scope

Global objects can't be assigned to a variable (`const r = Object`). They can only be used as namespaces (`Object.entries()`).

### Value Properties

- [x] `Infinity`
- [x] `NaN`
- [ ] `undefined`
- [ ] `globalThis`

### Function Properties

- [ ] `eval`
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

## Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

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
|`eval()`                 |no         |
|`isFinite()`             |no         |
|`isNaN()`                |no         |
|`parseFloat()`           |no         |
|`parseInt()`             |no         |

|Property    |side-effect|
|------------|-----------|
|`Infinity`  |no         |
|`NaN`       |no         |

## Prohibited Properties

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
