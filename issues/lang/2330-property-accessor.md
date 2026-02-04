# Property Accessor

In this note we consider whether or not to support JS's property accessors, maybe also
considering partial support. A very important aspect is - whether or not accessing
a given property (in this or that way) might enable side effects - if implemented in
100% JS-compliant way, such a property caused violations of FS's design principles.
So the most straightforward way to deal with such a property in FS could be a compilation
error. In other cases we might decide to provide a limited property access.
Finally, some JS standard properties / methods are 100% FS-legit and so will be implemented
in full.

It's important to be able to access instance's own property regardless object properties
available in JS via object's prototype chain. In FS we plan to not have prototype chains
at runtime. Here go snippets showing how to access own properties in JS - that code might
be useful to support in FS as well. Note that this is more verbose than obj.field syntax
discussed below in "Instance Property" section, but protects against unwanted access to
the prototype chain.

In case a property has no side effects (see 'no' in 'side effects' columns in tables below)
FS should implement that property 100%. If a property mentioned at several places has
at least one side effect, we should prohibit it consistently across the board.

One important detail regarding run-time access to instance properties, methods is
`obj[<expression>]` syntax when <expression> can evaluate to a string. On one hand,
in JS that syntax enables possibilities to abuse; on another hand, it's a regular
syntax for array indexing, legit in FS. Our current approach is to force FS users to
add '+' in front of <expression> in cases when <expression> type is not known at
compile time.

```js
const own_property = object => property => Object.getOwnPropertyDescriptor(obj, property)?.value
// Or
const own_property = object => property => Object.hasOwn(obj, property) ? obj[property] : undefined
```

It's translated into the VM command `own_property`:

```rust
struct OwnProperty {
    obj: Expression
    property: Expression
}
```

## Instance Property

Instance property access is similar to instance method access but there are differences considered
below, in "Instant Method Call" subsection.

```js
obj.property
obj['property']
```

It's translated into the VM command `instance_property`:

```rust
struct InstanceProperty {
    obj: Expression
    index: <VM's type for strings known at compile time>
}
```

If the property name is one of the implemented property names, it should be translated into `index`. We
consider that case separately from more general `own_property`, since "built-in" property access might
deserve special (performance-optimized) treatment in bytecode interpreter (consider a command / data access
within a command that is similar to array indexing).

If a property name is one of the prohibited property names or one of the method names, then it's a compilation error.

All other property names generate `own_property` commands.

[Object Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#instance_properties): `__proto__` and `consructor`

The current decision is to prohibit both.

|name         |side-effect                   |
|-------------|------------------------------|
|`__proto__`  |access to function constructor|
|`constructor`|access to function constructor|

Examples of how to abuse (in JS) so FS should strictly prohibit (compile-time and, most likely, run-time as well):

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
for the sake of supporting JS legacy in cases when that is FS-safe.

[Map Instance Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#instance_properties)

|name  |side-effect|
|------|-----------|
|`size`|no         |

## Instance Method Call

Instance method call is different from property access in JS because of `this` considerations.

For example:
```js
const a = ["bison"]
a.indexOf("bison") // returns 0
const p = a.indexOf
p("bison") // run-time exception in JS, so FS should throw an exception here as well
```
In the snippet above a.indexOf("bison") compiles into one VM call ("an instance method call"),
however the remainder of that snippet compiles in a sequence of commands that finally yields
an exception in this sample.

```js
obj.property(parameters)
obj['property'](parameters) // where 'property' is a property name well-known at compile time
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

As stated above, all rows that have other than 'no' in side-effect column should be prohibited
(both at compile time when possible and run-time when the property name got calculated at run time).

TODO: file a separate .md regarding custom `toString`, `valueOf` implementations, and maybe other methods listed here as well.

[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#instance_methods)

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
obj[+index]
```

It's translated into VM command `at`:

```rust
struct At {
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

In `obj[index]`, `index` has to be a `number`. If we don't know what is `index`, `+` requires before `index`. It means the byte
code for the expression inside the `[]` should be either the unary `+`, a number literal, or a string literal (excluding some strings).
If it references an object, FS gives up. FS may try deeper analyses in the future, and type inference can help a lot.

## Iterators

Direct access to an object with the [`Iterator` protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)
is not allowed in FS.

```ts
type Value<T> = { done: true } | { done?: false, value: T }
type Iterator<T> = {
    next: () => Value<T>
}
```

However, FS allows access to objects with the `Iterable` protocol.

```ts
type Iterable<T> = {
    [Symbol.iterator]: () => Iterator<T>
}
```

For example, JS Array implements the `Iterable` protocol.

If we need to implement support for [generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) in the FS,
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
