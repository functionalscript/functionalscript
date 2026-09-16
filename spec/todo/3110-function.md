# Function

Parse a function that has no parameters and returns a constant.

```js
export default () => { return 6 }
```

Depends on [export default](../README.md#exporting-a-value).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions.

A function carries no name. Its EDAG is `['=>', frame, body]`, name-erased,
so `{ some: () => 0 }.some`, `const hello = () => 0` and `export default
() => 0` compile to the same node whatever JavaScript would name them, and
no program observes the difference: `f.name` is refused at the key of `.`,
and `entry(f, 'name')` is `undefined`, since `name` is not an enumerable
own property
([`fjs/edag/todo/entry.md`](../../fjs/edag/todo/entry.md)).

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
