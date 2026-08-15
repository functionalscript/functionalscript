# `fjs lint`: a dependency-free linter over the FunctionalScript tokenizer

**Priority:** P3
**Status:** open

### Problem

[eslint.md](./eslint.md) sets out why the repository needs mechanical
enforcement for rules `tsc` cannot express, and offers two routes: ESLint, or a
check built on FunctionalScript's own tooling. This issue is the design of the
second route.

The case for it: the repository has exactly two devDependencies (`typescript`,
`@types/node`) and no other JavaScript tooling. The three rules that matter most
are **syntactic** — an inline cast, an unknown JSDoc tag, a type predicate — so
none of them needs type information, and none of them needs a parser. A token
stream is enough. FunctionalScript already has one, and pointing it at the
repository's own sources is the kind of dogfooding the project is for.

### What already exists

Almost the whole shape of the command is in place:

| Piece | Where |
| --- | --- |
| Tokenizer | `fjs/js/tokenizer/module.f.mjs` — `tokenize(input)(path)` → `List<JsTokenWithMetadata>` |
| Token/position types | `fjs/js/tokenizer/types.ts` — `CommentToken`, `TokenMetadata { path, line, column }` |
| Command registration | `fjs/module.f.mjs` command table, `Command<O>` in `fjs/cli/types.ts` |
| File discovery | `readdir` in `fjs/effects/node/module.f.mjs` (as `fjs t` uses it) |
| Reporting | the reporter/`Effect` pattern in `fjs/emergent_testing/module.f.mjs` + `fjs/text/sgr` |

Crucially, JSDoc blocks are already distinguishable from ordinary block
comments. The tokenizer emits both as `kind: '/*'`, but a JSDoc block's `value`
retains its leading `*`:

```js
// source: const a = /** @type {Foo} */ (x)
{ token: { kind: '/*', value: '* @type {Foo} ' }, metadata: { path: '', line: 1, column: 28 } }
```

So `kind === '/*' && value.startsWith('*')` identifies a JSDoc comment, with no
parsing at all.

One wrinkle: `metadata` is the position where the token **completes**, not where
it starts — `column: 28` above is the closing `/` of a comment that opens at
column 11. Diagnostics either report end positions or the tokenizer gains a
start position. The latter is the better fix and is useful beyond linting.

### Rule sketches

All three are a scan over the token stream with a one-token lookahead past
trivia (`ws`, `nl`, `//`, `/*`).

- **`no-inline-type-cast`** — a JSDoc comment whose `value` matches
  `@type\s*\{`, whose next non-trivia token is `(`, and whose type is not
  `const`. That last exemption is exactly the AGENTS.md carve-out: `@type {const}`
  must stay an inline cast.
- **`no-unknown-jsdoc-tag`** — any `@word` in a JSDoc block that is not in a
  known tag set. This closes the one place JSDoc-on-`.mjs` is genuinely weaker
  than authored TypeScript: `/** @tpye {string} */` compiles clean today and the
  annotation simply does not exist.
- **`no-type-predicate`** — an `is` in a `@type` / `@returns` type body. Without
  a JSDoc type grammar this is a substring check and will need care around
  `Promise<Is>`-style names; treat it as a follow-up rather than part of the
  first landing.

### Feasibility measurement

A prototype of `no-inline-type-cast` was run over all 260 `.mjs` files under
`fjs/`, using the repository's own tokenizer:

| | |
| --- | --: |
| files tokenized | 260 |
| JSDoc comments seen | 3377 |
| inline `@type` casts found | 353 |
| `@type {const}` casts found | 221 |
| declaration-position `@type` annotations | 1880 |

Against [inline-type-casts.md](./inline-type-casts.md), which enumerated the
same sites independently: **221 of 221** `@type {const}` casts matched exactly,
and 353 of 357 inline casts were found. The rule is implementable and close to
correct as-is.

### Blocker: the tokenizer rejects the syntax this repository is written in

The same run produced **24,166 error tokens across 251 of the 260 files**. Two
constructs account for all of them:

| Construct | Result |
| --- | --- |
| `'single-quoted string'` | error tokens |
| `` `template ${literal}` `` | error tokens |
| `"double-quoted string"` | ok |
| `b?.c`, `b ?? c`, `[...b]`, `{ [k]: 1 }`, `{ a, ...rest }`, arrow bodies | ok |
| `/regex/` | no error, but lexes as two `/` operators — no regex token |

The repository's own sources use single quotes and template literals
throughout, so the tokenizer currently cannot read the code it was written to
describe.

The comment-scanning rules survive this better than expected, because an error
token does not stop the scan — hence 353 of 357. But the misses are real, and
they are not random. With no single-quote support, a `/*` or `//` **inside** a
single-quoted string opens a phantom block comment that swallows everything up
to the next `*/`:

```js
// input
const t = { kind: '/*' }
const u = 1
/** @type {X} */ (v)

// tokens
const | id:t | = | { | id:kind | : | error | /*:"' }\nconst u = 1\n/** @type {X} " | ( | id:v | ) | eof
```

The real cast is consumed as comment text. `fjs/js/tokenizer/module.f.mjs`
itself is affected, since it carries `'/*'` and `'//'` as data — three of the
four missed sites are in that file.

### Proposal

1. **Add single-quoted strings and template literals to
   `fjs/js/tokenizer/`**, with proofs. This is worth doing on its own merits: it
   is the gap between "FunctionalScript's tokenizer" and "the syntax
   FunctionalScript's own sources use", and every downstream tool inherits it.
   Consider adding a token start position at the same time.
2. Add `fjs lint` as a `Command<O>` in `fjs/module.f.mjs`, discovering files with
   `readdir` and reporting through the `emergent_testing`-style reporter, with
   `no-inline-type-cast` as its only rule and an allowlist seeded from
   [inline-type-casts.md](./inline-type-casts.md)'s `keep` bucket.
3. Add `no-unknown-jsdoc-tag`.
4. Wire it into CI next to `npx tsc` and `fjs t`.
5. Revisit `no-type-predicate` once a JSDoc type grammar exists — `fjs/bnf/`
   already has the machinery for one.

### Limits

This route cannot reach type-aware rules. In particular
`@typescript-eslint/no-unnecessary-type-assertion` — which needs the checker,
and which would have found most of the 181 redundant casts in
[inline-type-casts.md](./inline-type-casts.md) automatically — is out of reach
here. That rule is the strongest argument for the ESLint route, and the two
options are not mutually exclusive: `fjs lint` can own the syntactic rules
whether or not ESLint is ever added.

### Related

- [eslint.md](./eslint.md) — the policy choice this issue is one half of.
- [inline-type-casts.md](./inline-type-casts.md) — the rule's first target, and
  the source of the allowlist.
