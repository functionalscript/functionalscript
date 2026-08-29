## self-contained-tokenizer. JSON's tokenizer is a wrapper over the JS tokenizer

**Priority:** P2
**Status:** open

### Problem

`fjs/media/json/tokenizer/module.f.mjs` does not scan JSON. It calls
`tokenize` from [`fjs/js/tokenizer`](../../../js/tokenizer/module.f.mjs) — the
747-line JavaScript tokenizer — and post-processes the result: `mapToken`
passes the JSON-shaped token kinds through, drops `ws`/`nl`, turns every other
JavaScript token into `invalid token`, and a two-state scan re-attaches a
leading `-` to the following number lexeme.

JSON is frozen by its own specification; `fjs/js/tokenizer` must grow with
FunctionalScript. A frozen format sitting downstream of a deliberately
evolving lexer is the first of the two structural problems in
[parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md),
and this module is where it is load-bearing: every future JavaScript token —
a new operator, a new numeric literal form, a new escape — reaches JSON's
tokenizer as an input its `default` arm has to classify.

The dependency is not paying for itself. JSON's lexical grammar is small
enough to scan directly, and the shared code is not shared behavior: the two
languages agree on structural characters and disagree on nearly everything
else, so what arrives is a JavaScript token that has to be re-judged against
JSON's rules anyway.

### The accepted language is already JSON's

This is the constraint that makes the swap safe, and it was measured rather
than assumed. Every non-JSON lexeme probed through the public `tokenize` is
already rejected:

| input | today |
| --- | --- |
| `"\v"`, `"\0"`, `"\'"` | rejected — JS's simple escapes do not leak in |
| `'a'` | rejected — single-quoted strings |
| `"\u{41}"` | rejected — code-point escapes |
| `.5`, `+1`, `Infinity` | rejected |
| `// c`, `/* c */` | rejected |
| `"a<TAB>b"`, `"a<LF>b"` | rejected — unescaped control characters |
| U+00A0 outside a string | `unexpected character` |
| `00`, `0.`, `0e`, `0e-`, `0n` | rejected |

So the swap changes **no accepted input**, and every accepted-input proof in
`proof.f.mjs` must survive it byte for byte.

The regression bar is actually stronger than that, and stating it precisely
matters because `tokenize` is public API rather than an internal step of
`parse`: **no input changes between producing an error token and not producing
one.** Inputs that error today still error, inputs that do not still do not,
and only the *shape* of the errors changes. "The parser rejects it either way"
is not a defence, because a direct consumer of the tokenizer sees the tokens,
not the rejection.

What is not JSON's is the **shape of the errors**, which is inherited from the
JavaScript token stream that produced them.

### One error shape is wrong; the rest are merely noisy

Rewriting error shapes is cheap to wave through as churn, so the one that is a
defect should be named as such. Three inputs share it, and each emits a
**value token for text that was never in the input**:

```text
"\x"        → error 'unescaped character', string "x"
"\uEeFg"    → error 'invalid hex value',   string "g"
"a<TAB>b"   → error 'unescaped control character in string', string "ab"
```

