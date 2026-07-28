# DJS, Data JS or DataScript

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## AST

A DJS module parses into [ast/module.f.ts](./ast/module.f.ts):

```ts
type AstModule = [readonly string[], AstBody]
type AstBody = readonly AstConst[]
type AstConst = Primitive | AstModuleRef | AstArray | AstObject
type AstModuleRef = ['aref' | 'cref', number]
```

`AstModule` pairs the imported module specifiers with a body. The body is a
list of constants in declaration order, and the **last** entry is the value
`export default` yields — so the body describes the function

```js
(...args) => { const c0 = ...; return <last> }
```

where `['aref', i]` refers to the `i`-th imported module and `['cref', i]` to
the `i`-th preceding constant. References — not copies — are what let a DJS
module denote a graph rather than a tree: two properties holding the same
`cref` deserialize to the same object. See
[examples/input.f.ts](./examples/input.f.ts).

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
