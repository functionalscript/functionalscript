## self-contained-tokenizer. JSON's tokenizer is a wrapper over the JS tokenizer

**Priority:** P1 — raised, see
[parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)'s
priority note. EDAG needs a DataJS codec, and this stage is its prerequisite.
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
defect should be named as such. It emits a **value token for text that was never
in the input**, and it is a *class* rather than a handful of cases: **every
invalid escape and every raw control character inside a string** produces one.

```text
"\x"        → error 'unescaped character',  string "x"
"\v"        → error 'unescaped character',  string "v"
"\0"        → error 'unescaped character',  string "0"
"\u{41}"    → error 'invalid hex value',    string "{41}"
"\uEeFg"    → error 'invalid hex value',    string "g"
"a<TAB>b"   → error 'unescaped control character in string', string "ab"
```

Raw NUL and US inside a string do the same. Counting instances understates it —
a reader sizing the change needs the class, since rule 1 below covers all of
them at once.

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

`JsonToken`'s *shape* is unchanged — the same kinds carrying the same fields —
so `fjs/media/json/parser`'s behavior is untouched. But it does change at the
type level, and in a way worth deciding here rather than leaving to the
implementation.

`fjs/media/json/tokenizer/types.ts` currently builds `JsonToken` out of
`StringToken`, `NumberToken`, `ErrorToken` and `EofToken` imported from
`js/tokenizer/types.ts`. Those become JSON's own declarations, and
`_ScanInput`/`_ScanState` are replaced by the new state type. `ErrorToken` is
the one that cannot simply move: its `message` is a **closed union** of ten
literals (`js/tokenizer/types.ts`'s `_ErrorMessage`), and the message this
design introduces — `invalid string` — is not one of them.

Define JSON's own union explicitly rather than widening `message` to `string`
or copying JavaScript's list:

```ts
type JsonErrorMessage =
    | 'invalid number'
    | 'invalid string'
    | 'invalid token'
    | 'unexpected character'
```

Four messages, and that is the whole vocabulary — down from the ten JSON
inherits today, of which it emits eight and several are JavaScript's own
(`*/ expected` has no JSON meaning). The narrowing is a feature: the union is
the tokenizer's error contract, so a consumer can exhaustively switch on it, and
a message JSON cannot produce should not typecheck.

This is a public API change, additive in one direction and narrowing in the
other, and it belongs in the changelog entry alongside the error shapes.

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

   **A raw LF or CR also ends recovery**, and is re-dispatched rather than
   consumed. This matches what the tokenizer does today — `"a<LF>1` reports the
   unterminated literal and then goes on to emit the number `1` — and it is
   worth keeping on its own merits: an unterminated string should not eat the
   rest of the file. A raw space does not end it (`"a 1` is one error today),
   because a space is legal inside a JSON string and a newline is not.

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
| `00-2` | one error — `-2` is **swallowed** | `invalid number`, number `-2` |
| `00-` | one error | two `invalid number` |
| `00"a"` | one error — the string is **swallowed** | `invalid number`, string `"a"` |
| `00<LF>1` | error, number `1` | unchanged — LF was already a boundary |
| `00/1` | error, error, number `1` | unchanged — `/` continues neither |
| `00;1` | one error — `;` is **not** a boundary today | error, error, number `1` |
| `"a<LF>1` | error, number `1` | unchanged — LF ends string recovery |

An unterminated string stays one error; its message changes from
`" are missing` to `invalid string`.

The last two rows are a recovery class of their own, and the current behavior
there is worse than noisy — it is lossy. Today a malformed number swallows a
following `-` and everything after it: `00-2` reports one error and the
well-formed number `-2` never reaches the caller at all. And it does this
inconsistently, which is the tell that it is an accident rather than a policy —
`0.-2` and `12.-2`, malformed in a different way, *do* emit the `-2`. Making
`-` a terminator makes the three uniform and stops discarding a real token.

This is the same defect class as the fabricated string, running the other
direction: one invents a token the input never contained, the other discards one
it did.

#### Recovery, stated as a property rather than a list

The changed-shapes table grew under review three times, and the boundary set I
wrote to replace it was wrong in both directions — it is worth saying how,
because it is what the rule below is built to prevent.

Measured, character by character, the tokenizer today ends malformed-number
recovery at exactly:

```text
space TAB LF CR  ! % & ( ) * , / : < = > ? [ ] ^ { | } ~
```

and continues through `" # $ ' + - . ; @ \ _ ` digits and letters. There is no
principle in that set: it is `rangeSetTerminalForNumber`, JavaScript's operator
characters, inherited along with the tokenizer. Hardcoding it into a
self-contained JSON scanner would bake in the coupling this stage exists to
remove, and my first attempt at a principled replacement silently dropped
fourteen of those boundaries — meaning `00/1` would swallow a well-formed `1`,
the exact defect class this design is meant to fix.

So recovery is specified as a **property**, which can be checked without
enumerating anything:

> **Recovery consumes only characters that could continue a number or a word** —
> digits, letters, `_`, `$`, `.`, `+` — **and ends at everything else**, which is
> re-dispatched rather than consumed.

That set contains every boundary the tokenizer has today, and more (`-`, `"`,
`#`, `'`, `;`, `@`, `\`, backtick). Which gives the invariant worth proving:

> **Recovery never runs longer than it does today, anywhere.**

So no token that reaches a caller today is lost, in any input — the property
rules out the whole failure mode, rather than the table ruling out the cases
someone thought to list. Where recovery stops *earlier*, the tokenizer emits
more tokens after the error and never fewer, and the error itself is unaffected,
so the erroring/not-erroring invariant holds too.

The rows below follow from it. `00-2` and `00"a"` change, because `-` and `"`
gain boundary status. `00/1` does **not** change — `/` cannot continue a number
or a word, so it stays a boundary, which is what the earlier draft got wrong.

String recovery is unchanged: it ends at an unescaped `"`, a raw LF or CR, or
end of input, which is what it does today.

Every other change in the table is an error becoming a *differently shaped*
error.
**No input moves between erroring and not erroring, in either direction** — that
is the invariant worth checking the implementation against, and it is stronger
than "accepted documents are unchanged", because the tokenizer is public API and
a direct consumer can observe an error token the parser would only turn into a
rejection.

Nothing loosens either. `0n` does not become the number `0` followed by a stray
`n`: `n` is not a terminator, so the run is one `invalid number`, exactly as
`0abc` is today.

### The string and number scanners are the seam DataJS reuses

The plan promises this module exports its string and number scanners so
`fjs/media/datajs` can reuse them, and that consumer is **real and immediate**:
stage 4 follows this stage directly, and DataJS's tokenizer reuses parts of
JSON's rather than restating them.

What DataJS needs is known precisely enough to shape the seam:

- **Strings are JSON's, unchanged** — same grammar, same escapes, same
  rejection of raw control characters. `scanString` is reused as-is.
- **Numbers are JSON's, unchanged.** The spec is explicit
  ([`spec/datajs/README.md`](../../../../spec/datajs/README.md)): a DataJS
  number *is* a JSON number, same production. What DataJS adds sits beside it,
  not inside it — a **bigint is its own production**, `'-'? int 'n'`, reusing
  JSON's integer part, and deliberately not "a number followed by `n`", since
  that would accept `1.5n` and `1e2n`, which JavaScript rejects. And `NaN`,
  `Infinity` and `-Infinity` are **words**, not number syntax at all; the `-`
  folds into a following `Infinity` *word*.

  So the reuse is of JSON's number *scanner*, not an extension of its number
  *rule*. What stage 4 needs is to reach into the middle of that scanner —
  hence the phase clause below.

So the two are exported, and this stage owes their **entry contract** in
writing, not just their signatures — that was the gap in an earlier draft, where
a bare `(input, state) => [tokens, state]` named no state type, no initial
value, and no convention for which character the caller had already consumed. An
export a second implementation could satisfy incompatibly is not a contract.
Each scanner therefore ships with:

- a named state type in `types.ts`;
- an exported initial state, with the convention that **the scanner consumes
  its own opening character** — the `"` for a string, the `-` or first digit
  for a number — so there is no "already consumed" ambiguity at the boundary;
- a stated rule for how the caller learns the lexeme ended, and whether the
  terminating character was consumed or must be re-dispatched.

#### The number state exposes its phase, because that is what stage 4 wraps

That list is not sufficient on its own, and saying so is the difference between
a seam and a signature. Work through what DataJS actually has to do:

- **`1n`.** The bigint production is JSON's *integer* part followed by `n` —
  with no fraction and no exponent, since JS rejects `1.5n` and `1e2n`. So the
  wrapper must be able to tell that scanning stopped **after `int` with nothing
  else consumed**, and it must see that before JSON's own recovery treats `n`
  as a non-terminator and swallows it into an `invalid number`.
- **`-Infinity`.** The wrapper must intervene immediately **after the leading
  minus**, where JSON would otherwise see `I` as a non-terminator and consume
  the whole run as a malformed number.

A contract of "named state, initial value, terminator rule" can be satisfied by
an implementation whose state is opaque — and then neither interception is
possible. So the contract has one more clause, and it is the load-bearing one:

**`scanNumber`'s state is a public discriminated union whose variants are the
grammar's phases** — after the sign, in the integer part, after the decimal
point, in the fraction, after the exponent letter, after the exponent sign, in
the exponent — each carrying the lexeme accumulated so far. A wrapper inspects
the phase at the moment the scanner meets a character it cannot consume, and
decides whether to take over *before* the accept-or-reject decision is made.

That is what makes `-Infinity` and `1n` expressible without stage 3 knowing
anything about them.

Note what this is not: stage 3 still does not add DataJS's productions. There is
no bigint branch and no `Infinity` branch in JSON's scanner, and no
configuration parameter that switches them on. Exposing which phase the machine
is in is not the same as parameterizing it — the first is making the existing
machine observable, the second is putting someone else's grammar inside it. An
earlier draft of this section said "do not parameterize" and left it there,
which read as forbidding both; only the second is forbidden.

One honest caveat remains: a seam designed one stage before its caller can still
come out the wrong shape. Stage 4 may need to adjust it, and that is cheap
precisely because these exports are new here and unreleased, so changing them
breaks nobody.

### Why the port and the error rule land together

Review raised that this stage does two things at once — removes a dependency and
changes error recovery — and that a PR should do one, so that a failure can be
attributed to one or the other.

The concern is right in general and the split is not available here.

Some of the error-shape changes are **not a policy choice; they are consequences
of removing the dependency.** `--` reports once today because the JavaScript
tokenizer merges it into a decrement operator before JSON sees it. A scanner
that no longer consults that tokenizer cannot reproduce this without
reimplementing JavaScript's operator merging inside JSON — which is the coupling
being removed. The same holds for the sign asymmetry, where `-00` reports twice
and `00` once.

Landing the rest first, against the existing wrapper, means writing throwaway
code that exists to be deleted: to suppress the fabricated string in `"\x"`, the
wrapper would have to watch for a string token following a string error and drop
it — a heuristic over someone else's token stream, wrong in its own way, alive
for one PR. The alternative reading, porting first and *preserving* the
fabricated tokens, means deliberately writing new code to reproduce a known
defect.

So the two land together, and attribution comes from proofs rather than from
bisection, which is the stronger guarantee: every accepted-input proof must pass
**byte-identically**, so any failure among them is the port; every changed error
shape is tabled above in advance, so any error-shape difference not in that
table is also the port. Nothing is left to be discovered by staring at a diff.

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
  builder becomes JSON's own string and number scanning, so "one grammar, two
  builders" stops meaning "one *JavaScript* grammar". Repoint the citations.

### Tasks

- [ ] Write the scanner in `fjs/media/json/tokenizer/module.f.mjs`; delete the
      `fjs/js/tokenizer` import and the `mapToken`/`parseMinusState` wrapper.
- [ ] Move `StringToken`, `NumberToken`, `ErrorToken`, `EofToken` into
      `fjs/media/json/tokenizer/types.ts`; drop the `js/tokenizer` imports.
      Give `ErrorToken` JSON's own four-literal `message` union rather than
      widening it to `string` or copying JavaScript's ten.
- [ ] Repoint `fjs/media/json/parser/types.ts`'s direct `NumberToken` import at
      `../tokenizer/types.ts`, so no file under `fjs/media/json` names
      `js/tokenizer`.
- [ ] Keep every accepted-input proof unchanged; rewrite only the error-shape
      cases, each with the reason it changed.
- [ ] Add string-recovery proofs for the escape cases, which today's suite does
      not cover: `"\x\""` is one `invalid string`, and `"ok\x\"tail" 1` is one
      `invalid string` followed by the number `1` — the second pins the
      resumption point, not just the count. Pin at least one *other* invalid
      escape (`"\v"`) and one raw control character, so the proof holds the
      class rather than three instances of it.
- [ ] Add word-boundary proofs, which today's suite does not cover: `true0`,
      `true_`, `true$`, `nullx`, `tru3` and `_x` are each one `invalid token`;
      `null-1` is `null` then `-1`; `trueÿ` is `true` then
      `unexpected character`.
- [ ] Keep the losslessness proofs — a valid number reaches `value` as its
      exact lexeme, with no derived numeric value built while scanning.
- [ ] 100% proof coverage, including `scanString` and `scanNumber` called
      directly from their exported initial states — not only through
      `tokenize`. A seam proved only via its own module's entry point is not
      proved as a seam, and stage 4 is about to be its second caller.
- [ ] Prove the phase is observable the way stage 4 needs: from the exported
      state alone, a caller can distinguish "stopped after `int`" (the bigint
      interception point) from "stopped after the sign" (the `-Infinity` one)
      and from every other phase, before the accept-or-reject decision.
- [ ] Confirm afterwards that no runtime importer of `fjs/js/tokenizer` calls
      `tokenize`, and that `fjs/djs/tokenizer`'s `isKeywordToken`/`mergeTrivia`
      import is all that is left. The machine is retired in stage 7, not here.
- [ ] Repoint `streaming-recognizer`'s scanner citations at JSON's own string
      and number scanners. (666's edit is **already done** — it was rewritten in
      the PR that filed this design, so nothing is owed there.)
- [ ] Add `changelog/unreleased/<PR>.md` and the matching `Changelog:` section
      in the PR description. The implementation changes observable behavior of
      the public `tokenize` — the error tokens it emits — so the entry is
      required, with an additive half for the newly exported `scanString`,
      `scanNumber` and their state types, and a note that `JsonToken`'s error
      `message` narrows to JSON's own four-literal union. Prefix the error-shape half with
      `**BREAKING CHANGES:**`: a
      direct consumer matching on today's messages (`" are missing`,
      `unescaped character`, `invalid token` for `0n`) sees different tokens,
      and a consumer relying on a *value* token after a malformed literal stops
      receiving one. Valid JSON is unaffected, and the entry should say so.
- [ ] Prove the recovery property rather than a sample of it. The strongest
      form is a sweep: for every ASCII character `c`, tokenize `00` + `c` + `1`
      under both the old and new scanners and assert the new one never loses a
      token the old one produced — that is the "recovery never runs longer"
      invariant, checked exhaustively instead of by example. Pin the individual
      cases too, since they are what a reader reads: `00-2`, `00"a"` and `00;1`
      change; `00 1`, `00]`, `00,`, `00<LF>1` and `00/1` do not.
- [ ] Prove string recovery ends at an unescaped quote, a raw LF and a raw CR
      but not a space — `"a<LF>1` emits the number `1`, `"a 1` is one error.
- [ ] `npm run update`, then `npx tsc`, `fjs test`, `cargo clippy` and
      `cargo fmt -- --check`. The check set lists the last two unconditionally —
      only `cargo test` is scoped to having touched Rust — and they are quick
      no-ops for a change that touches none. The update step is not
      optional bookkeeping here: it regenerates CI workflows and lockfiles, and
      this stage adds no dependency, but it does change the module's exports
      and types, and the generated declaration output moves with them.

### Related

- [parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
  — this is its stage 3; stage 4 (`fjs/media/datajs`) is the second caller of
  the string and number scanners this stage exports, and may refine their
  contract while it is still unreleased.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — DataJS's
  grammar. Its string rule is JSON's, and its number rule is JSON's
  *unchanged* — the bigint is a separate production reusing JSON's integer
  part, and `NaN`/`Infinity` are words rather than number syntax. Stage 4
  reuses JSON's scanners; it does not widen JSON's grammar.
- [bnf-grammar-single-owner](./bnf-grammar-single-owner.md) — the BNF copy of
  this grammar; spec text and proof-covered example, never a runtime
  dependency of this scanner.
- [number-edge-cases](./number-edge-cases.md),
  [standard-parse-serialize](./standard-parse-serialize.md) — behavior
  downstream of this tokenizer, unchanged by the swap.
