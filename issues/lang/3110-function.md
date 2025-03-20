# Function

Parse a function that has no parameters and returns a constant.

```js
export default () => { return 6 }
```

Depends on [default export](./2110-default-export.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions.

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
[ ] [function-frame](./3111-function-frame.md)