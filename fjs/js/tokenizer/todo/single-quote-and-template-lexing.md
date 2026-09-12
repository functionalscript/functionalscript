## single-quote-and-template-lexing. The tokenizer cannot read the repository's own sources

**Priority:** P3
**Status:** open

### Problem

`fjs/js/tokenizer/module.f.mjs` opens a string on the double quote and nothing
else (`:349`). There is no single-quote state and no template state, so the two
spellings this repository is actually written in do not tokenize:

```
"const a = 'x'"    => const, id a, =, error 'unexpected character', id x, error, eof
"const a = `x`"    => const, id a, =, error 'unexpected character', id x, error, eof
```

Template substitutions are worse than an error, because they are not flagged at
all. `$` is an identifier character, so the delimiters vanish into the
surrounding tokens:

```
"const a = `a${b}c`" => const, id a, =, error, id "a$", {, id b, }, id c, error, eof
```

`a$` is an identifier and `{ b }` is a block. A source view would highlight
string content as code, and a doc extractor reading `export const` out of the
token stream would find declarations that were never written.

Measured over every `.mjs` in the tree (350 files): **336 produce at least one
error token, 46,243 error tokens in total.** Fourteen tokenize cleanly, and
they are the small ones — `types/nominal`, `types/function`, `types/map`,
`types/range`, `effects/list`, `types/btree/types`, plus the `fsc` and DataJS
example fixtures. The tokenizer does not accept its own source.

### This is a lexing change, not a language change

The two spec issues that cover these spellings are deferred on purpose, and
each has open design questions:
[2460-js-string-literals](../../../../spec/todo/2460-js-string-literals.md)
(single quotes and the extra escapes) and
[3440-template-literals](../../../../spec/todo/3440-template-literals.md)
(substitution typing, tagged templates, canonical form). Nothing here asks for
any of those to be settled.

The difference is between *recognising* a spelling and *accepting* it.
Displaying a module needs the tokenizer to find where a string starts and ends
so the text can be coloured. It does not need FunctionalScript to admit the
string as valid, and it does not need a substitution's type decided — a source
view never evaluates anything.

### The widening leaks into JSON unless it is stopped deliberately

This is the constraint that makes the change non-trivial, and it is not
hypothetical. [`media/json/tokenizer`](../../../media/json/tokenizer/module.f.mjs)
is built directly on this module's `tokenize`, and its `mapToken` forwards a
`string` token unconditionally:

```js
// media/json/tokenizer/module.f.mjs:83-86, in mapToken
case 'string':
case 'number':
case 'eof':
case 'error': return [input]
```

Nothing there inspects how the literal was spelled. JSON's refusal of `'x'`
rests entirely on this tokenizer raising `unexpected character`, which is
observable today:

```
'"x"'  => string "x", eof
"'x'"  => error 'unexpected character', error 'invalid token', error, eof
```

So the moment a single-quoted literal becomes a `string` token, `'x'` parses as
valid JSON. [`DESIGN.md` §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
is the rule that forbids it, and the same file already reasons carefully about
not inventing string values it refused.

[2460](../../../../spec/todo/2460-js-string-literals.md) names the mechanism:
record which sub-language a literal stayed within. A `StringToken` carrying its
delimiter lets `mapToken` keep rejecting everything but the double quote, and
the field is what any later JSON/DJS/FS distinction would need anyway.

[`fsc/tokenizer`](../../../fsc/tokenizer/module.f.mjs) is *not* exposed the same
way — it reads the [`ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) grammar
and imports only `isKeywordToken` and `mergeTrivia` from here — but the grammar
is then the second place a string rule lives, and the two should not drift.

### One opaque template token is not enough

[source-and-doc-view](../../../website/todo/source-and-doc-view.md) originally
scoped the prerequisite as "template literals preserved as one token without
parsing `${}` substitutions, which is all a source view needs". That
understates it. A scan that closes the template at the next backtick closes it
in the wrong place, because substitutions in this repository contain templates
of their own — six of them:

| file | shape |
| --- | --- |
| [`fsc/parser/proof.f.mjs:29`](../../../fsc/parser/proof.f.mjs#L29) | `` `${`${e},`.repeat(n)}${e}` `` |
| [`fsc/tokenizer/proof.f.mjs:933`](../../../fsc/tokenizer/proof.f.mjs#L933) | nested in a `map` |
| [`website/page/module.f.mjs:83`](../../../website/page/module.f.mjs#L83) | nested in a `map` |
| [`media/datajs/parser/proof.f.mjs:302`](../../../media/datajs/parser/proof.f.mjs#L302) | nested in a conditional |
| [`ci/deno/proof.f.mjs:16`](../../../ci/deno/proof.f.mjs#L16) | nested two deep |
| [`ci/rust/proof.f.mjs:64`](../../../ci/rust/proof.f.mjs#L64) | nested in a `map` |

So the template state has to hand control back to ordinary lexing at `${` and
resume the template at the matching `}` — a nesting depth threaded through the
tokenizer state, not a flag. That is the real size of this task, and it is why
it belongs in its own PR rather than as a checkbox inside the website issue.

This brings the `${}` *delimiters* into the lexer while leaving a
substitution's contents to ordinary tokens. It still decides nothing that
[3440](../../../../spec/todo/3440-template-literals.md) defers: the parser
stays free to refuse the whole form.

### Tokens do not reproduce their source

A second thing an implementer will hit. `StringToken` carries the *cooked*
value — `"a\tb"` tokenizes to a token holding a real tab — so the token stream
cannot reconstruct the text it came from, and a highlighter that re-serialises
tokens would rewrite the reader's source.

Two ways out: carry the raw lexeme on the token, the way `number` already does
("a `number` token carries the exact source text and no derived numeric value",
`module.f.mjs:6-9`), or have the view slice the original text using the
line/column metadata `tokenize` already attaches. The number precedent argues
for the first. Decide before the source view is written, not after.

### Tasks

- [ ] `_ParseStringState` carries its opening delimiter, so `'` closes only a
      `'` string and a `"` inside one is content. Same for the reverse.
- [ ] `StringToken` records the delimiter, and
      [`media/json/tokenizer`](../../../media/json/tokenizer/module.f.mjs)
      checks it in `mapToken`. A proof pins that `'x'` and `` `x` `` stay
      invalid JSON — the regression this change would otherwise cause.
- [ ] A template state with a nesting depth: `${` returns to ordinary lexing,
      the matching `}` resumes the template. Proofs for the six shapes above.
- [ ] Decide raw-lexeme-on-token vs slice-by-position, and record which.
- [ ] Check whether [`ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) needs the
      same rules, or is deliberately narrower.
- [ ] Re-run the tree scan; the 336 failing modules should reach zero, or the
      remainder should be named and explained.

### Related

- [source-and-doc-view](../../../website/todo/source-and-doc-view.md) — the
  consumer this unblocks; its first task is this issue.
- [2460-js-string-literals](../../../../spec/todo/2460-js-string-literals.md),
  [3440-template-literals](../../../../spec/todo/3440-template-literals.md) —
  the language-level questions, deliberately untouched here.
- [eslint](../../../../todo/eslint.md) — names this same gap as its reason for
  deferring `fjs lint`; a linter cannot read sources the tokenizer rejects.
- [666-js-tokenizer-position-layer](../../todo/666-js-tokenizer-position-layer.md)
  — owns the position metadata the slice-by-position option would use.
- [tokenizer-trivia-state](./tokenizer-trivia-state.md),
  [tokenizer-continue-string-comment](../../todo/tokenizer-continue-string-comment.md)
  — same file, internal cleanups, independent of this.
