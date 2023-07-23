# FJSON, FJS Object Notation

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## Next steps

- [x] identifiers
- [ ] `module.exports = ...` 
- [ ] comments
- [ ] constants `const a = [3];module.exports = { a: a, b: a }`
- [ ] import `const a = require('c.fon.js');module.exports = { a: a, b: a}`
