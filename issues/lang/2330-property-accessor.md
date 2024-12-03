# Get Property

```js
const own_property = a => b => Object.getOwnPropertyDescriptor(a, b)?.value
// Or
const own_property = a => b => Object.hasOwn(a, b) ? a[b] : void 0
```

It's translated into the VM command `own_property`:

```rust
struct OwnProperty {
    a: Expression
    b: Expression
}
```

## Instance Property

```js
a.b
a.['b']
```

It's a translated into the VM command `instance_property`:

```rust
struct InstanceProperty {
    a: Expression
    b: String16
}
```

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
|`length`     |no         |         |
|`name`       |no         |error    |
|`prototype`  |no         |undefined|

## Instance Method Call

```js
a.b(c)
a.['b'](c)
```

It's translated into VM command `instance_method_call`:

```rust
struct InstanceMethodCall {
    a: Expression
    b: String16
    c: Array<Expression>
}
```

**Note**: All known instance methods can't be used in `instance_property` command! Even if they don't have side-effects.

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

## At

```js
a[42]
a[+i]
```

It's translated into VM command `at`:

```rust
struct InstanceMethodCall {
    a: Expression
    i: Expression
}
```

```js
import m from './m.f.mjs'
const a = [2, 3]
export default {
    "a": a[0],
    // we don't know what is the type of `m` so we force it to be a `number` or `bigint`.
    "b": a[+m]
}
```

In `a[i]`, `i` has to be a `number`, If we don't know what is `i`, `+` requires before `i`. It means that the byte code for the expression inside the `[]` should be either the unary `+`, a number literal, or a string literal (excluding some strings). If it references an object, FS gives up. In the future, FS may try deeper analyses and type inference can help a lot.
