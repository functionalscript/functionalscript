## single-quote-and-template-lexing. The token grammar cannot read the repository's own sources

**Priority:** P3
**Status:** open — **blocked by nothing.** This issue used to live beside the
hand-written scanner in `fjs/js/tokenizer` and waited on
[self-contained-tokenizer](../../../../media/json/todo/self-contained-tokenizer.md),
because widening that scanner regressed the public JSON tokenizer built over
it. It moved here when
[parser-serializer-restructure](../../../../../todo/parser-serializer-restructure.md)
stage 7 decided that the scanner goes and the grammar is the token layer:
JSON reads [`ebnf/lib/json`](../../json/module.f.mjs), not this grammar, so
widening this grammar regresses nothing, and the ordering problem that
blocked the old issue is gone with the module it was about.

### Problem

The JS token grammar in [`module.f.mjs`](../module.f.mjs) takes its `string`
rule from JSON: the double quote opens a string and nothing else does, and
there is no template literal. So the two spellings this repository is
actually written in stop the grammar, and with it every reader of it:

```
"const a = 'x'"        => invalid token
"const a = `a${b}c`"   => invalid token
"const a = \"\\x41\""  => invalid token
```

Measured over every `.mjs` under `fjs/` and `spec/` (350 files) through
[`fsc/tokenizer`](../../../../fsc/tokenizer/module.f.mjs)'s `tokenizeJs`, the
grammar's reader: **336 stop at an error token; 14 tokenize cleanly**, and
they are the small ones and the data modules — `effects/list`,
`types/function`, `types/map`, `types/nominal`, `types/range`,
`types/btree/types`, the two `fsc/examples` fixtures and the six DataJS vector
sets. The scanner this issue was first measured on had the same 14 clean out
of 351. The grammar does not accept its own source.

Because the grammar stops at the first refused token, a source view built on
it today would show nothing past the first single quote, and a doc extractor
reading `export const` out of the stream would see a fraction of a module.

### This is a lexing change, not a language change

The two spec issues that cover these spellings are deferred on purpose, and
each has open design questions:
[2460-js-string-literals](../../../../../spec/todo/2460-js-string-literals.md)
(single quotes and the extra escapes) and
[3440-template-literals](../../../../../spec/todo/3440-template-literals.md)
(substitution typing, tagged templates, canonical form). Nothing here asks for
any of those to be settled.

The difference is between *recognising* a spelling and *accepting* it.
Displaying a module needs the tokenizer to find where a string starts and ends
so the text can be coloured. It does not need FunctionalScript to admit the
string as valid, and it does not need a substitution's type decided — a source
view never evaluates anything. That is the division stage 7 states: the token
layer is JavaScript's, and what the language accepts is decided above it, at
the token — the way the compiler's fold already refuses `-NaN` and a number
followed by a word, both of which the grammar reads without complaint.

The scope that follows from that is **the whole of 2460's lexical surface, plus
templates**: single quotes, `\v`, `\0`, `\xHH`, `\u{...}`, literal control
characters, and line continuations, recognised but not accepted. Anything less
cannot satisfy this issue's own success check — see below.

### What the widening reaches, and what it does not

The grammar has three readers, and the widening reaches each differently.

- [`fsc/tokenizer`](../../../../fsc/tokenizer/module.f.mjs), the compiler's.
  A `'x'` it reads as a string is a string the compiler must still refuse, so
  the fold that classifies tokens gains the refusals the grammar loses: a
  string opened by a single quote, a template of any kind, and an escape
  outside JSON's table plus `\u` are errors *there*, at the token, until
  2460 and 3440 accept them. That keeps the accepted language exactly where
  it is, and it is the same place the fold already refuses `-NaN`. The
  compiler's proofs pin it.
- `fjs/js/tokenizer`, once stage 7 rebuilds it over this grammar as the
  general JS stream. It is the consumer this issue exists for: the website's
  [source-and-doc-view](../../../../website/todo/source-and-doc-view.md)
  reads it, and a future `fjs lint` would. It refuses nothing the grammar
  recognises.
- JSON. Not reached at all: [`media/json`](../../../../media/json/module.f.mjs)
  folds [`ebnf/lib/json`](../../json/module.f.mjs), a separate grammar this
  one *imports rules from* and never the reverse, so `'x'` stays
  `unexpected symbol at 0` there whatever this grammar learns. The JSON
  tokenizer's `escapeJsHasAndJsonDoesNot` proof, which the old issue had to
  defend, is untouched because that tokenizer never reads this grammar.

What the widening must not do is grow the JSON rules it imports. `string`,
`escape` and `character` in `ebnf/lib/json` are JSON's and stay JSON's; the JS
string is a rule of this module built beside them, sharing the escape
sub-rules the way 2460 offered — "two grammar rules (`json-string` ⊂
`js-string`) sharing the escape sub-rules" — which is the mechanism the
repository took when it split the two grammars.

### One opaque template token is not enough