A caller that filters errors out — or a parser that resynchronizes on the next
value — sees a string `"x"` that no document contained. That is
[DESIGN.md §10](../../../../DESIGN.md#10-refuse-what-you-cannot-handle): an
unsupported input is refused, never answered with a plausible wrong value. The
malformed literal has to be one error token and nothing else.

The rest are artifacts rather than defects, and they are noisy:

```text
-00         → error 'invalid token', error 'invalid number'
-0.         → error 'invalid token', error 'invalid number'
-12.        → error 'invalid token', error 'invalid number'
12.         → error 'invalid number'
```

The same malformed number reports once or twice depending only on whether it
carried a sign. `--` reports **once** where `---` reports twice, because the JS
tokenizer merges `--` into a decrement operator before JSON ever sees it — a
JavaScript fact with no JSON meaning.

### Proposal

Replace the wrapper with a scanner of JSON's own lexical grammar, in the same
shape as the JS tokenizer it replaces: a `StateScan` over code points followed
by a single `null` end-of-input sentinel, folded with `stateScan` and `flat`.
No `fjs/bnf` dependency — the format's grammars are spec text plus
proof-covered examples, never a runtime dependency of the codecs.

The public signature does not change:

```ts
export const tokenize: (input: List<number>) => List<JsonToken>
```

`JsonToken` does not change either, so `fjs/media/json/parser`'s behavior is
untouched. What does change is where its parts are declared:
`fjs/media/json/tokenizer/types.ts` currently builds `JsonToken` out of
`StringToken`, `NumberToken`, `ErrorToken` and `EofToken` imported from
`js/tokenizer/types.ts`; those become JSON's own declarations, and
`_ScanInput`/`_ScanState` are replaced by the new state type.

There is a second edge to repoint, easy to miss because it does not go through
the tokenizer at all: `fjs/media/json/parser/types.ts` imports `NumberToken`
**directly** from `../../../js/tokenizer/types.ts`. After this change JSON's
parser takes it from `../tokenizer/types.ts` like everything else, and
`fjs/media/json` holds no reference to `fjs/js/tokenizer` in either direction.

`fjs/djs/*` keeps a `js/tokenizer` dependency, but a much smaller one than it
looks: `fjs/djs/tokenizer/module.f.mjs:51` imports exactly `isKeywordToken` and
`mergeTrivia`, plus token *types*, and drives its own BNF tokenizer
`tokenizeJs` at line 544. It never consumes the JavaScript token stream.

That makes this stage's reach larger than "one module stops importing another".
`tokenize` — the public entry point of `fjs/js/tokenizer`, and the 747-line
state machine behind it — has exactly two runtime importers today, and JSON is
the only one that calls `tokenize`. **After this stage it has none.** What is
still live is two helper functions and a set of token types.

Stage 7 is where that gets acted on, and the plan's wording for it —
retire `fjs/js/tokenizer` "when its last consumer is gone" — resolves to
something more concrete than it reads: the machine is already consumerless at
the end of stage 3, so stage 7 is a move of `isKeywordToken`, `mergeTrivia` and
the token types to wherever `fjs/fsc` wants them, and a delete of the rest. Not
this stage's work, but this stage is what makes it true.

The grammar being scanned, which is [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)'s:

```text
ws     ::= (' ' | '\t' | '\n' | '\r')*
token  ::= '{' | '}' | '[' | ']' | ':' | ',' | 'true' | 'false' | 'null'
         | string | number
string ::= '"' char* '"'
char   ::= <any code point except '"', '\', and U+0000–U+001F>
         | '\' ('"' | '\' | '/' | 'b' | 'f' | 'n' | 'r' | 't' | 'u' hex hex hex hex)
number ::= '-'? int frac? exp?
int    ::= '0' | [1-9] [0-9]*
frac   ::= '.' [0-9]+
exp    ::= ('e' | 'E') ('+' | '-')? [0-9]+
```

Character constants come from
[`fjs/text/ascii`](../../../text/ascii/module.f.mjs), as they do today at one
remove, and the simple escapes keep coming from
[`fjs/js/string_escape`](../../../js/string_escape/module.f.mjs). That module
is not JavaScript's escape table — it is deliberately the eight escapes
JavaScript and JSON share, excluding `\0`, `\v`, `\xXX` and line
continuations, and it exists so that the serializer and both tokenizers cannot
drift apart. Today JSON reads it at one remove through `fjs/js/tokenizer`;
after this change it imports the table directly, which is a shorter path to
the same single source of truth. It is frozen by the JavaScript specification
rather than growing with the language, so it is not the dependency this stage
is removing — stage 7 keeps it for the same reason.

### The error rule, stated once

Five rules replace the inherited behavior:

1. **One error token per invalid lexeme.** A lexeme that cannot be completed
   produces exactly one `{ kind: 'error' }` and no value token — never a
   partial string or number built from the surviving characters.
2. **A number ends at a terminator, and a malformed one runs to the next
   terminator.** Scan JSON's number grammar; when the grammar can no longer
   continue, look at the next character.

   - An **accepting terminator** — whitespace, one of `{}[]:,`, a `-`, or end
     of input — ends the lexeme and is re-dispatched rather than swallowed. The
     number is a `number` token if the grammar stopped in an accepting state
     and one `invalid number` if it did not. So `12.]` stays `error, ]`.
   - A **`"` ends the lexeme without accepting it**: the number is one
     `invalid number` and the quote is re-dispatched, so the string that
     follows still scans. It is the single character in this position, and it
     earns the special case: consuming it would swallow an entire well-formed
     string token, which loses far more than an error shape. `12"a"` is
     therefore `invalid number` then the string `"a"`, exactly as today.
   - **Anything else** means the lexeme is malformed: consume through to the
     next terminator and emit exactly one `invalid number`. The junk inside is
     not re-scanned into further errors.

   A character the grammar can still consume is consumed, so the terminator
   test never fires mid-lexeme: the `-` in `1e-5` is an exponent sign, because
   after `e` the grammar wants one.

   Requiring a terminator is why `0abc` reports `invalid number` rather than
   the number `0` followed by a stray word. RFC 8259 does not demand it — `0`
   is a complete `number` and the *parser* would reject what follows — but in a
   valid document a number is always terminated, so requiring it rejects
   nothing valid and says something far more useful about input that is wrong.
   The `"` case is the same judgement applied consistently: a number abutting a
   string is as malformed as a number abutting a word, and it would be hard to
   defend rejecting `0abc` while accepting `12"a"`.

   `-` has to be in the terminator set, and the proofs are what say so:
   `tokenize('10-0')` asserts the two number tokens `10` and `-0`. Without `-`
   as a terminator the whole input would scan as one `invalid number`, breaking
   an accepted-input proof — the very bar this design sets for itself.

3. **A malformed string runs to its next *unescaped* quote, which it
   consumes.** The general terminator rule cannot apply inside a string
   literal, where the only structure is the quote: re-dispatching the closing
   `"` of `"\x"` would start a *second* string that then hits end of input,
   giving two errors where one was promised. Recovery therefore ends at the
   closing `"`, consuming it, or at end of input for an unterminated literal.

   **Recovery keeps interpreting backslashes** — it is scanning for the end of
   the literal, not for the next quote character. In `"\x\""` the quote after
   the bad `\x` is the second half of a `\"` escape and only the final quote
   closes the literal; stopping at the first would report one error and then
   start an unterminated string at the last quote, which is the two-error shape
   this rule exists to prevent.

   Getting the boundary right matters beyond the error count, because it
   decides where the rest of the input resumes. Today `"ok\x\"tail" 1` already
   ends the literal at the final unescaped quote and goes on to tokenize the
   `1` — it just also emits a fabricated string `okx"tail` on the way. The new
   rule keeps that boundary and drops the fabricated token.
4. **A word is a maximal run of `[A-Za-z0-9_$]`**, and it is a keyword only if
   the whole run is exactly `true`, `false` or `null`. Otherwise it is one
   `invalid token`. A character outside that set ends the word and is
   re-dispatched.

   Maximal matching rather than prefix matching is the whole content of this
   rule, and it is what today's tokenizer already does — measured, not assumed:
   `truefalse`, `true0`, `true_`, `true$`, `nullx` and `tru3` each give one
   `invalid token`, while `true]`, `true,` and `true true` give the keyword and
   then the next token. A prefix matcher would emit `true` followed by
   something for every input in the first group, which fits the grammar just as
   well and would silently change the public token stream. `_x` and `$x` are
   `invalid token` too, so `_` and `$` start a word rather than being
   unexpected characters.

   The rule meshes with rule 2 in both directions: `-` is not a word character,
   so `null-1` is `null` then the number `-1`; and a digit starts a number
   rather than a word, so `0abc` is one `invalid number` and `tru3` is one
   `invalid token`.

5. **The message names the lexeme that failed** — `invalid number`,
   `invalid string`, `invalid token` for a word run that is not `true`,
   `false` or `null`, and `unexpected character` for a code point that can
   start no JSON token at all (`ÿ` after `true` is one, since it is outside the
   word-character set).

Rule 2 is what makes the count stop depending on JavaScript. Today the same
malformed number reports once or twice according to whether it carried a sign,
and `--` reports once where `---` reports twice — the first pair being a JS
decrement operator rather than anything JSON can see. Under one rule the count
follows the input instead:

| input | today | proposed |
| --- | --- | --- |
| `"\x"` | error, string `"x"` | one `invalid string` |
| `"\uEeFg"` | error, string `"g"` | one `invalid string` |
| `"a<TAB>b"` | error, string `"ab"` | one `invalid string` |
| `-00` | error, error | one `invalid number` |
| `-0.` | error, error | one `invalid number` |
| `-` | `invalid token` | one `invalid number` |
| `--`, `---` | one error / two errors | two / three `invalid number` — one per `-` |
| `10-0` | number `10`, number `-0` | unchanged — `-` terminates a number |
| `-.123` | error, error, number `123` | one `invalid number` |
| `0abc,` | error, error, `,` | one `invalid number`, `,` |
| `1true` | error, `true` | one `invalid number` |
| `0n`, `123n` | `invalid token` | one `invalid number` |
| `[-123n]` | `[`, error, error, `]` | `[`, one `invalid number`, `]` |
| `12"a"` | error, string `"a"` | unchanged — `"` ends without accepting |

An unterminated string stays one error; its message changes from
`" are missing` to `invalid string`.

Every change in that table is an error becoming a *differently shaped* error.
**No input moves between erroring and not erroring, in either direction** — that
is the invariant worth checking the implementation against, and it is stronger
than "accepted documents are unchanged", because the tokenizer is public API and
a direct consumer can observe an error token the parser would only turn into a
rejection.

Nothing loosens either. `0n` does not become the number `0` followed by a stray
`n`: `n` is not a terminator, so the run is one `invalid number`, exactly as
`0abc` is today.

### Exporting the string and number scanners

The plan promises this module exports its string and number scanners so
`fjs/media/datajs` can reuse them. Stage 4 needs JSON's string rule unchanged
and its number rule *extended* (a bigint `n` suffix, `-Infinity`), so the
reusable unit is a step function over an explicit state, not a closed scanner.

Export them as such — `scanString` and `scanNumber`, each
`(input: number | null, state: S) => [List<JsonToken>, S]` — but do **not**
parameterize them for DataJS's extensions in this stage. A seam built for a
consumer that does not exist yet is the shape that rots: the `fjs/fsc` grammar
stage 2 deleted was dead precisely because nothing imported or proved it.
Widening the seam is stage 4's work, done against a real second caller.

### Edits owed to existing issues

Two open issues are written against the dependency this stage removes, and
both would otherwise send someone to build something stage 3 deletes. Each
gets a note now, while this is in flight, and its substantive rewrite in the
implementation PR — the premise only actually changes when the code does.

- [666-js-tokenizer-position-layer](../../../js/todo/666-js-tokenizer-position-layer.md)
  — proposes exporting a raw, metadata-free `tokenizeRaw` entry point from
  `fjs/js/tokenizer`, with a task to "switch `fjs/media/json/tokenizer` to
  consume it". JSON is that export's **only** proposed consumer, and no other
  exists: DJS imports two helpers and drives its own tokenizer. So after stage
  3 the export would be dead public API, against the issue's own
  defer-until-a-second-consumer rule. Both the export and the JSON task are
  struck through; what survives is the internal `tokenizeOp` re-extraction,
  which needs no consumer to justify it.
- [streaming-recognizer](./streaming-recognizer.md) — requires the recognizer
  to reuse "the tokenizer's *transition structure*" and to inherit the
  raw-control-in-string rejection from `fjs/js`'s `parseStringStateOp`. Its
  design survives intact and improves: the scanner it factors over a no-op
  builder becomes JSON's own `scanString`/`scanNumber`, so "one grammar, two
  builders" stops meaning "one *JavaScript* grammar". Repoint the citations.

### Tasks

- [ ] Write the scanner in `fjs/media/json/tokenizer/module.f.mjs`; delete the
      `fjs/js/tokenizer` import and the `mapToken`/`parseMinusState` wrapper.
- [ ] Move `StringToken`, `NumberToken`, `ErrorToken`, `EofToken` into
      `fjs/media/json/tokenizer/types.ts`; drop the `js/tokenizer` imports.
- [ ] Repoint `fjs/media/json/parser/types.ts`'s direct `NumberToken` import at
      `../tokenizer/types.ts`, so no file under `fjs/media/json` names
      `js/tokenizer`.
- [ ] Keep every accepted-input proof unchanged; rewrite only the error-shape
      cases, each with the reason it changed.
- [ ] Add string-recovery proofs for the escape cases, which today's suite does
      not cover: `"\x\""` is one `invalid string`, and `"ok\x\"tail" 1` is one
      `invalid string` followed by the number `1` — the second pins the
      resumption point, not just the count.
- [ ] Add word-boundary proofs, which today's suite does not cover: `true0`,
      `true_`, `true$`, `nullx`, `tru3` and `_x` are each one `invalid token`;
      `null-1` is `null` then `-1`; `trueÿ` is `true` then
      `unexpected character`.
- [ ] Keep the losslessness proofs — a valid number reaches `value` as its
      exact lexeme, with no derived numeric value built while scanning.
- [ ] 100% proof coverage, `scanString`/`scanNumber` called directly.
- [ ] Confirm afterwards that no runtime importer of `fjs/js/tokenizer` calls
      `tokenize`, and that `fjs/djs/tokenizer`'s `isKeywordToken`/`mergeTrivia`
      import is all that is left. The machine is retired in stage 7, not here.
- [ ] Carry out the two edits owed above: drop 666's JSON task and JSON
      motivation, and repoint `streaming-recognizer`'s scanner citations at
      JSON's own `scanString`/`scanNumber`.
- [ ] Add `changelog/unreleased/<PR>.md` and the matching `Changelog:` section
      in the PR description. The implementation changes observable behavior of
      the public `tokenize` — the error tokens it emits — and adds `scanString`
      and `scanNumber` to the module's public surface, so the entry is
      required. Prefix the error-shape half with `**BREAKING CHANGES:**`: a
      direct consumer matching on today's messages (`" are missing`,
      `unescaped character`, `invalid token` for `0n`) sees different tokens,
      and a consumer relying on a *value* token after a malformed literal stops
      receiving one. Valid JSON is unaffected, and the entry should say so.
- [ ] `npx tsc`, `fjs test`.

### Related

- [parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
  — this is its stage 3; stage 4 (`fjs/media/datajs`) consumes the scanners
  this stage exports.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — DataJS's
  grammar, whose string rule is JSON's and whose number rule extends it.
- [bnf-grammar-single-owner](./bnf-grammar-single-owner.md) — the BNF copy of
  this grammar; spec text and proof-covered example, never a runtime
  dependency of this scanner.
- [number-edge-cases](./number-edge-cases.md),
  [standard-parse-serialize](./standard-parse-serialize.md) — behavior
  downstream of this tokenizer, unchanged by the swap.
