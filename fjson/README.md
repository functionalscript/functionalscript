# FJSON, FJS Object Notation

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## Next steps

- [ ] rename FJSON to `djs` (data javascript). File extensions: `.d.cjs`, `.d.mjs`, `.d.js`.
- [x] use JS tokenizer 
- [x] identifiers `{a:5}`
- [x] big int
- [ ] `module.exports = ...`
- [ ] constants `const a = [3];module.exports = { a: a, b: a }`. Serialization `const _0=[3];module.exports={a:_0,b:_0}`
- [ ] import `const a = require('c.fon.js');module.exports = { a: a, b: a}`

Optional, for fun, syntax sugar:

- [ ] comments. Ignore them. Not an error.
- [ ] double/single quote strings

## Decidable Language
  
- [ ] using operator and functions `const a = 2+2+Math.abs(5); module.exports = { a: a };`
- [ ] decidable functions `const f = a => b => a + b; module.exports = f(1)(2)`?
