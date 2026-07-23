# DJS, Data JS or DataScript

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## Next steps

- [x] use JS tokenizer
- [x] identifiers `{a:5}`
- [x] big int
- [x] `export default ...`
- [x] constants
  ```js
  const a = [3]
  export default = { a: a, b: a }
  ```
  Serialization
  ```js
  const _0=[3]
  export default {a:_0,b:_0}
  ```
- [x] import
  ```js
  import a from 'c.f.js'
  export default { a: a, b: a}
  ```
- [ ] short form
  ```js
  const a = 5;
  export default { a }
  ```

Optional, for fun, syntax sugar:

- [x] comments. Ignore them. Not an error.
- [ ] double/single quote strings

## Decidable Language

- [ ] using operator and functions
  ```js
  const a = 2+2+Math.abs(5)
  export default { a: a }
  ```
- [ ] decidable functions?
  ```js
  const f = a => b => a + b
  export default f(1)(2)
  ```
