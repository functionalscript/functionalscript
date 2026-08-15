# A JSDoc subset parser, and `fjs lint` on top of it

**Priority:** P3
**Status:** open

### Problem

[eslint.md](./eslint.md) sets out why the repository needs mechanical
enforcement for rules `tsc` cannot express, and offers two routes: ESLint, or a
check built on FunctionalScript's own tooling. This issue is the design of the
second route.

The tempting shortcut is to scan the token stream and match `@type\s*\{` against
each comment's text. That is a hack, and it should be rejected as one. A JSDoc
block is a **language**: a tag sequence, brace-delimited type expressions in a
subset of TypeScript's type grammar, inline `{@link …}` references, and free
text. Recognizing it with regular expressions is precisely the mistake
FunctionalScript's own tokenizer and `fjs/bnf/` exist to avoid, and it fails at
the first rule that needs to know the *structure* of a type — including
`no-inline-type-cast`, which must exempt `@type {const}` and therefore has to
know that the type body is exactly the identifier `const` and not a type merely
containing that word.

The right shape is a parser: JSDoc is one more layer in the transducer stack
described in [`fjs/bnf/todo/layered-parser.md`](../fjs/bnf/todo/layered-parser.md).

```
bytes ==> code-points ==> JS tokens ==> JSDoc block ==> JSDoc type expression
```

### Design

Two grammars, both expressed as `fjs/bnf` `Rule`s and matched with
`fjs/bnf/descent`, exactly as `jsGrammar()` is today.

**Layer 1 — block structure.** Input is the `value` of a `CommentToken` whose
text begins with `*` (the JS tokenizer already preserves that leading `*`, so
JSDoc blocks are distinguishable from ordinary `/* … */` without any lookahead).
The grammar strips the `*` margin and produces a sequence of tags: a tag name,
an optional brace-delimited type body, an optional parameter name, and free
text. Unknown tag names are a parse result, not a regex miss.

**Layer 2 — the type expression.** The body between the braces, in a defined
subset of TypeScript's type grammar. The subset is not a guess: it is what the
repository actually writes.

### The surface to cover

All JSDoc blocks under `fjs/` (3,772 brace-delimited type bodies), by tag:

| Tag | Count | | Tag | Count |
| --- | --: | --- | --- | --: |
| `@type` | 2484 | | `@module` | 144 |
| `@import` | 584 | | `@example` | 37 |
| `@param` | 265 | | `@property` | 11 |
| `@typedef` | 230 | | `@return` | 6 |
| `@link` | 209 | | `@throws` | 3 |
| `@returns` | 173 | | `@see` | 2 |
| `@template` | 169 | | `@satisfies`, `@deprecated`, `@note`, `@remarks`, `@remark`, `@result` | 1 each |

Type-expression constructs, counted as "type bodies containing this construct"
(approximate — the classifier is itself a regex, which is part of the argument
for doing this properly):

| Construct | Bodies | | Construct | Bodies |
| --- | --: | --- | --- | --: |
| function `(…) => T` | 1318 | | optional `?:` | 35 |
| generic `X<…>` | 1128 | | tuple `[A, B]` | 28 |
| `readonly` | 492 | | rest `...` | 27 |
| array `T[]` | 257 | | conditional `A extends B ? C : D` | 7 |
| `const` (assertion) | 230 | | `infer` | 7 |
| indexed access `T[K]` | 229 | | predicate `x is T` | 4 |
| union `\|` | 195 | | `keyof` | 3 |
| object `{ … }` | 99 | | `import('…').X` | 2 |
| `typeof` | 86 | | intersection `&` | 2 |

The long tail is small but real: conditional types with `infer` appear in
`fjs/types/btree/find/module.f.mjs`, and `import('…')` in the effects proofs. A
subset that stops before them would not cover the tree.

### The rules, once the parser exists

- **`no-inline-type-cast`** — a JSDoc block whose only tag is `@type`, whose
  type is not the `const` assertion, and whose next non-trivia JS token is `(`.
  Target: the 357 sites in [inline-type-casts.md](./inline-type-casts.md),
  minus the 221 `@type {const}` casts that must stay.
- **`no-unknown-jsdoc-tag`** — a tag name outside the known set. Two live
  instances already, both silently ignored by TypeScript today:
  - `fjs/types/list/module.f.mjs:25` — `@result {Result<T>}` on
    `fromArrayLike`, where `@returns` was meant. The declared return type simply
    does not exist as far as the compiler is concerned.
  - `fjs/types/bigint/module.f.mjs:178` — `@remark`, where TSDoc's tag is
    `@remarks`.
  The rule would also flag the six `@return` uses as inconsistent with the 173
  `@returns` — valid JSDoc, but the repository has picked one spelling.
