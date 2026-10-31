## The writer's precedence ladder reads `eagerLayers`

**Priority:** P3
**Status:** open

### Problem

[`fjs/compiler/ast`](../../../compiler/ast/module.f.js)'s `eagerLayers` is
documented as "the one statement of their precedence — the grammar builds its
ladder from it and the writer the parentheses it needs". The grammar does.
The writer does not: `precedence` in
[`serializer/module.f.mjs`](../serializer/module.f.mjs) has its own ladder,

```js
if (op === '|') { return 5 }
if (op === '^') { return 6 }
if (op === '&') { return 7 }
if (op === '===' || op === '!==') { return 8 }
if (op === '<' || op === '<=' || op === '>' || op === '>=' || op === 'instanceof') { return 9 }
if (op === '<<' || op === '>>' || op === '>>>') { return 10 }
if ((op === '+' || op === '-') && value.length === 3) { return 11 }
if (op === '*' || op === '/' || op === '%') { return 12 }
```

whose numbers are `12 - i` for the operator's layer index `i` in
`eagerLayers`. The prefix set is written twice in the same file: as a
`14` branch of `precedence` and as an `includes` list in `operatorText`. An
operator added or moved in `eagerLayers` today changes what the grammar
parses and not what the writer parenthesizes.

### Proposal

Derive the binary levels: the layer index of `op` in `eagerLayers`, offset
to the writer's scale, with only the non-layer cases — `**`, the prefixes,
`?:`, function, leaf — as explicit leaves. Take the prefix set from
`prefixLayer` in [`compiler/ast`](../../../compiler/ast/module.f.js), which
the grammar and the syntax reader already build from, plus `+`, a prefix
the writer prints and `UnaryTag` lacks. `fjs/js/ast/types.ts` already imports `BinaryTag` from `compiler/ast`,
so no new edge appears; whether the table itself belongs in `fjs/js/ast` is
[compiler-layer-upward-imports](../../../todo/compiler-layer-upward-imports.md)'s
question.

### Tasks

- [ ] `precedence` over `eagerLayers`; the serializer's proof unchanged.
- [ ] One prefix set in the file.

### Related

- [`compiler/ast`](../../../compiler/ast/module.f.js)'s `prefixLayer` — the
  prefix table.
- [compiler-vocabulary-and-modularization](../../../todo/compiler-vocabulary-and-modularization.md)
  — "the FAST serializers own syntactic structure and precedence".
