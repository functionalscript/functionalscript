# Get Property

```js
const own_property = a => b => Object.getOwnPropertyDescriptor(obj, property)?.value
// Or
const own_property = a => b => Object.hasOwn(obj, property) ? obj[property] : void 0
```

It's translated into the VM command `own_property`:

```rust
struct OwnProperty {
    obj: Expression
    property: Expression
}
```

## Instance Property

```js
obj.property
obj.['property']
```

It's translated into the VM command `instance_property`:

```rust
struct InstanceProperty {
    obj: Expression
    index: u8
}
```

If the property name is one of the implemented property names, it should be translated into `index: u8`.

If a property name is one of the prohibited property names or one of the method names, then it's a compilation error.

All other property names generate `own_property` commands.

[Object Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_properties),

|name         |side-effect                   |
|-------------|------------------------------|
|`__proto__`  |access to function constructor|
|`constructor`|access to function constructor|

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

[Array Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#instance_properties).

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

[Map Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#instance_properties)

|name  |side-effect|
|------|-----------|
|`size`|no         |

## Instance Method Call

```js
obj.property(parameters)
obj.['property'](parameters)
```

It's translated into VM command `instance_method_call`:

```rust
struct InstanceMethodCall {
    obj: Expression
    property: String16
    parameters: Array<Expression>
}
```

**Note**: All known instance methods can't be used in `instance_property` command! Even if they don't have side effects.

[Object Instance Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_methods)

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

[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#instance_methods)

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
|`lastIndexOf`         |no         |        |
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

|name   |side-effect|notes            |
|-------|-----------|-----------------|
|`apply`|no         |`this` is ignored|
|`bind` |no         |`this` is ignored|
|`call` |no         |`this` is ignored|

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
obj[+index]
```

It's translated into VM command `at`:

```rust
struct InstanceMethodCall {
    obj: Expression
    index: Expression
}
```

```js
import m from './m.f.js'
const a = [2, 3]
export default {
    "a": a[0],
    // we don't know what is the type of `m` so we force it to be a `number` or `bigint`.
    "b": a[+m]
}
```

In `obj[index]`, `index` has to be a `number`. If we don't know what is `index`, `+` requires before `index`. It means the byte code for the expression inside the `[]` should be either the unary `+`, a number literal, or a string literal (excluding some strings). If it references an object, FS gives up. FS may try deeper analyses in the future, and type inference can help a lot.

## Iterators

Direct access to an object with the [`Iterator` protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) is not allowed in FunctionalScript.

```ts
type Value<T> = { done: true } | { done?: false, value: T }
type Iterator<T> = {
    next: () => Value<T>
}
```

However, FunctionalScript allows access to objects with the `Iterable` protocol.

```ts
type Iterable<T> = {
    [Symbol.iterator]: () => Iterator<T>
}
```

For example, JS Array implements the `Iterable` protocol.

If we need to implement support for [generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) in the FunctionalScript, the generator function has to be wrapped into `Iterable` interface. For example,

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