- **`no-type-predicate`** — a `x is T` node in a `@type` / `@returns` type. With
  layer 2 this is an AST test, not a substring search for `is`; there are 4
  such sites.
- **`@import` hygiene** — the 130 unused type imports counted in
  [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) are visible from layer 1
  plus the JS token stream, without `noUnusedLocals`.

### Blocker: the tokenizer rejects the syntax this repository is written in

Before any of this, the JS tokenizer has to be able to read the tree. Run over
all 260 `.mjs` files under `fjs/`, it emits **24,166 error tokens across 251 of
them**. Two constructs account for all of them:

| Construct | Result |
| --- | --- |
| `'single-quoted string'` | error tokens |
| `` `template ${literal}` `` | error tokens |
| `"double-quoted string"` | ok |
| `b?.c`, `b ?? c`, `[...b]`, `{ [k]: 1 }`, `{ a, ...rest }`, arrow bodies | ok |
| `/regex/` | no error, but lexes as two `/` operators — no regex token |

The repository's own sources use single quotes and template literals throughout,
so the tokenizer currently cannot read the code it was written to describe.

This is not cosmetic for the linter. With no single-quote support, a `/*` or
`//` **inside** a single-quoted string opens a phantom block comment that
swallows everything up to the next `*/`:

```js
// input
const t = { kind: '/*' }
const u = 1
/** @type {X} */ (v)

// tokens
const | id:t | = | { | id:kind | : | error | /*:"' }\nconst u = 1\n/** @type {X} " | ( | id:v | ) | eof
```

The real cast is consumed as comment text. `fjs/js/tokenizer/module.f.mjs`
itself is affected, since it carries `'/*'` and `'//'` as data.

A throwaway probe of the hack version — token scan plus regex — found 221 of 221
`@type {const}` casts and 353 of 357 inline casts. The four misses are exactly
the phantom-comment case, three of them in the tokenizer's own module. That
probe is reported here only as evidence that the comment layer is reachable and
that the tokenizer gap is real; it is not the proposed design.

Separately, `TokenMetadata` is the position where a token **completes**, not
where it starts — a comment opening at column 11 reports `column: 28`.
Diagnostics need a start position, which is worth adding to the tokenizer
regardless.

### Proposal

1. **Complete the JS tokenizer**: single-quoted strings, template literals, and
   a token start position, with proofs. Worth doing on its own merits — it is
   the gap between "FunctionalScript's tokenizer" and "the syntax
   FunctionalScript's own sources use", and every downstream tool inherits it.
2. **Layer 1**: a JSDoc block grammar in `fjs/bnf` form, producing a tag
   sequence. This alone supports `no-unknown-jsdoc-tag` and `@import` hygiene.
3. **Layer 2**: the type-expression grammar over the surface tabulated above.
4. **`fjs lint`** as a `Command<O>` in `fjs/module.f.mjs`, discovering files with
   `readdir` and reporting through the `emergent_testing`-style reporter;
   `no-inline-type-cast` first, with an allowlist seeded from
   [inline-type-casts.md](./inline-type-casts.md)'s `keep` bucket.
5. Wire it into CI next to `npx tsc` and `fjs t`.

### Why this is worth more than a linter

A JSDoc type parser is the piece that lets FunctionalScript read its own type
annotations. Today the type layer is entirely TypeScript's: `tsc` is the only
thing in the repository that understands a `@type {…}` body. Layer 2 is a
prerequisite for [types-for-fs.md](./types-for-fs.md), it is what a `.f.js`
migration would need if [the type-annotations
proposal](./blocked/js-extension-type-annotations.md) never lands, and it gives
[ast-spec.md](./ast-spec.md)'s RTTI schemas a source of type information that is
not a second, hand-maintained copy. The lint rules are the smallest useful thing
to build on it first, not the reason to build it.

### Limits

This route cannot reach type-aware rules. In particular
`@typescript-eslint/no-unnecessary-type-assertion` — which needs the checker, and
which would have found most of the 181 redundant casts in
[inline-type-casts.md](./inline-type-casts.md) automatically — is out of reach.
That rule is the strongest argument for the ESLint route, and the two options are
not mutually exclusive.

### Related

- [eslint.md](./eslint.md) — the policy choice this issue is one half of.
- [inline-type-casts.md](./inline-type-casts.md) — the first rule's target and
  the source of its allowlist.
- [`fjs/bnf/todo/layered-parser.md`](../fjs/bnf/todo/layered-parser.md) — the
  transducer-stack architecture this fits into.
- [types-for-fs.md](./types-for-fs.md), [ast-spec.md](./ast-spec.md) — what a
  JSDoc type parser unlocks beyond linting.
