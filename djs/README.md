# DJS, Data JS or DataScript

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## Next steps

- [ ] rename `fjson` to `djs` (data javascript), File extensions: `.d.mjs`, `.d.js`.
- [x] use JS tokenizer 
- [x] identifiers `{a:5}`
- [x] big int
- [ ] `export default ...`
- [ ] constants
  ```js
  const a = [3]
  export default = { a: a, b: a }
  ```
  Serialization
  ```js
  const _0=[3]
  export default {a:_0,b:_0}
  ```
- [ ] import
  ```js
  import a from 'c.d.cjs'
  exports default { a: a, b: a}
  ```
- [ ] short form
  ```
  const a = 5;
  export default { a }
  ```

Optional, for fun, syntax sugar:

- [ ] comments. Ignore them. Not an error.
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
