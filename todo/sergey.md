# Current Priority Tasks

- Browser Test
- NiX:
  - [ ] Generate lock files. Limitation: no Windows support.
  - [ ] Add another shell script: `nix develop ./nix`
- FunctionalScript
  - [ ] AST to EDAG
- DataJS
  - [X] Investigate BNF
  - [ ] Rule Transformers in the flow style
    - [ ] `Map<Rule, Transformer>` instead of `StringMap`.
    - [ ] Different Transformers:
      ```ts
      type TerminalTransformer<T> = (v: Meta<number>) => Meta<T>
      type SequenceTransformer<C extends readonly unknown[], S, T> = (v: Meta<C>) => Meta<T>
      type VariantTransformer<C extends { readonly [k in string]: unknown }, T> =
          <K extends keyof C>(k: K, v: Meta<C[K]>) => Meta<T>
      type RepeatTransformer<C, S, T> = {
          readonly inti: S
          readonly update: (state: S, c: Meta<C>) => S
          readonly end: (state: S) => Meta<T>
      }
      ```
    - [ ] RTTI support:
      ```ts

      ```
- Website Module Browsing
  - [ ]

----------------