[source-and-doc-view](../../../../website/todo/source-and-doc-view.md)
originally scoped the prerequisite as "template literals preserved as one token
without parsing `${}` substitutions, which is all a source view needs". That
understates it. A scan that closes the template at the next backtick closes it
in the wrong place, because substitutions in this repository contain templates
of their own — six of them:

| file | shape |
| --- | --- |
| [`fsc/parser/proof.f.mjs:30`](../../../../fsc/parser/proof.f.mjs#L30) | `` `${`${e},`.repeat(n)}${e}` `` |
| [`fsc/tokenizer/proof.f.mjs:948`](../../../../fsc/tokenizer/proof.f.mjs#L948) | nested in a `map` |
| [`website/page/module.f.mjs:83`](../../../../website/page/module.f.mjs#L83) | nested in a `map` |
| [`media/datajs/parser/proof.f.mjs:302`](../../../../media/datajs/parser/proof.f.mjs#L302) | nested in a conditional |
| [`ci/deno/proof.f.mjs:16`](../../../../ci/deno/proof.f.mjs#L16) | nested two deep |
| [`ci/rust/proof.f.mjs:64`](../../../../ci/rust/proof.f.mjs#L64) | nested in a `map` |

An LL(1) token grammar cannot hold that nesting, and it should not try: this
is the rule the grammar already follows — what one LL(1) layer cannot decide
is split into layers, with a fold between them, rather than hand-written
around. The grammar recognises a template *chunk*: from a backtick or a `}`
to the next backtick or unescaped `${`. The layer above, which resumes the
parser at each token, keeps a nesting depth — `${` pushes, the `}` that
brings the depth back pops and is read as a chunk's start rather than an
operator — and hands ordinary tokens to the grammar in between. The depth
lives in the reader's scan state beside the position, not in the grammar.

#### The token stream, decided here rather than at implementation time

The token kinds are the grammar's, in [`types.ts`](../types.ts), and every
reader shares them, so the shape of the stream is API. Adopt ECMAScript's own
division rather than inventing one — it is already the vocabulary every reader
of this code knows, and it makes the head/middle/tail boundaries explicit:

| source | tokens |
| --- | --- |
| `` `x` `` | `noSubstitutionTemplate "x"` |
| `` `a${b}c` `` | `templateHead "a"`, `id b`, `templateTail "c"` |
| `` `a${b}c${d}e` `` | `templateHead "a"`, `id b`, `templateMiddle "c"`, `id d`, `templateTail "e"` |

Each of the four carries the chunk's text and nothing else; the substitution's
contents are ordinary tokens between them. Only an *unescaped* `${` opens a
substitution — `` `\${x}` `` is a single `noSubstitutionTemplate` — which is the
escape rule below doing the work, not a special case here. Note what this buys
beyond naming: `}` is not reused. A `templateMiddle` or `templateTail` *begins*
at the `}` that closes a substitution, so the block-closing `}` token keeps its
one meaning, and the nesting depth is what decides which of the two a given `}`
is.

This brings the `${}` *delimiters* into the token layer while leaving a
substitution's contents to ordinary tokens. It still decides nothing that
[3440](../../../../../spec/todo/3440-template-literals.md) defers: the
compiler stays free to refuse the whole form, and does, at its fold.

### Quotes and templates alone do not reach zero

Adding the quote and the template still leaves real modules failing, because
the repository uses the rest of the JS escape surface too. The `escape` rule
is JSON's table plus `\u`, and nothing else. The clearest case is
[`git/testlib.f.mjs:121-128`](../../../../git/testlib.f.mjs#L121-L128), which
is ordinary data, not a test of escapes:

```js
'40000 .cargo\0'+'\x51\x79\x05\x04\x01\x4d\xe6\x0f\x79\x54...'
```

Every `\0` and every `\xNN` there stops the grammar today. By literal search
across `.mjs` sources, `\x` appears in 17 files, `\0` in 19, `\v` in 8, and
`\u{` in 5.

These are the same spellings
[2460](../../../../../spec/todo/2460-js-string-literals.md) enumerates, and
they are purely lexical — a rule of this grammar, no language question. So
they are in scope here rather than deferred with the language feature. Leaving
them out would mean shipping a prerequisite whose own acceptance check cannot
pass, and naming the remainder in the final scan would be a way of not noticing
that.

Do not answer this with a longer list, though. The list keeps acquiring rows —
first `\'`, then the backtick, then `\$` for the escaped substitution opener
in [`media/nix/module.f.mjs:224`](../../../../media/nix/module.f.mjs#L224) —
because JavaScript does not have a list. Its rule is **the listed escapes,
otherwise the character itself**: `\q` is `q`, `\$` is `$`. JSON's `escape`
rule does the opposite and refuses, which is right for JSON and is why the JS
string is a rule of its own here rather than JSON's with more rows. Stating
the JS rule once retires every enumeration above, and the tasks do that.

The decode side has the same split. `simpleEscapes` in
[`js/string_escape`](../../../../js/string_escape/module.f.mjs) is shared with
[`media/json/serializer`](../../../../media/json/serializer/module.f.mjs)'s
encoder, so an apostrophe row there would make the JSON serializer emit `\'`
and produce invalid JSON. The JS rule's decoder — the listed escapes, else the
character — belongs in a layer above that table, which stays JSON's.

### Regular expressions, measured and left out

`/x/` reads today as `/`, `id x`, `/`: two divisions. Whether a `/` opens a
regular expression or is an operator is decided by the token before it, which
is exactly the layer-above question the number boundary already answers, so
recognising it is the same shape of work as the template depth. It is not in
this issue's scope, because the repository's own sources barely use it — two
`.f.mjs` modules, `effects/node` and `text/sgr`, one regex each — and a
highlighter that reads those two as divisions colours two lines wrong, where
a missing single quote colours 336 files wrong. Record it here so the
measurement is not redone; take it when a consumer needs it.

### Tokens do reproduce their source, by position

The scanner this issue was written against emitted *cooked* strings and
collapsed every run of whitespace to one valueless token, so its stream could
not reconstruct the text it came from, and the old issue spent a section on
slicing the source by end positions to get it back. The grammar route does not
have the problem: [`fsc/tokenizer`](../../../../fsc/tokenizer/module.f.mjs)
already reads a token's text as "the input between where it began and where
it ended", and carries both positions. A view built on that stream can show
the source exactly, indentation and raw escapes included, without a second
pass over the text. The rebuilt `fjs/js/tokenizer` keeps that property; a
proof should pin it on the largest module, since it is what the source view
rests on.

### Tasks

- [ ] A JS `string` rule in this grammar beside the JSON one it shares escape
      sub-rules with: opened and closed by the same one of `"` and `'`, the
      other quote content inside it.
- [ ] One escape rule for that string, **the listed escapes, otherwise the
      character itself**, plus line continuation — ECMAScript's rule, which
      covers `\'`, `` \` ``, `\$` and every case nobody has thought of, where a
      list would keep acquiring rows. The listed escapes grow by `\v`, `\0`,
      `\xHH` and `\u{...}`. JSON's `escape` rule in `ebnf/lib/json` does not
      change.
- [ ] Fixtures for that rule, all currently failing:
      [`git/testlib.f.mjs:232`](../../../../git/testlib.f.mjs#L232)
      (`'Merge tag \'vt\''`),
      [`git/testlib.f.mjs:121-128`](../../../../git/testlib.f.mjs#L121-L128)
      (`\0` and `\xNN` in ordinary data),
      [`media/datajs/vectors/matrix/proof.f.mjs:350-351`](../../../../media/datajs/vectors/matrix/proof.f.mjs#L350-L351)
      (escaped backticks in a template), and
      [`media/nix/module.f.mjs:224`](../../../../media/nix/module.f.mjs#L224),
      which is `` `\${${reference}}` `` — an escaped substitution opener and a
      real substitution on one line, so it pins the two against each other.
- [ ] A template chunk rule, and the nesting depth in the reader's scan
      state above the grammar: an *unescaped* `${` returns to ordinary
      tokens, the matching `}` resumes a chunk. Emit the four ECMAScript
      token kinds above — `noSubstitutionTemplate`, `templateHead`,
      `templateMiddle`, `templateTail` — in `types.ts`, so the shared stream
      is the one this issue names rather than one invented at implementation
      time. Proofs for the six shapes above.
- [ ] **Do not add rows to `simpleEscapes`** for any of it; the JS decoder is
      a layer above the shared table.
- [ ] The compiler keeps refusing what it refused: `fsc/tokenizer`'s fold
      turns a single-quoted string, any template kind and a non-JSON escape
      into the error token the grammar used to produce, with proofs, until
      2460 and 3440 accept them. The accepted language does not move in this
      PR.
- [ ] Pin with a proof that a token's text is the source between its
      positions, for every token kind including trivia, on the largest
      module in the tree.
- [ ] Re-run the tree scan; the 336 failing modules should reach zero, or the
      remainder should be named and explained.

### Related

- [source-and-doc-view](../../../../website/todo/source-and-doc-view.md) — the
  consumer this unblocks; its first task is this issue.
- [parser-serializer-restructure](../../../../../todo/parser-serializer-restructure.md)
  stage 7 — the decision this issue rests on: the token layer is shared with
  JavaScript and grows here, the parser stays the subset, and the scanner
  goes.
- [2460-js-string-literals](../../../../../spec/todo/2460-js-string-literals.md) —
  the same spellings, as a language feature. Its lexical surface is what this
  issue recognises; its question, whether FunctionalScript *accepts* those
  spellings, stays deferred and untouched.
- [3440-template-literals](../../../../../spec/todo/3440-template-literals.md) —
  substitution typing, tagged templates and canonical form, none of which this
  issue settles.
- [eslint](../../../../../todo/eslint.md) — names this same gap as its reason
  for deferring `fjs lint`; a linter cannot read sources the tokenizer rejects.
- [self-contained-tokenizer](../../../../media/json/todo/self-contained-tokenizer.md)
  — the JSON tokenizer's rebuild, which this issue used to wait on and no
  longer does; the two touch only through the JSON rules this grammar imports.
