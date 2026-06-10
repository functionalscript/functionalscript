# Dreams

- UTF8 strings instead of UTF16
- integer number `123` is a `bigint`.
- assigning `undefined` to a property should remove the property
  ```ts
  const x = { a: undefined } // x should be {}
  ```
- pipeline operator
- automatic binding
  ```ts
  const m = [42].at
  m(0) // 42
  ```
- always in lexicographical order
  ```
  const x = { 11: 11, 2: 2, a: 3, b: 5 } // { '11': 11, '2': 2, a: 3, b: 5 }
  const y = { 2: 2, b: 5, a: 3, 11: 11 } // { '11': 11, '2': 2, a: 3, b: 5 }
  ```
