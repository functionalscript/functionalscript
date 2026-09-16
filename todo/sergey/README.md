# Current Priority Tasks

> Keep this directory in the repository. It's personal notes. Don't review the file.

- [ ] Browser Test
- [ ] FunctionalScript
  - [ ] AST to EDAG
- [ ] EBNF
  - [x] LL1 parser should support `Meta` propagation: the metadata channel
        of `fjs/ebnf/ast`.
  - [ ] Check the `repeat` rule:
        [repeat-bounds](../../fjs/ebnf/todo/repeat-bounds.md).
  - [ ] Rule Transformers in the flow style (SHA2 and the rewrite set).
  - [ ] Map creation helpers.
  - [ ] A build-time check of a rewrite set's alphabets — what `checkMap`
        was for; `tsc` checks a mapping typed from its rule, and the rest is
        [mapping-precheck](../../fjs/ebnf/ll1/todo/mapping-precheck.md).
  - [x] Parser that applies map rules: the rewrite set `fjs/ebnf/ll1` folds.
  - [x] LL1 parser preparation should fail on non-LL1 grammar.
  - [x] `Ast<R extends Rule>`, the AST result type for a `Rule`:
        `fjs/ebnf/ast`.
  - [ ] Workflow: create EBNF rules and their rewrite set, then create a
        parser from a root rule. The parser is a `StateFold` over one input
        symbol at a time, RTTI-free. Design and open questions:
        [43. Stateful parser](../../fjs/ebnf/todo/043-stateful-parser.md).
  - [x] A special repeat0+ rule: `repeatFrom0`.
- [ ] Website Module Browsing
  - [ ] Demo pages.
- [ ] Investigate using Git Commits instead of Evo
- [X] Replace CHANGELOG with a generated from a Website.
  - [ ] Proposal: Create changelog during release.
- [ ] Reformulate "grab and implement" task. It should focus on priorities.
- [ ] convention for generated files, for example `gen_`
- [ ] we may try to use `BoundedArray<2, 4, T>` instead of `OptionTailArray<2, 4, T>` in EDAG and RTTI for `[t, t, option(t), option(t)]`
- [ ] NiX and Rust eDSL should follow the same conventions as RTTI, new EBNF, HTML and EDAG. Use plain objects to define normal objects.
- [ ] Specify what is `unknown` in FJS. The set is smaller than in JS.
  ```js
  type Primitive = boolean | null | number | string | undefined | bigint
  type Object = StringMap<Value>
  type Array = readonly Value[]
  // DataJS
  type Value = Primitive|Object|Array
  // FJS. v1
  type Value = Primitive|Object|Array|Function
  // FJS. v2 (+object identification)
  type Value = Primitive|Object|Array|Function|Map|Set
  // FJS. v3 (+generators)
  type Value = Primitive|Object|Array|Function|Map|Set|Iterable
  ```
  Map and Set
  ```js
  // declaration
  new Map(...)
  new Set(...)
  // detection
  value instanceof Map
  value instanceof Set
  ```
  Generators:
  ```js
  // declaration. operation `{*[Symbol.iterator]() { ${exp} }}
  {*[Symbol.iterator](){ ... }}
  // detection. operation `typeof ${exp}?.[Symbol.iterator]`
  typeof value?.[Symbol.iterator] === 'function'
  ```
- [ ] If a standard property or property method is not implemented, it should be banned in the property accessor. For example, `obj.hasOwnProperty(prop)`.
- [ ] One NiX.
- [ ] Module references:
  - `a/module.f.js`
    ```js
    import { x } from './b/module.f.js'
    ```
  - `a/b/module.f.js`
    ```js
    import { y } from './c/module.js'
    export const x = y * 2
    ```
  - `a/b/c/module.f.js`
    ```js
    export const y = 3
    ```
- [ ] Document about DAG
- [X] EDAG: Object.is
- [X] EDAG implicit function frame can't be done because the exp may contain wrong `arg`, `self` and `frame`.
- [ ] Remove `Result<>` from `nanvm` and replace it with panic. The idea is that engines can span processes if needed and control memory and time of the process outside. It can work on a normal OS and also in WebAssembly, see Worker.
- [ ] DISOT in Git. It looks like we have more and more features that we would like to have in the DISOT. For example:
  - `.disot/`
    - `name.json` - a name of the object, it can be just a JSON string.
    - `lock.json` - mapping. We also need to investigate submodules.
    - `tts.json` - a set of trusted time stamp for previous commits.
- [ ] Git Submodules vs Subtree
  - store:
    - submodule:
      - `.gitmodule` file contains a path and repository URL, not pinned commit ID.
      - `gitlink` has a specific commit ID
    - subtree: use the files directly but `git subtree` provides a workflow for importing upstream changes and exporting your changes back.
  - workflow
- [ ] FJS serializer
- [ ] Website - visited links look terrible.
