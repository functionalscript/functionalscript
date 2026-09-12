## single-quote-and-template-lexing. The tokenizer cannot read the repository's own sources

**Priority:** P3
**Status:** open
**Blocked by:**
[self-contained-tokenizer](../../../media/json/todo/self-contained-tokenizer.md)
— until `media/json/tokenizer` stops reading this module, widening it regresses
a public JSON tokenizer. See below for the fallback if that wait is too long.

### Problem

`fjs/js/tokenizer/module.f.mjs` opens a string on the double quote and nothing
else (`:348`). There is no single-quote state and no template state, so the two
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

Measured over every `.mjs` in the tree (351 files): **337 produce at least one
error token, 46,463 error tokens in total.** Fourteen tokenize cleanly, and
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

The scope that follows from that is **the whole of 2460's lexical surface, plus
templates**: single quotes, `\v`, `\0`, `\xHH`, `\u{...}`, literal control
characters, and line continuations, recognised but not accepted. Anything less
cannot satisfy this issue's own success check — see below.

### What the widening reaches, and what it does not

Adding a `string` token for `'x'` cannot make `'x'` valid JSON.
[`media/json`](../../../media/json/module.f.mjs)'s `parse` folds the
[`ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs) grammar and never touches
this module:

```
'"x"'  => ok "x"
"'x'"  => error 'unexpected symbol at 0'
```

The one place it does reach is
[`media/json/tokenizer`](../../../media/json/tokenizer/module.f.mjs), an adapter
over this module's `tokenize` whose `mapToken` forwards a `string` token without
inspecting how it was spelled:

```js
// media/json/tokenizer/module.f.mjs:83-86, in mapToken
case 'string':
case 'number':
case 'eof':
case 'error': return [input]
```

Its refusal of `'x'` today is this module erroring, nothing more:

```
'"x"'  => string "x", eof
"'x'"  => error 'unexpected character', error 'invalid token', error, eof
```

The same goes for escapes, and there it is pinned by name. Once `\xHH` is
recognised, `"\x41"` becomes an ordinary `string` token opened by a double
quote — indistinguishable by delimiter from `"A"` — while
[`media/json/tokenizer/proof.f.mjs`](../../../media/json/tokenizer/proof.f.mjs)
requires `"\x"` to stay an error and names the case
`escapeJsHasAndJsonDoesNot`. So no property of the *token* saves the adapter:
what JSON needs to know is which sub-language the literal stayed within, and
the widening is exactly what destroys that.

#### Which is an ordering problem, not a design problem

Do not add a sub-language flag to the token to rescue this.
[2460](../../../../spec/todo/2460-js-string-literals.md) offered two mechanisms
— "two grammar rules (`json-string` ⊂ `js-string`) sharing the escape
sub-rules, or by recording which sub-language each matched token stayed
within" — and the repository has already taken the first: JSON and JS have
separate grammars,
[`ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs) and
[`ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs). A flag would reintroduce
the abandoned mechanism to defend a module that is scheduled to stop existing.

[self-contained-tokenizer](../../../media/json/todo/self-contained-tokenizer.md)
holds that schedule: the remaining stage is the public `tokenize`, to be either
rebuilt over the grammar's lexical rules or retired outright. **Either outcome
ends the dependency** — and the rebuild is not speculative, because
`ebnf/lib/json` already exports the rules it needs (`string`, `number`,
`escape`, `character`, `hex`, `digit`, `ws`), and
[`fsc/tokenizer`](../../../fsc/tokenizer/module.f.mjs) is the working precedent
for reading a `token` rule that way.

So this issue waits for that one. Once the adapter no longer reads this module,
this module has **no consumers at all**, and the widening costs nothing
downstream. If the website work cannot wait that long, the fallback is a mode on
`tokenize` — strict versus JS — which leaves every existing proof untouched at
the price of a language selector inside a public function. Widening without one
of the two is a silent regression of a public tokenizer, which
[`DESIGN.md` §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids.

That adapter is now the **only** consumer of this module in the tree.
[`fsc/tokenizer`](../../../fsc/tokenizer/module.f.mjs) imports nothing from
here: it reads the [`ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs) grammar,
and so, increasingly, does this module — `mergeTrivia` is imported from there
(`module.f.mjs:26`), not defined here.

