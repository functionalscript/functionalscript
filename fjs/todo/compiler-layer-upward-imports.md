## Lower layers import from `fjs/compiler`

**Priority:** P3
**Status:** open

### Problem

[compiler-vocabulary-and-modularization](./compiler-vocabulary-and-modularization.md)
places the shared vocabulary in `fjs/js/ast` and `fjs/edag` and the compiler
above them. Several shared pieces still live in `fjs/compiler`, so the lower
layers import upward. At `c162c3a`:

- [`compiler/serializer/names`](../compiler/serializer/names/module.f.mjs):
  `_name`, `_binding`, `_resolve` and `_arg` are imported by
  `js/ast/serializer`, `js/ast/serializer/intrinsic` and `rust/serializer`.
  Its `_parameters` and `_rest` are used by its proof alone, and
  `_parameters` is the only reason the module imports `edag/analysis`.
- [`compiler/serializer/function_text`](../compiler/serializer/function_text/module.f.mjs)
  re-exports `_entryText` and the other helper texts from
  `js/ast/serializer/intrinsic`; `rust/serializer` imports them through it,
  so the path runs rust → compiler → js. Its `renderFunction` is used by its
  proof alone and is the last line of `compiler/serializer`'s `functionText`.
- [`compiler/parser`](../compiler/parser/module.f.mjs)'s `_prohibitedAccess`
  is a membership test over [`fjs/js/prototype`](../js/prototype/module.f.js)'s
  `prototypeNames` and `prohibitedCalls`, inside the parser, consumed by
  `edag/to_fast/source`. Its JSDoc still says "Exported for the writer in
  ../serializer".
- `edag/value/convert` imports `functionText` from `compiler/serializer`, and
  `edag/value/to_unknown` imports `factoryStringify` from
  `compiler/serializer/value`.

### Proposal

Each piece to the layer that owns its vocabulary, per the module map:
`prohibitedAccess` to `fjs/js/prototype` as real API, imported by the parser
and by `to_fast/source`; `names` under `fjs/js/ast/serializer` (or
`fjs/text/marked`, whose README describes the idiom), with the dead
`_parameters`/`_rest` deleted and the `edag/analysis` import with them;
`rust/serializer` importing the helper texts from `js/ast/serializer/intrinsic`
directly, and `function_text` deleted or reduced to an alias of
`functionText`. The two `edag/value` edges need a decision about where a
graph function's text is owned, which the epic should record.

### Tasks

- [ ] `prohibitedAccess` to `js/prototype`; JSDoc corrected.
- [ ] `names` moved; dead exports gone.
- [ ] `function_text` removed; `rust/serializer` imports directly.
- [ ] Decide the owner of `functionText` and `factoryStringify` for
      `edag/value`; record it in the epic's module map.

### Related

- [compiler-vocabulary-and-modularization](./compiler-vocabulary-and-modularization.md)
  — the module map; this is its import edges.
- [group-fjs-subdirectories-by-concern](./group-fjs-subdirectories-by-concern.md)
  — the directory layout the edges would follow.
