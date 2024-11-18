# ECMAScripts Proposals

ECMAScript proposals that may affect FunctionalScript

- Type Annotations: https://github.com/tc39/proposal-type-annotations
  ```js
  const add = (a:bigint) => (b: bigint) => a + b
  ```
- Deeply Immutable Record and Tuples: https://github.com/tc39/proposal-record-tuple
  ```js
  const r = #{ x: 4, y: "s" }
  const t = #[5, "hello"] 
  ```
