# Property Accessor

- `.`
- `?.`

FunctionalScript is a strict subset of JavaScript and should behave the same way as JavaScript or reject JS code during compilation as non-valid FS code. However, every object in JavaScript has inherited properties, such as [`constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/constructor) and [`__proto__`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto). These properties can cause side effects. For example:

```js
const f = (() => {}).constructor
const g = f(`console.log('hello')`)
g() // we received direct access to I/O
```

According to FunctionScript principles, an FS compiler should reject such code during compilation. So, the compiler will prohibit the use of `construct` and `__proto__` after `.` and `?.`.

If an object has its own properties with such names (e.g. `constructor`) then we can access it using the [Object.getOwnPropertyDescriptor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor) function instead. The function doesn't return inherited properties.

```js
const f = (() => {}).constructor
const g = Object.getOwnPropertyDescriptor(f, 'constructor') // g === undefined

const myObject = { constructor: 42 }
const c = Object.getOwnPropertyDescriptor(myObject, 'constructor').value // c === 42
```

Here's the reason why we prohibit `__proto__`:

```js
const p = (() => {}).__proto__
const f = Object.getOwnPropertyDescriptor(p, 'constructor').value
const g = f(`console.log('hello')`)
g() // side-effect
```

## Example

```js
const a = { x: 3}
export default a.x
```

Depends on [const](./2120-const.md), [default-import](./2130-default-import.md) and [undefined](./2310-undefined.md).

See <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors>.
