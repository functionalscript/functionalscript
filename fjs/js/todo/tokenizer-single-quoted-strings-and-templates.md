## The JS tokenizer cannot read the repository's own sources

**Priority:** P3
**Status:** open

### Problem

`fjs/js/tokenizer/module.f.mjs` accepts only double-quoted strings. It has no
rule for `'single-quoted strings'` or `` `template ${literals}` `` — the two
forms FunctionalScript's own sources use throughout.

Run over all 260 `.mjs` files under `fjs/`, the tokenizer emits **24,166 error
tokens across 251 of them**. Those two constructs account for all of them:

| Construct | Result |
| --- | --- |
| `"double-quoted string"` | ok |
| `'single-quoted string'` | error tokens |
| `` `template ${literal}` `` | error tokens |
| `b?.c`, `b ?? c`, `[...b]`, `{ [k]: 1 }`, `{ a, ...rest }`, arrow bodies | ok |
| `/regex/` | no error, but lexes as two `/` operators — no regex token |

The failure is not graceful. Because `'` is not a delimiter, a `/*` or `//`
**inside** a single-quoted string opens a block comment that swallows everything
up to the next `*/`:

```js
// input
const t = { kind: '/*' }
const u = 1
/** @type {X} */ (v)

// tokens
const | id:t | = | { | id:kind | : | error | /*:"' }\nconst u = 1\n/** @type {X} " | ( | id:v | ) | eof
```

The third line is consumed as comment text. `fjs/js/tokenizer/module.f.mjs`
itself is affected, since it carries `'/*'` and `'//'` as data — so the module
that defines these tokens is one of the files that mis-lexes.

Anything reading the tree through the tokenizer inherits this: a `fjs lint`
(see [`todo/eslint.md`](../../../todo/eslint.md)), a `/*: type */` annotation
recognizer (see
[`todo/rtti-type-annotations.md`](../../../todo/rtti-type-annotations.md)), or
the compiler itself once it parses authored `.f.js`.

### Proposal

1. Add a single-quoted string rule, sharing the escape-sequence handling with
   the existing double-quoted one — the state machine already has
   `_ParseStringState` and `_ParseEscapeCharState`; the delimiter is the only
   difference.
2. Add template literals. These are not a string variant: `${…}` nests a full
   expression, so the tokenizer needs a mode stack rather than a flat state.
   Worth its own step, and possibly its own issue.
3. Decide on regex literals. They currently lex as two `/` operators with no
   error, which is silently wrong rather than loudly wrong. FunctionalScript may
   not need them at all — if so, they should be an explicit error rather than a
   misparse.
4. Proofs for each, including the `'/*'`-as-data case above, which is a
   regression test for exactly the desync described here.

### Notes

Diagnostics also want a token **start** position: `TokenMetadata` currently
reports where a token completes, so a comment opening at column 11 reports
`column: 28`. That belongs with
[666-js-tokenizer-position-layer.md](./666-js-tokenizer-position-layer.md),
which is already separating the position concern from the tokenizer core.

### Related

- [666-js-tokenizer-position-layer.md](./666-js-tokenizer-position-layer.md)
- [tokenizer-continue-string-comment.md](./tokenizer-continue-string-comment.md)
- [`fjs/bnf/todo/layered-parser.md`](../../bnf/todo/layered-parser.md)
