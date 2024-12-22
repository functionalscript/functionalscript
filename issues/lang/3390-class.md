# Classes

Classes are [nominal types](https://en.wikipedia.org/wiki/Nominal_type_system). In other words, their definitions are location-based, not content-based. This can cause many problems, such as duplicate incompatible class definitions during serialization and code importing. So, the best way to use classes would be to use CA VM.

Also, classes can be helpful when we have recursive functions.

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
      a(frame, &[I])
  }
}
```
