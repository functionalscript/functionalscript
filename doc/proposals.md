# ECMAScripts Proposals

ECMAScript proposals that may affect FunctionalScript

- Type Annotations: https://github.com/tc39/proposal-type-annotations
  ```js
  const add = (a: bigint) => (b: bigint) => a + b
  ```
- Deeply Immutable Record and Tuples: https://github.com/tc39/proposal-record-tuple
  ```js
  const r = #{ x: 4, y: "s" }
  const t = #[5, "hello"] 
  ```
  Because these types are deeply immutable and the equality operator '===' works as deep equality, it's a good candidate for content-addressable type system.
- Pipeline operator https://github.com/tc39/proposal-pipeline-operator
  ```js
  const double = a => a + a
  const munis1 = a => a - 1
  const f = a => a |> double(%) |> minus1(%) 
  ```
  I, Sergey, still prefer F# pipeline operator and strongly believe that it's possible to have both syntax in the language.
