# Current Priority Tasks

- Browser Test
- NiX:
  - [ ] Generate lock files. Limitation: no Windows support.
  - [ ] Add another shell script: `nix develop ./nix`
  - [ ] Add OCI image shell script build and run with docker.
  - [ ] Delete `Dockerfile`
- FunctionalScript
  - [ ] AST to EDAG
- DataJS
  - [X] Investigate BNF
  - [ ] LL1 parser should support `Meta` propagation.
  - [ ] Rule Transformers in the flow style
    - [ ] `Map<Rule, Transformer>` instead of `StringMap`.
    - [ ] Different Transformers:
      ```ts
      type Meta<T, M> = readonly[T, M]
      type Branch<C> = { readonly [K in keyof C]: readonly[K, C[K]] }[keyof C]

      type TerminalTransformer<M, T> = (v: Meta<L, M>) => Meta<T, M>
      type SequenceTransformer<M, C extends readonly unknown[], T> = (v: Meta<C, M>) => Meta<T, M>
      type VariantTransformer<M, C, T> = (v: Meta<Branch<C>, M>) => Meta<T, M>
      type RepeatTransformer<M, C, S, T> = {
          readonly init: S
          readonly update: (state: S, c: Meta<C, M>) => S
          readonly end: (state: S) => Meta<T, M>
      }
      ```
    - [ ] RTTI support:
      ```ts
      import type { Type } from '../rtti/types.ts'

      type Meta<T, M> = readonly[T, M]

      type Branch<C> = { readonly [K in keyof C]: readonly[K, C[K]] }[keyof C]

      type TerminalTransformer<M, O extends Type> = {
          readonly output: O,
          readonly map: (v: Meta<number, M>) => Meta<Ts<O>, M>,
      }

      type SequenceTransformer<M, I extends readonly Type[], S, O extends Type> = {
          readonly input: I
          readonly output: O
          readonly map: (v: Meta<C, M>) => Meta<Ts<O>, M>
      }

      type VariantTransformer<M, I extends Type, O extends Type> = {
          readonly input: I
          readonly output: O
          readonly map: (v: Meta<Branch<Ts<I>>, M>) => Meta<Ts<O>, M>
      }

      type RepeatTransformer<M, I extends Type, S, O extends Type> = {
          readonly input: I
          readonly output: O
          readonly map: {
              readonly init: S
              readonly update: (state: S, c: Meta<Ts<I>, M>) => S
              readonly end: (state: S) => Meta<Ts<T>, M>
          }
      }
      ```
- Website Module Browsing
  - [ ]

----------------

```js
A = 'x'
B = ['x', B] | []

B = 'x'*
```
