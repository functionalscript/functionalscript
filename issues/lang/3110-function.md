# Function

Parse a function that has no parameters and returns a constant.

```js
export default () => { return 6 }
```

Depends on [default export](./2110-default-export.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions.

Full function definition command:

```js
const name = "Hello!"
// translated into one command which accepts `name` and `bytecode`.
const f = Object.getOwnPropertyDescriptor({[name]: () => undefined}, name).value // f.name === "Hello!"
// alternatives:
const f1 = { some: () => undefined}.some.value // f1.name === "some" // if the function name is known and safe to use as property
const f1 = { '#$': () => undefined}['#$'].value // f1.name === "#$" // if the function name is known
const f1 = { constructor: () => }
const f2 = function something() { return undefined } // f2.name === "something" // if the function name is a valid identifier
const v = { ok: () => undefined } // v.hello.name === "ok" // if the function name matches the property name
const hello = () => undefined // hell.name === "hello" // if the function name is the same as a variable name

const x = (i => i)(() => undefined) // when the function name is "".
```

## Recursive Functions

```js
const a = i => b(i + 3)
const b = i => i % 5 === 0 ? i : a(i)
```

```rust
fn a(frame: Array<Any>, param: Array<Any>) {
  let i = param[0];
  let b = frame[1];
  b(frame, &[i + 3])
}
fn b(frame: Array<Any>, param: Array<Any>) {
  let i = param[0];
  if (i % 5 === 0) {
      i
  } else {
      let a = frame[0];
      a(frame, &[i])
  }
}
```

- [ ] [function-frame](./3111-function-frame.md)