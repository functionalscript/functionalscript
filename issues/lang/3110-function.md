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
const f = {[name]:() => 0}[name]
// alternatives:
const f1 = { some: () => 0 }.some // f1.name === "some"
const f2 = { '#$': () => 0 }['#$'] // f1.name === "#$"
// f2.name === "something" // if the function name is a valid identifier
const f3 = function something() {
    return 0
}
const v = { ok: () => 0, a: 7 } // v.ok.name === "ok" // if the function name matches the property name
const hello = () => 0 // hello.name === "hello" // if the function name is the same as a variable name

const x = (i => i)(() => 0) // when the function name is "".
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