The dependency therefore runs the other way from what the split suggests. The
two tokenizers do not depend on each other; both depend on `ebnf/lib/js`, which
is where a string rule added here would eventually have to agree with the
grammar's own. Keeping them from drifting is a real cost of this change, and
the last task below is where it is owed.

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
| [`fsc/tokenizer/proof.f.mjs:944`](../../../fsc/tokenizer/proof.f.mjs#L944) | nested in a `map` |
| [`website/page/module.f.mjs:83`](../../../website/page/module.f.mjs#L83) | nested in a `map` |
| [`media/datajs/parser/proof.f.mjs:302`](../../../media/datajs/parser/proof.f.mjs#L302) | nested in a conditional |
| [`ci/deno/proof.f.mjs:16`](../../../ci/deno/proof.f.mjs#L16) | nested two deep |
| [`ci/rust/proof.f.mjs:64`](../../../ci/rust/proof.f.mjs#L64) | nested in a `map` |

So the template state has to hand control back to ordinary lexing at `${` and
resume the template at the matching `}` — a nesting depth threaded through the
tokenizer state, not a flag. That is the real size of this task, and it is why
it belongs in its own PR rather than as a checkbox inside the website issue.

#### The token stream, decided here rather than at implementation time

`tokenize` is public and this task also changes the public `StringToken`, so
the shape of the stream is API. Adopt ECMAScript's own division rather than
inventing one — it is already the vocabulary every reader of this code knows,
and it makes the head/middle/tail boundaries explicit:

| source | tokens |
| --- | --- |
| `` `x` `` | `noSubstitutionTemplate "x"` |
| `` `a${b}c` `` | `templateHead "a"`, `id b`, `templateTail "c"` |
| `` `a${b}c${d}e` `` | `templateHead "a"`, `id b`, `templateMiddle "c"`, `id d`, `templateTail "e"` |

Each of the four carries the chunk's text and nothing else; the substitution's
contents are ordinary tokens between them. Only an *unescaped* `${` opens a
substitution — `` `\${x}` `` is a single `noSubstitutionTemplate` — which is the
escape rule below doing the work, not a special case here. Note what this buys beyond naming:
`}` is not reused. A `templateMiddle` or `templateTail` *begins* at the `}` that
closes a substitution, so the block-closing `}` token keeps its one meaning, and
the nesting depth is what decides which of the two a given `}` is.

This brings the `${}` *delimiters* into the lexer while leaving a
substitution's contents to ordinary tokens. It still decides nothing that
[3440](../../../../spec/todo/3440-template-literals.md) defers: the parser
stays free to refuse the whole form.

### Quotes and templates alone do not reach zero

Adding the two string states and the delimiter escape still leaves real
modules failing, because the repository uses the rest of the JS escape surface
too. `parseEscapeCharStateOp` recognises the JSON table plus `\u`, and nothing
else. The clearest case is
[`git/testlib.f.mjs:121-128`](../../../git/testlib.f.mjs#L121-L128), which is
ordinary data, not a test of escapes:

```js
'40000 .cargo\0'+'\x51\x79\x05\x04\x01\x4d\xe6\x0f\x79\x54...'
```

Every `\0` and every `\xNN` there is an `unescaped character` error today. By
literal search across `.mjs` sources, `\x` appears in 17 files, `\0` in 19,
`\v` in 8, and `\u{` in 5.

These are the same spellings
[2460](../../../../spec/todo/2460-js-string-literals.md) enumerates, and they
are purely lexical — a decoder change, no grammar and no language question. So
they are in scope here rather than deferred with the language feature. Leaving
them out would mean shipping a prerequisite whose own acceptance check cannot
pass, and naming the remainder in the final scan would be a way of not noticing
that.

Do not answer this with a longer list, though. The list keeps acquiring rows —
first `\'`, then the backtick, then `\$` for the escaped substitution opener
in [`media/nix/module.f.mjs:224`](../../../media/nix/module.f.mjs#L224) — because
JavaScript does not have a list. Its rule is **the listed escapes, otherwise
the character itself**: `\q` is `q`, `\$` is `$`. Today the tokenizer does the
opposite and errors, which is JSON's rule sitting inside a JS lexer. Stating
the rule once retires every enumeration above, and the tasks do that.

The `simpleEscapes` warning applies throughout: the shared table stays JSON's,
and the JS rule belongs in a layer above it.

### Tokens do not reproduce their source

A second thing an implementer will hit. `StringToken` carries the *cooked*
value — `"a\tb"` tokenizes to a token holding a real tab — so the token stream
cannot reconstruct the text it came from, and a highlighter that re-serialises
tokens would rewrite the reader's source.

Carrying the raw lexeme on the token — the way `number` already does ("a
`number` token carries the exact source text and no derived numeric value",
`module.f.mjs:6-9`) — does **not** on its own fix this, because whitespace is
lost the same way and raw lexemes on strings would not reach it. A whole run of
whitespace collapses to one valueless `ws` or `nl` token, so two different
sources give one identical stream:

```
"a  b"  => id a, ws, id b, eof
"a\tb"  => id a, ws, id b, eof
```

A view rebuilt from tokens would therefore rewrite the reader's indentation
however faithfully the strings were kept.

The way out that does work is to slice the original text by position, because
the stream is contiguous — trivia is emitted, not skipped. But the boundaries
are not where they look. **`metadata` is a token's end, not its start.** On
`ab cd`:

```
id "ab"  line 1 col 3     // "ab" occupies columns 1-2
ws       line 1 col 4     // the space is column 3
id "cd"  line 1 col 6     // "cd" occupies columns 4-5
eof      line 1 col 6
```

Each token is reported one past its last character, because a token is emitted
when the character *after* it is processed. So a token's text runs from the
**previous** token's reported position to its own, with the first starting at
line 1, column 1 — not from its own position to the next one's, which would
drop the first character of every token. The repository's own metadata proof
shows the same thing from the other side: the opening `[` of `[\ntrue, false\n]`
is reported at column 2.

That is undocumented and easy to get backwards, so the source view is not the
place to discover it: a proof should pin the slicing rule where the position
layer lives.
[666-js-tokenizer-position-layer](../../todo/666-js-tokenizer-position-layer.md)
owns that metadata, though it changes only the dispatch split, not these
semantics.

Raw lexemes stay an option for a consumer that wants token-local rendering and
does not care about reproducing the file, but they are not the answer for a
source view. Decide before the source view is written, not after.

### Tasks

- [ ] `_ParseStringState` carries its opening delimiter, so `'` closes only a
      `'` string and a `"` inside one is content. Same for the reverse.
- [ ] **First**, confirm
      [`media/json/tokenizer`](../../../media/json/tokenizer/module.f.mjs) no
      longer reads this module — see the blocker above. Nothing below may land
      while it does, unless the `tokenize` mode fallback is taken instead.
- [ ] One escape rule, replacing the enumeration this issue used to carry:
      **the listed escapes, otherwise the character itself**, plus line
      continuation. That is ECMAScript's rule, and it covers `\'`, `` \` ``,
      `\$`, and every case nobody has thought of, where a list would keep
      acquiring rows. Today the opposite holds — `"a\qb"` is an `unescaped
      character` error — because JSON's rule is living inside a JS lexer.
      The listed escapes grow by `\v`, `\0`, `\xHH` and `\u{...}`.
- [ ] Fixtures for that rule, all currently failing:
      [`git/testlib.f.mjs:232`](../../../git/testlib.f.mjs#L232)
      (`'Merge tag \'vt\''`),
      [`git/testlib.f.mjs:121-128`](../../../git/testlib.f.mjs#L121-L128)
      (`\0` and `\xNN` in ordinary data),
      [`media/datajs/vectors/matrix/proof.f.mjs:295`](../../../media/datajs/vectors/matrix/proof.f.mjs#L295)
      (escaped backticks in a template), and
      [`media/nix/module.f.mjs:224`](../../../media/nix/module.f.mjs#L224),
      which is `` `\${${reference}}` `` — an escaped substitution opener and a
      real substitution on one line, so it pins the two against each other.
- [ ] **Do not add rows to `simpleEscapes`** for any of it: that table is
      shared with [`fsc/tokenizer`](../../../fsc/tokenizer/module.f.mjs)'s
      decoder and with
      [`media/json/serializer`](../../../media/json/serializer/module.f.mjs)'s
      encode side, so an apostrophe row would make the JSON serializer emit
      `\'` and produce invalid JSON. The JS rule belongs in a layer above the
      shared table, which stays JSON's.
- [ ] A template state with a nesting depth: an *unescaped* `${` returns to
      ordinary lexing, the matching `}` resumes the template. Emit the four ECMAScript token
      kinds above — `noSubstitutionTemplate`, `templateHead`, `templateMiddle`,
      `templateTail` — so the public stream is the one this issue names rather
      than one invented at implementation time. Proofs for the six shapes
      above.
- [ ] Pin the slicing rule with a proof — previous token's position to this
      token's, first from line 1 column 1 — since `metadata` being an end
      position is undocumented and easy to invert.
- [ ] Reconcile with [`ebnf/lib/js`](../../../ebnf/lib/js/module.f.mjs), which
      this module already imports from and which `fsc/tokenizer` reads: do the
      same rules belong in the grammar, or is it deliberately narrower? Record
      the answer either way, so the two do not drift silently.
- [ ] Re-run the tree scan; the 337 failing modules should reach zero, or the
      remainder should be named and explained.

### Related

- [source-and-doc-view](../../../website/todo/source-and-doc-view.md) — the
  consumer this unblocks; its first task is this issue.
- [2460-js-string-literals](../../../../spec/todo/2460-js-string-literals.md) —
  the same spellings, as a language feature. Its lexical surface is what this
  issue recognises; its question, whether FunctionalScript *accepts* those
  spellings, stays deferred and untouched.
- [3440-template-literals](../../../../spec/todo/3440-template-literals.md) —
  substitution typing, tagged templates and canonical form, none of which this
  issue settles.
- [eslint](../../../../todo/eslint.md) — names this same gap as its reason for
  deferring `fjs lint`; a linter cannot read sources the tokenizer rejects.
- [self-contained-tokenizer](../../../media/json/todo/self-contained-tokenizer.md)
  — owns the JSON adapter that is this change's only downstream exposure, and
  may retire it.
- [666-js-tokenizer-position-layer](../../todo/666-js-tokenizer-position-layer.md)
  — owns the position metadata the slice-by-position option would use.
- [tokenizer-trivia-state](./tokenizer-trivia-state.md),
  [tokenizer-continue-string-comment](../../todo/tokenizer-continue-string-comment.md)
  — same file, internal cleanups, independent of this.
