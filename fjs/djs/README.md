# DJS, Data JS or DataScript

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## AST

A DJS module parses into [ast/module.f.mjs](./ast/module.f.mjs); the types
in [ast/types.ts](./ast/types.ts) carry the shape and its invariants.

Why a flat list of constants with index references, rather than a value tree:
a DJS module denotes a **graph**, and `import` and `const` are how it names
the shared parts. Deserializing has to preserve that sharing — two properties
holding the same reference must yield the same object, not two equal copies —
so the AST keeps the constants addressable and refers to them by index
instead of inlining them. That is also what makes serialization a real
choice: a value referenced more than once is emitted as a `const` and reused.
See [examples/input.f.mjs](./examples/input.f.mjs).

## Next steps

- [x] use JS tokenizer
- [x] identifiers `{a:5}`
- [x] computed keys `{["a"]:5}`, the only spelling of a `__proto__` key
  ([spec: the `__proto__` key](../../spec/README.md#the-__proto__-key))
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
