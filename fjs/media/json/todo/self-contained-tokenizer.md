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

…with **one exception**, which review found and which the rest of this design
had to be corrected around.

#### An `n` inside a number is deleted today, and the number is accepted

Measured through the public `tokenize`:

```text
1n1          → number(11)
12n12        → number(1212)
0n1          → number(01)
12345n6789   → number(123456789)
-1n1         → number(-11)
{"a":1n1}    → { string(a) : number(11) }     and parse() returns { a: 11 }
```

`bigintToToken` (`fjs/js/tokenizer/module.f.mjs:439`) keeps the number state
with the `n` **dropped from the accumulated value**, so following digits append
to it. What decides the boundary is what those digits do to `numberKind`: a `0`
leaves it at `bigint`, which is why `1n0`, `1n00` and `0n0` still error, while
a digit `1`-`9` reverts it to `int` and the lexeme is accepted — `1n1`, `1n01`,
`1n10`, `12n12` and `-1n1`. A bare `1n` errors because nothing reverts it.

This is the design's own defect class in its worst form. `"\x"` at least emits
an error beside its fabricated string; this emits **a value token for text the
input never contained and no error at all** — and `0n1` produces `number(01)`,
which is not even a valid JSON number. `parse` returns `["ok", …]`. It is
precisely what [DESIGN.md §10](../../../../DESIGN.md#10-refuse-what-you-cannot-handle)
forbids.

The class is **larger than one `n`, and does not have a tidy shape.** A search
over all strings of length ≤ 5 that contain `n`, drawn from the alphabet
`0 1 . e - n`, finds 62 error-free inputs — the count is of that alphabet, not
of every character — including `1n1n1` → `number(111)`, `0n01` → `number(001)`, `-1n1` →
`number(-11)` and `1n1.0` → `number(11.0)`. But `1n0`, `1n00` and `0n0` *do*
error, so it is not simply "`n` between digits" either — the boundary is drawn
by the JavaScript tokenizer's own state machine, not by anything expressible in
JSON's terms.

So the exception is defined by **mechanism, not by shape**, because every
attempt in this document to enumerate a shape has been too narrow:

> **No input changes between producing an error token and not producing one,
> except where today's tokenizer deletes an `n` from inside a number.** Those
> inputs start erroring.

That is checkable without enumerating anything: a row that crosses the
erroring boundary is the fix if the old output shows an `n` swallowed into a
number token, and a bug otherwise.

Stating it precisely matters because `tokenize` is public API rather than an
internal step of `parse`: a direct consumer sees the tokens, not the rejection.
Everything else that errors today still errors, everything else that does not
still does not, and only the *shape* of the errors changes.

The exception is a **fix, not a regression**, and it is the one change in this
stage that improves the accepted language rather than preserving it. Under the
rules `1n1` becomes `invalid number` then `invalid token`. An implementer will
meet it at `c = 'n'` in the `12` + `c` + `1` sweep, which is why it is named
here rather than left to surface as an apparent contradiction between the sweep
task and the invariant check.

What is not JSON's is the **shape of the errors**, which is inherited from the
JavaScript token stream that produced them.

### One error shape is wrong; the rest are merely noisy

Rewriting error shapes is cheap to wave through as churn, so the one that is a
defect should be named as such. It emits a **value token for text that was never
in the input**, and it is a *class* rather than a handful of cases: **every
invalid escape, and every raw control character the tokenizer reports as
`unescaped control character in string`**, produces one.

```text
"\x"        → error 'unescaped character',  string "x"
"\v"        → error 'unescaped character',  string "v"
"\0"        → error 'unescaped character',  string "0"
"\u{41}"    → error 'invalid hex value',    string "{41}"
"\uEeFg"    → error 'invalid hex value',    string "g"
"a<TAB>b"   → error 'unescaped control character in string', string "ab"
```

Raw NUL, US, FF and VT inside a string do the same. **Raw LF and CR do not**,
and the boundary is worth stating because it is where the class ends: they end
the literal instead, giving `unterminated string literal` and no partial
`string` token, so `"a<LF>b"` is three errors and fabricates nothing. That is
also why 3a's suppression rule names three messages rather than "control
characters" — the message is the class, and the character is not.

Counting instances understates it — a reader sizing the change needs the class,
since rule 1 below covers all of them at once.

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
shape as the JS tokenizer it replaces: a `StateScan` over **UTF-16 code
units** followed by a single `null` end-of-input sentinel, folded with
`stateScan` and `flat`.
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
inherits today, of which it emits **nine** — only `eof` is unreachable, and
`*/ expected` is not JS-only in practice: `tokenize('/* c')` emits it, which is
JSON being told about an unterminated comment it has no comments to have. The
narrowing is a feature: the union is
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
char   ::= <any code unit except '"', '\', and U+0000–U+001F>
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

   **The scan is maximal munch, and it reaches past the grammar.** A character
   the grammar can consume is consumed; and a character the grammar *cannot*
   consume is still taken — **absorbed** — when it is one that looks like
   number syntax. Absorbing moves the scan into a **non-accepting** state from
   which the lexeme can no longer end, so it recovers. One rule, measured
   across every phase:

   > In any number state that has already consumed a digit or the point, a
   > character in `0-9 . e E +` that the grammar cannot consume is **absorbed**.
   > `-` is never absorbed — it terminates. The bare-sign state absorbs nothing.

   Which characters that leaves per phase, measured — every column is a fact
   about today's tokenizer, not a choice this design makes:

   | state | absorbs | so this is one error |
   | - | - | - |
   | after the sign — `-` | *nothing* | — |
   | integer part — `12` | `+` | `12+1` |
   | integer part after a leading `0` — `0` | `0`-`9` `+` | `00`, `01`, `0+1` |
   | after the point — `1.` | `.` `e` `E` `+` | `1..1`, `1.e1`, `1.+1` |
   | in the fraction — `1.5` | `.` `+` | `1.5.1`, `1.5+1` |
   | after the exponent letter — `1e` | `.` `e` `E` | `1e.1`, `1ee1` |
   | after the exponent sign — `1e+` | `.` `e` `E` `+` | `1e+.1`, `1e++1` |
   | in the exponent — `1e5` | `.` `e` `E` `+` | `1e5.1`, `1e5+1` |

   The pattern is one grammar's leftovers seen through another: `+`, a second
   `.`, a second `e` are all *number* characters, so JavaScript's machine keeps
   eating them and then reports the whole run invalid. Where the grammar wants
   the character the question never arises — `1e+5` consumes its sign, `12.5`
   its point.

   Two review rounds found this rule one phase at a time, which is why it is
   stated generatively and then measured rather than listed. `12+"]` is
   `invalid number` then `]` today; re-dispatching the `+` hands `"` to a
   string scan that eats the `]`. `1e."/1` is `invalid number`, an error for
   `/`, then `number 1`; re-dispatching the `.` loses that `1` the same way.
   Nothing here is an improvement and none of it is JSON's — it is reproduced
   because not reproducing it destroys tokens today's tokenizer emits.

   What happens at the end is decided by **how the lexeme failed**, and there
   are three cases, not two. An earlier draft had two and would have destroyed
   tokens in five number phases.

   - **Accepting stop.** The lexeme is complete, and the character that ended it
     is re-dispatched. It becomes a `number` token if that character is an
     accepting terminator — JSON's set below, and the caller's in general, per
     the seam section — and one `invalid number` if it is not — `"` in
     `12"a"`, `;` in `12;1` — with the character re-dispatched either way, so
     the string or the next token still scans. An absorbed character never
     reaches this case, per the rule above.
   - **Incomplete stop.** The grammar wanted more and met a character that
     cannot continue: `-`, `1.`, `1e`, `1e+`, `1e-`. One `invalid number`, and
     the character is **re-dispatched**, exactly as in the accepting case.
     `1e"a"` is `invalid number` then the string `"a"` — which is what the
     tokenizer does today, in all five phases. `12.]` is here rather than above,
     since `12.` stops after the point: `error, ]`.
   - **Absorbed character.** The table above pulled a character into the
     lexeme, which is now invalid and cannot end. This is the **only** case
     that enters **recovery** — consume through to the next recovery boundary
     and emit one `invalid number`, so `00abc`, `01"a"`, `012"a"`, `12+"a"` and
     `1e."a"` are each a single error with the rest swallowed.

   Measured, that third trigger is exactly as wide as the table and no wider:
   `01"a"`, `00"a"`, `012"a"`, `-00"a"`, `12+"a"` and `1e."a"` swallow the
   string, while `1.2"a"`, `1e2"a"`, `-0"a"` and `-."a"` emit it. Any rule that sent every non-accepting stop to
   recovery would swallow strings after `-`, `1.`, `1e`, `1e+` and `1e-` — five
   phases of token loss, from one word in the rule.

   The pair most easily conflated: `0abc` is an *accepting* stop (the `0`
   completes) so it is `invalid number` then `invalid token`, while `00abc`
   absorbed its second digit so it is one error.

   A character the grammar can still consume is consumed, so the terminator
   test never fires mid-lexeme: the `-` in `1e-5` is an exponent sign, because
   after `e` the grammar wants one.

   Requiring a terminator is why `0abc` reports `invalid number` for the `0`
   rather than accepting it as a number. RFC 8259 does not demand that — `0` is
   a complete `number` and the *parser* would reject what follows — but in a
   valid document a number is always terminated, so requiring it rejects
   nothing valid and says something far more useful about input that is wrong.
   The `"` case is the same judgement applied consistently: a number abutting a
   string is as malformed as a number abutting a word.

   It does **not** collapse the whole run into one token. `0abc` is `invalid
   number` and then `invalid token`, because the `a` is re-dispatched and the
   word rule takes it — two errors, exactly as today. Only an **absorbed
   character** — `00abc`, `01"a"`, `12+"a"`, `1e."a"` — enters recovery and
   consumes the rest into a single error.

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
   rather than a word, so `tru3` is one `invalid token` while `0abc` is an
   `invalid number` followed by one — the digit sends it to the number scanner
   first, which rejects the `0` and re-dispatches the `a`.

5. **The message names the lexeme that failed** — `invalid number`,
   `invalid string`, `invalid token` for a word run that is not `true`,
   `false` or `null`, and `unexpected character` for a code unit that can
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
| `-.123` | error, error, number `123` | same count — `invalid number`, `unexpected character`, number `123` |
| `0abc,` | error, error, `,` | unchanged — `0` completes, `abc` re-dispatched |
| `1true` | error, `true` | unchanged — same reason |
| `0n`, `123n` | `invalid token` — a **JS bigint literal** | `invalid number`, `invalid token` |
| `[-123n]` | `[`, error, error, `]` | `[`, error, error, `]` — same count, JSON's messages |
| `12"a"` | error, string `"a"` | unchanged — `"` ends without accepting |
| `12+1` | one error — `+1` is **swallowed** | unchanged — the `+` is absorbed |
| `12+"]` | error, `]` | unchanged — the `]` survives because the `+` is absorbed |
| `1e."/1` | error, error, number `1` | same count — `/`'s message becomes `unexpected character` |
| `>>>=` | one `invalid token` — a **JS operator** | four `unexpected character` |
| `/*a*/1` | one `invalid token` — a **JS comment** — then number `1` | four `unexpected character` and one `invalid token` for the word `a`, then number `1` |
| `/*"*/1` | one `invalid token`, then number `1` | two `unexpected character`, then one `invalid string` — **`1` is lost** |
| `1n1` | **number `11`, no error** — the `n` is deleted | `invalid number`, `invalid token` |
| `0n1` | **number `01`, no error** — not valid JSON | `invalid number`, `invalid token` |
| `1n1n1` | **number `111`, no error** — both `n`s deleted | errors |
| `00-2` | one error — `-2` is **swallowed** | unchanged — `-` is not a recovery boundary |
| `00-` | one error | unchanged |
| `00-"/1` | error, error, number `1` | same count — `/`'s message becomes `unexpected character` |
| `00"a"` | one error — the string is swallowed | unchanged — `"` is not a recovery boundary |
| `00"/1` | error, error, number `1` | same count — `/`'s message becomes `unexpected character` |
| `00<LF>1` | error, number `1` | unchanged — LF was already a boundary |
| `00/1` | error, error, number `1` | same count — `/`'s message becomes `unexpected character` |
| `12/1` | number `12`, error, number `1` | same count — `/`'s message becomes `unexpected character` |
| `00;1` | one error — `;` is not a boundary | unchanged |
| `"a<LF>1` | error, number `1` | unchanged — LF ends string recovery |

An unterminated string stays one error, and today it has **two** messages
depending on how it ended — `" are missing` at end of input, `unterminated
string literal` at a raw newline. Both become `invalid string`.

The `00-2` and `00-` rows are a recovery class of their own, and the current
behavior there is worse than noisy — it is lossy. Today a malformed number
swallows a following `-` and everything after it: `00-2` reports one error and
the well-formed number `-2` never reaches the caller at all. And it does this
inconsistently, which is the tell that it is an accident rather than a policy —
`0.-2` and `12.-2`, malformed in a different way, *do* emit the `-2`.

This is the same defect class as the fabricated string, running the other
direction: one invents a token the input never contained, the other discards one
it did. **It is recorded here and not fixed here** — a draft made `-` a
recovery boundary and lost a different token in `00-"/1`; see "Where a number
lexeme ends" for the counterexample and why the fix belongs in its own change.

#### What is preserved, and what is only recorded

Five review rounds were spent trying to state a rule that preserves today's
malformed-number behavior. Each attempt was wrong, and the reason is worth
writing down rather than attempting a sixth: **today's behavior in malformed
input is not a system.** Three unrelated code paths produce it —

- the `'-'` state, which is why `-.123` is `invalid token`, `invalid token`,
  `number 123` rather than anything a number rule would produce;
- the invalid-number state, which consumes to `rangeSetTerminalForNumber`,
  JavaScript's operator characters;
- the JavaScript tokenizer's own literals: `0n` is one `invalid token` because
  it is a **valid JS bigint literal**, mapped wholesale — the coupling this
  stage exists to remove, visible in the output.

No self-contained JSON scanner reproduces all three, and it should not try: two
of them are JavaScript facts with no JSON meaning. So the design stops promising
token-level preservation on malformed input and states what it actually
guarantees.

**Preserved, and proved:**

1. **Every input that tokenizes without an error today tokenizes identically**,
   except where the old tokenizer deletes an `n` from inside a number. Valid
   JSON is untouched, which is the property every consumer depends on.
2. **No input moves between erroring and not erroring**, in either direction,
   with the same exception, which starts erroring. An input that errors today
   still errors; one that does not, still does not. This is what stops the port
   quietly widening or narrowing the accepted language.

Both exceptions are the same one, and it is the single deliberate change to the
accepted language in this stage — `1n1` is `number(11)` today, with the `n`
deleted and no error emitted. It is bounded by that mechanism rather than by a
shape: a row may cross the erroring boundary only if the old output shows an
`n` swallowed into a number.

**Recorded, not promised:** within inputs that already error, the token stream
may change. The sweep is what makes that safe — not a rule, but a broad
before/after record, reviewed as data.

That is the honest shape of this change, and it is stronger than the invariants
the earlier drafts claimed, because these two are true.

#### The accepting set, measured

A complete number is accepted today when followed by:

```text
space TAB LF CR  ! % & ( ) * , - / : < = > ? [ ] ^ { | } ~   and end of input
```

That set is `rangeSetTerminalForNumber` plus `-`: JavaScript's operator
characters, with no JSON principle behind it — none of `!`, `%`, `(` can appear
in a valid JSON document.

It is **reproduced exactly**, and it is worth being precise about why, because
an earlier draft justified it with a rule this design does not hold. That draft
said dropping `/` would destroy `12/1`'s well-formed `number 12`, "the defect
class this design exists to remove". But `12/1` errors today and errors either
way, so **neither invariant forbids it**.

The honest reason is narrower. Invariant 2 pins one side: accepting *more*
characters would stop `12"a"` erroring at all, which is forbidden. The other
side is a **judgement, not a law** — reproducing the set costs nothing, and
gratuitously turning well-formed numbers into errors is churn a port should not
introduce.

Worth recording, since three drafts got this wrong in three different ways:
**no row loses a token that belongs to the input *after* the malformed
literal — except where today's tokenizer used a lexical construct JavaScript
has and JSON does not.** The claim has to be scoped that way, because inside a malformed
literal this design deliberately removes a token — the fabricated `string` after
`"\x"` is the defect it exists to fix, and `-00`'s two errors become one. Those
are the change, not collateral damage. What may never happen is a well-formed
token *beyond* the bad literal going missing because recovery ran further than
it does today.

The three drafts: `-.123` was said to lose `number 123`, and does not — the `-`
is an incomplete stop, so the `.` is re-dispatched. Then a `-` recovery boundary
lost `number 1` in `00-"/1`. Then a re-dispatched `+` lost the `]` in `12+"]`.
Both were reverted, and both were found by review rather than by the rule, which
is why the scoped claim is stated here rather than assumed.

The exception is **comments**, and it is the one loss this port cannot avoid.
Today `/*"*/1` is one `invalid token` then `number 1`, because JavaScript's
machine takes the comment as a single token and the `"` inside it never starts
anything. The replacement has no comment state, so it emits `unexpected
character` for `/` and `*`, then reads `"` as a JSON string that runs to end of
input and eats `*/1`. It is **block** comments only: in `//"<LF>1` the LF ends
string recovery and is re-dispatched, per rule 3, so the `number 1` still
arrives — a line comment cannot swallow a suffix, because the construct and the
malformed string end at the same character. Reproducing today's result
would mean giving JSON's scanner comment states — the JavaScript grammar this
stage exists to remove, and a construct JSON must refuse.

This is the `>>>=` class with a suffix attached: a run JavaScript lexes as one
token and JSON lexes character by character. It is confined to that class,
which is measured and small — single quotes and backticks already fail today
exactly as the replacement would (`'"'1` is `unexpected character` then an
unterminated string *today*), so comments are the only construct where the two
machines disagree about a suffix. Both invariants hold throughout: the input
errors before and after, and no valid JSON document contains a comment.

It does not go the other way either: `00-2`'s `-2` is lost today and stays lost,
because recovering it costs more than it returns.

Narrowing the set to JSON's own delimiters is defensible, and is a separate,
deliberate change with its own proofs — not something to slip into a port.

#### Where a number lexeme ends

Three failure states, which earlier drafts conflated into two:

- **A complete number followed by a character outside the accepting set** emits
  one `invalid number` and **re-dispatches** that character. `1true` is
  `invalid number` then `true`; `12"a"` is `invalid number` then the string.
  `+` is not such a character — it is absorbed, below.
- **An incomplete number** — the grammar wanted more and met a character that
  cannot continue — does the same: one `invalid number`, character
  **re-dispatched**. `1e"a"` is `invalid number` then the string, and so are
  `-"a"`, `1."a"`, `1e+"a"` and `1e-"a"`. This is the case a two-state rule
  swallowed, destroying a string in all five phases.
- **An absorbed character** — a number-syntax character the grammar cannot
  consume, per the table in rule 2 — is the **only** state that enters
  recovery, consuming until a boundary and emitting one `invalid number`.
  `00abc`, `01"a"`, `012"a"`, `12+"a"` and `1e."a"` are each one error.

Recovery's boundary set is today's, **reproduced exactly** — `-` is not in it:

```text
space TAB LF CR  ! % & ( ) * , / : < = > ? [ ] ^ { | } ~  and end of input
```

A draft of this design added `-`, because it is the one boundary whose absence
*loses* a token today: `00-2` reports one error and the well-formed `-2` never
reaches the caller, while `0.-2` and `12.-2` do emit it. That is a real defect,
and adding `-` is **not** the way to fix it. Review found the counterexample:

```text
00-"/1    today   invalid number, invalid token, number 1
          with -  invalid number, invalid number, invalid string   ← number 1 lost
```

Stopping recovery at `-` re-dispatches it into a fresh number scan, which meets
`"` as an *incomplete stop* and re-dispatches that in turn — handing the quote
to a string scan that runs to end of input and eats `/1`. The safety argument
was that a re-dispatched `-` begins a number whose own recovery stops at the
same boundaries; what it missed is that the number need never reach recovery,
because an incomplete stop re-dispatches instead. So the `-` boundary buys back
`-2` in `00-2` and pays for it with `1` in `00-"/1`: a wash at best, and one
that trades a defect this design can describe for one it did not notice.

The recovery set is therefore today's, and the whole recovery rule becomes
"identical to today" rather than "today's plus a judgement call". Note the
**accepting** terminator set above still contains `-`, and must: `10-0` is two
number tokens today, pinned by a proof. The two sets differ by exactly that
character, and the difference is today's, not this design's.

Fixing the `00-2` loss is worth doing and belongs in its own change, alongside
narrowing the terminator set to JSON's own delimiters — both are deliberate
recovery-policy changes with proofs of their own, and neither is something to
slip into a port. Whoever takes it should start from `00-"/1`, which is the case
that makes the obvious fix wrong.

### The string and number scanners are the seam DataJS reuses

The plan promises this module exports its string and number scanners so
`fjs/media/datajs` can reuse them, and that consumer is **real and immediate**:
DataJS's tokenizer reuses parts of JSON's rather than restating them, and stage
4 follows soon after — with stage 1b, the conformance corpus, between them.

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
  terminating character was consumed or must be re-dispatched;
- **the signature itself**, below. Naming the states and the conventions is not
  enough: "consumes the stopping character and emits a token" and "reports a
  stop and emits nothing" both satisfy the prose above, and stage 4 can only
  use the second.

#### The signature, so the seam has one shape rather than two

```ts
export type ScanResult<S> =
    { readonly kind: 'consumed', readonly state: S } |
    { readonly kind: 'stopped',  readonly state: S }

export type Scan<S> = (state: S) => (input: U16 | null) => ScanResult<S>
```

Both scanners are that shape — `Scan<StringState>` and `Scan<NumberState>` —
and each ships its initial state as a named export, spelled out here because
the paragraph above rules that "an export a second implementation could satisfy
incompatibly is not a contract" and then, in an earlier draft, said only *that*
there was an initial state:

```ts
export const scanString: Scan<StringState>
export const scanNumber: Scan<NumberState>

export const stringStart: StringState   // { kind: 'start' }
export const numberStart: NumberState   // { kind: 'start', lexeme: [] }
```

The **values** are part of the contract, not just the types. `numberStart`'s
`lexeme` is empty, and both kinds are `'start'` rather than a phase an input
could also reach — which is the property the state task already requires proved,
and it is unprovable against an initial state the design never named.

Three properties, and each is load-bearing for something already argued above:

- **A scanner emits no tokens.** It advances a state, and the state carries the
  lexeme accumulated so far. Building a `JsonToken` is the caller's, which is
  what lets JSON build one and DataJS build a different one from the same scan.
- **`stopped` does not consume the character.** The caller sees the state and
  the character it stopped at, and decides: terminate, re-dispatch, or take
  over. That is the whole of "the terminator sets are the caller's", expressed
  as a return type rather than a promise — and it is where `n`, `Infinity` and
  `;` are intercepted, all three before any accept-or-reject.
- **Absorption stays inside `consumed`.** A character the grammar rejects but
  maximal munch takes — rule 2's table — is a `consumed` that moves to the
  recovery variant, never a `stopped`. Absorption decides what the lexeme *is*,
  so it is the scanner's; termination decides what to *do* with it, so it is
  the caller's. Stating both on one return type is what keeps that boundary
  from drifting.

`input` is `null` at end of input, so a scanner never needs a separate
finish call, and the caller's terminator policy handles EOF as one more
non-continuing character.

And the two state types, since `Scan<S>` without `S` is still two APIs:

```ts
export type NumberState = {
    readonly kind:
        'start' | 'sign' | 'int' | 'point' | 'frac' |
        'exp' | 'expSign' | 'expDigits' | 'recovery',
    readonly lexeme: readonly U16[],
}

export type StringState =
    { readonly kind: 'start' } |
    { readonly kind: 'body' | 'escape', readonly value: readonly U16[] } |
    { readonly kind: 'hex', readonly value: readonly U16[], readonly digits: readonly U16[] } |
    { readonly kind: 'recovery' | 'recoveryEscape' } |
    { readonly kind: 'done', readonly value: readonly U16[] } |
    { readonly kind: 'failed' }
```

**Every one of those `U16`s is a UTF-16 code unit, not a code point**, and
that is load-bearing rather than a naming preference. The public entry point is
`tokenize(stringToList(text))` and `stringToList` is `charCodeAt` — code units
— so the choice is already made by the code this design replaces; an earlier
draft of this document said "code points" and would have sent an implementer
to build something the caller cannot feed. Two consequences, both measured
against today's tokenizer:

```text
"😀"             → [0xd83d, 0xde00]
"\ud83d\ude00"  → [0xd83d, 0xde00]      the same value, as JSON requires
"\ud800"        → [0xd800]              a lone surrogate, preserved
```

A code-point scan breaks both: the raw astral character would decode to
`[0x1f600]` while its escaped spelling stayed two units, so two JSON documents
that denote the same string would decode differently — and a lone surrogate,
which `\uXXXX` can spell and JSON permits, has no code point to be. The escape
grammar is `\uXXXX`, a *code unit* escape, so a JSON string simply is a
sequence of code units; scanning it as anything else re-opens a question JSON
already answered.

This is also why the scanner never decodes: every non-ASCII code unit,
surrogate or not, is just "any character except the three excluded classes" in
the `char` production above, so the string rules never inspect one.

**Recovery is two states, and it carries no value.** `recoveryEscape` is
required by rule 3: recovery keeps interpreting backslashes, which is why
`"\x\""` is one error rather than two, so after a backslash the scanner must
know that the next quote is escaped rather than closing. One `recovery` variant
cannot answer that without smuggling the distinction into another field, and
the sweep's `"\x\` prefix exists to exercise exactly this state.

Carrying no value is the second half: a malformed string has no value to
report, and a variant with nowhere to put one **cannot** produce the fabricated
token 3a removes. The defect becomes unrepresentable rather than merely
forbidden.

`NumberState`'s nine kinds are the seven grammar phases plus `start` and
`recovery`, as argued above — `int` is the bigint interception point, `sign`
the `-Infinity` one, and `recovery` is closed to the wrapper.

**A number state carries its `lexeme`; a string state carries its decoded
`value`.** The asymmetry is deliberate and both halves are already required
elsewhere: a number must reach `value` as its *exact* lexeme with no numeric
value built while scanning, and a string's value simply *is* its decoding, with
the escapes resolved by the shared table. Carrying raw text for a string would
make every consumer re-decode it, and carrying a decoded number would lose the
spelling the losslessness proofs pin.

**`recovery` is terminal for the number scanner too, and for a reason worth
stating.** Recovery ends at a *boundary*, and the boundary set is the caller's
— `00;1` must consume the `;` under JSON's set and stop before it under
DataJS's. A scanner that consumed during recovery would have to know one set or
the other, which is the delimiter knowledge this design just moved out of it.
So on entering `recovery` the scanner returns `stopped` for every input, and
the caller runs to its own boundary and emits one `invalid number`. Review
found the hole: the `Scan` signature took only a state and a character, so
without this the same recovery state could not serve both languages.

The string scanner is different **because its recovery ends at string syntax,
not at delimiters**: the closing quote, a raw LF, a raw CR — the same in both
languages, since DataJS's strings are JSON's unchanged. Nothing there is
policy, so `recovery` and `recoveryEscape` consume as normal and reach
`failed`. The asymmetry tracks exactly where a caller could disagree.

`done` and `failed` are **terminal**: every input returns `stopped` without
consuming, so a caller that keeps feeding them gets a stable answer rather than
an error. A well-formed string reaches `done` by *consuming* its closing quote
— the quote is part of the lexeme, so it is a `consumed`, and the `stopped`
comes on the character after. `failed` is where rule 3's recovery ends, whether
at a consumed closing quote or a re-dispatched LF or CR.

#### The number state exposes its phase, because that is what stage 4 wraps

That list is not sufficient on its own, and saying so is the difference between
a seam and a signature. Work through what DataJS actually has to do:

- **`1n`.** The bigint production is JSON's *integer* part followed by `n` —
  with no fraction and no exponent, since JS rejects `1.5n` and `1e2n`. So the
  wrapper must be able to tell that scanning stopped **after a well-formed
  `int` with nothing else consumed**, and it must see that before JSON's own
  recovery treats `n` as a non-terminator and swallows it into an `invalid
  number`. *Well-formed* is load-bearing: JS rejects `00n` exactly as it
  rejects `00`, so "stopped in the integer part" must not be a state an
  absorbed character can also reach — a digit in `00n`, a `+` in `12+n`.
- **`-Infinity`.** The wrapper must intervene immediately **after the leading
  minus**, where JSON would otherwise see `I` as a non-terminator and consume
  the whole run as a malformed number.
- **`export default 1;`.** DataJS's statement separator is `;`, which is not in
  JSON's accepting-terminator set — `12;1` is an `invalid number` today. A
  normalized DataJS document whose root is a bare number ends exactly that way,
  so the seam is useless to stage 4 unless `;` can terminate an accepting
  number. Review found this one, and it is the finding that shapes the clause
  below: two enumerated interceptions were never going to be enough.

A contract of "named state, initial value, terminator rule" can be satisfied by
an implementation whose state is opaque — and then neither interception is
possible. So the contract has one more clause, and it is the load-bearing one:

**`scanNumber`'s state is a public discriminated union.** Its variants are:

- **start** — the exported initial value, nothing consumed yet. It exists
  because the entry contract says the scanner consumes its own opening
  character, so a caller holds this state before feeding the `-` or the first
  digit. It is **closed to interception**: a wrapper reading it has been told
  nothing, and treating it as the sign or integer variant would let an empty
  scan pose as a `-Infinity` or bigint site.
- **the grammar's phases** — after the sign, in the integer part, after the
  decimal point, in the fraction, after the exponent letter, after the exponent
  sign, in the exponent.
- **recovery** — not a phase: the state the error rule above gives a lexeme
  that absorbed a character the grammar rejects, per rule 2's table.

Each carries the lexeme accumulated so far, empty in **start**. A wrapper
inspects the state at the moment the scanner meets a character it cannot
consume, and decides whether to take over *before* the accept-or-reject
decision is made.

The recovery variant is what keeps the seam honest, and it is why the union is
listed here rather than left as "the grammar's phases". Without it, the scanner
after `00` and the scanner after `10` would be the same variant — a wrapper
reading "in the integer part" would intercept the `n` in `00n` and mint a
bigint out of a literal JavaScript rejects, and stage 3 would have handed stage
4 a way to accept something neither language accepts. Hiding the run behind an
unspecified or opaque state is the same bug wearing a different hat.

So the interception rule is stated on the **state**, not on the character:

- **A wrapper may take over an `n` only from the integer variant**, which is
  reachable only by a well-formed `int` and is therefore an accepting state.
  From every other variant — **start** and recovery included — an `n` is JSON's
  to reject.
- **The recovery variant is closed to the wrapper**, and JSON's own
  recovery runs unchanged underneath it — the two are different statements and
  only the first is about DataJS. The wrapper cannot intercept from this
  variant at all; recovery then consumes to a **boundary**, exactly as the rule
  above says, not to the end of the input. So `00n` is one `invalid number`
  because `n` is not a boundary, while `00/1` is one `invalid number`, an
  `unexpected character` and `number 1` because `/` is — the token DataJS must
  not lose any more than JSON must.
- **`-Infinity` is intercepted from the sign variant**, and only from it, by
  the same discipline: a non-accepting state a wrapper is allowed to claim
  before JSON rejects it, named rather than inferred.

And one clause that is not about interception at all, because `;` showed the
enumeration was the wrong shape:

- **The accepting-terminator set is the caller's, not the scanner's.**
  `scanNumber` scans the lexeme — absorption included, since that decides what
  the lexeme *is* — and reports where it stopped and in which state. Whether
  the stopping character *terminates* is policy applied afterwards, by whoever
  called it. JSON's tokenizer applies the measured set above and nothing
  changes for it; DataJS applies that set plus `;`, and `export default 1;`
  yields `number 1`. Every other character DataJS can put after a number —
  `,` `]` `}` and whitespace — is already in JSON's set, so `;` is the whole
  difference.

  The **recovery boundary set travels with it**, for the same reason and by the
  same argument — it is delimiters, not grammar — so DataJS recovers a
  malformed number at its own `;` rather than swallowing the statement end.
  JSON's stays today's, exactly.

  This is not parameterizing the grammar, the thing this stage refuses to do.
  Neither set was ever lexical: both are JavaScript operator tables reproduced
  for compatibility, sitting where a language's own delimiters belong. Moving
  them to the caller puts each language's delimiters in that language's module,
  and is the reason `;` needs no special case.

That is what makes `-Infinity` and `1n` expressible without stage 3 knowing
anything about them — and `00n` inexpressible, which matters just as much.

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

### The stage lands as two changes: the fix, then the port

Review raised that this stage did two things at once — removed a dependency and
changed error recovery — and that a PR should do one. Earlier drafts argued the
split was unavailable. **That was wrong**, on the repo's own rule and on the
facts, and the design now splits.

[`DESIGN.md`](../../../../DESIGN.md) settles the question and even settles the
order. It forbids *the combination*, not a fixed order, and it names this exact
case: when the idea is the **premise** — decided before any port and provable in
the existing context — the separation runs idea first, then the port, "which
then carries no idea of its own beyond what the shared code already does".

#### Stage 3a — the fabricated token, fixed where it lives

The fabricated `string` after `"\x"` is a DESIGN.md §10 violation that exists
**today**, was found before any port was designed, and is provable against the
current wrapper. It is the premise, so it lands first, on its own, with no
dependency change.

An earlier draft called the wrapper-side fix "a heuristic over someone else's
token stream, wrong in its own way". Measured, it is neither heuristic nor
partial — the fabrication follows exactly three messages, always immediately:

```text
"\x"        unescaped character                  → string("x")
"\u{41}"    invalid hex value                    → string("{41}")
"<NUL>"     unescaped control character in string → string("")
```

Raw LF and CR are **not** in the class — they end the literal, so there is no
partial token to drop — which is why the rule keys on the message rather than
on "a control character".

So the rule is total over an enumerated set: **the `string` token immediately
following one of those three errors is fabricated, and is dropped.** No other
token is affected, and a real string after a string error survives — `"\x" "ok"`
keeps `"ok"`, which the proof pins. The code is a few lines in the wrapper's
fold, and the port deletes it. That deletion is the point, not a cost: it is
what makes 3b carry no idea of its own.

#### Stage 3b — the port, carrying only what the removal forces

Everything else in this design belongs to the port, because it **is** the
removal showing through rather than a policy this stage chose:

- the `n`-deletion acceptance fix, which the wrapper *cannot* make — it sees the
  token value `11`, never the `1n1` that produced it, so nothing in the existing
  context can tell the two apart;
- `JsonToken`'s error `message` narrowing to JSON's own four literals, since the
  ten-message union is the JavaScript tokenizer's;
- the three-case failure rule, absorption, and the terminator sets as caller
  policy — all statements about a scanner that does not exist until 3b;
- `--` reporting once today because the JavaScript tokenizer merges it into a
  decrement operator, and the `-00`/`00` sign asymmetry beside it;
- `>>>=` as one `invalid token`, and the block-comment suffix loss.

Reproducing any of these in a new scanner would mean writing new code to
implement JavaScript's lexical structure inside JSON — which is the coupling
being removed.

Attribution then has both halves: 3a is one small change with its own proofs,
and 3b is judged as a port. Every accepted-input proof must pass
**byte-identically**, so any failure among them is the port — that half is a
closed set, because the proofs are enumerated. Error-shape differences are
judged against the **two invariants and the stated rules**: a difference is
**3b's** if it follows from them, and a defect in the port if it does not. The
split does not change that test, because after it the error rules *are* the
port's — 3a carries none of them. The generated sweep tables are how such
differences are *surfaced*; they do not decide which ones may exist, and the
next section says why they cannot.

**No finite sweep is exhaustive**, and this design has now claimed otherwise
four times — first over two number prefixes, then over the number scanner
alone, then over the new scanner's states while the *old* one has states the new
one deliberately lacks, and then over a prefix list that announced one prefix per
state and delivered neither: it gave none for three of `StringState`'s eight
kinds, and none for the leading zero, whose behavior `NumberState` keeps in the
`lexeme` rather than the `kind`. That last round is the sharpest, because the
rule above the list was right both times and the list under it had simply never
been re-derived. `>>>=` is one `invalid token` today, because the
JavaScript tokenizer knows it as a single operator; the replacement emits four
`unexpected character` errors, and no prefix derived from the new scanner
reaches that.

So the sweep is **coverage, not a proof**, and attribution rests on the two
invariants plus the stated rules: a difference is expected if it follows from
the rules, and a bug if it does not — including a difference no table contains,
which is why the paragraph above cannot make absence from the tables a verdict. The tables make violations likely to be
*found*; they do not make the set of differences finite. Their prefixes should
be derived from the union of both machines — including the old one's operator
runs — because that is where the differences the new machine cannot predict
come from.

The changed-shapes table above is narrower still: illustrative, and known
incomplete. `+1` and `.5`
are `invalid token` today and become `unexpected character`, and neither has a
row — the table lists the cases worth explaining to a reader, while the sweep
lists all of them. An earlier draft rested the attribution rule on the manual
table, which would have misclassified a correct implementation as a
regression.

### Edits owed to existing issues

Two open issues are written against the dependency this stage removes, and both
would otherwise send someone to build something stage 3 deletes. **666 is
already rewritten, in this PR; only `streaming-recognizer` is still owed.**

- [666-js-tokenizer-position-layer](../../../js/todo/666-js-tokenizer-position-layer.md)
  — proposes exporting a raw, metadata-free `tokenizeRaw` entry point from
  `fjs/js/tokenizer`, with a task to "switch `fjs/media/json/tokenizer` to
  consume it". JSON is that export's **only** proposed consumer, and no other
  exists: DJS imports two helpers and drives its own tokenizer. So after stage
  3 the export would be dead public API, against the issue's own
  defer-until-a-second-consumer rule. **Done in this PR**, and more firmly than
  an earlier draft of this paragraph claimed: the export and the JSON task are
  *deleted* from the proposal and the task list, not struck through, and the
  file records "removed, not deferred". What survives there is the internal
  `tokenizeOp` re-extraction, which needs no consumer to justify it.
- [streaming-recognizer](./streaming-recognizer.md) — requires the recognizer
  to reuse "the tokenizer's *transition structure*" and to inherit the
  raw-control-in-string rejection from `fjs/js`'s `parseStringStateOp`. Its
  design survives intact and improves: the scanner it factors over a no-op
  builder becomes JSON's own string and number scanning, so "one grammar, two
  builders" stops meaning "one *JavaScript* grammar". A pointer note is in place;
  the citations are repointed in the implementation PR, where the premise
  actually becomes true.

### Tasks

Two PRs, in this order. Everything from "Stage 3b" down is the second.

#### Stage 3a — drop the fabricated string

- [ ] In `fjs/media/json/tokenizer/module.f.mjs`, drop the `string` token that
      immediately follows an `unescaped character`, `invalid hex value` or
      `unescaped control character in string` error. No dependency change, no
      new scanner, no other error shape touched.
- [ ] Prove the three cases and the boundary: `"\x"` and `"\u{41}"` and a raw
      NUL are each one error with no value token, while `"\x" "ok"` keeps
      `"ok"` — the last is what makes the rule a rule rather than a heuristic.
- [ ] `changelog/unreleased/<PR>.md`, `**BREAKING CHANGES:**` — a consumer
      relying on a value token after a malformed literal stops receiving one.
      Valid JSON is unaffected, and the entry should say so.
- [ ] `npm run update`, then `npx tsc`, `fjs test`, `cargo clippy` and
      `cargo fmt -- --check`.

#### Stage 3b — the port

- [ ] Write the scanner in `fjs/media/json/tokenizer/module.f.mjs`; delete the
      `fjs/js/tokenizer` import, the `mapToken`/`parseMinusState` wrapper, and
      3a's fabricated-token suppression, which the scanner makes unreachable.
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
- [ ] Prove the terminator policy is the caller's: `scanNumber` reports the
      stop, `fjs/media/json/tokenizer` applies JSON's set, and a proof feeds
      the scanner `1;` with a set containing `;` and gets `number 1` — the
      case stage 4 needs for `export default 1;`. JSON's own tokens must not
      move: `12;1` stays `invalid number`, `unexpected character`, `number 1`.
- [ ] Export `Scan<S>`, `ScanResult<S>`, `StringState` and `NumberState` from
      `types.ts`, and `scanString`, `scanNumber`, `stringStart` and
      `numberStart` from the module, **as declared above** — the initial states
      by those names and with those values, since stage 4 imports them — the kinds and fields, not a shape of
      the implementer's choosing, with `U16` imported from
      [`fjs/text/utf16/types.ts`](../../../text/utf16/types.ts) rather than
      spelled `number`. It is an alias, so this buys no checking; it buys the
      reader the one fact a bare `number` hides, and this document has already
      lost that fact once — and prove the properties stage 4 rests on:
      a scan emits no token; a `stopped` leaves the character unconsumed so the
      caller can terminate, re-dispatch or take over; `done` and `failed` are
      terminal; and a number's `lexeme` is its exact source text while a
      string's `value` is decoded.
- [ ] Prove the state is observable the way stage 4 needs: from the exported
      state alone, a caller can distinguish "stopped after a well-formed `int`"
      (the bigint interception point) from "stopped after the sign" (the
      `-Infinity` one), from **start**, from **recovery**, and from every other
      variant, before the accept-or-reject decision. Pin the ways into recovery
      explicitly — after `00`, after `12+`, after `1e.` — since that is the
      single distinction standing between stage 4 and a bigint built from
      `00n`, `12+n` or `1e.n`; and pin that the initial state is **start** and
      not the sign or integer variant, so an untouched scanner cannot pose as
      an interception site.
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
      `scanNumber`, their initial states `stringStart` and `numberStart`, and
      their state types, and a note that `JsonToken`'s error
      `message` narrows to JSON's own four-literal union. Prefix the error-shape half with
      `**BREAKING CHANGES:**`: a
      direct consumer matching on today's messages (`" are missing` and
      `unterminated string literal`, which both become `invalid string`,
      `unescaped character`, `invalid token` for `0n`) sees different tokens,
      and `1n1` starts erroring where it was a number. The fabricated value
      token is **3a's** entry, not this one — it is gone before the port
      begins, and claiming it here would credit the port with a change it did
      not make. Valid JSON is unaffected, and the entry should say so.
- [ ] **Derive the sweep's prefixes from the scanners' own behavior** — rule
      2's absorption table for numbers, `StringState`'s kinds for strings —
      rather than listing the ones that came to mind. This requirement is
      the point: the prefix set has now been too narrow in three review rounds
      — first covering only `12` and `00`, which cannot see that `1e"a"` emits
      a string today; then covering only the number scanner, which cannot see
      that `"\x"` changes at all; then, in one round, both listing five of
      `StringState`'s eight kinds under a heading promising all of them **and**
      omitting the leading zero. The first two called the sweep exhaustive
      while being exhaustive over one axis. The third is why the last sentence
      of this task exists — a list that loses to the state set is only useful
      if someone runs the comparison, and for one round nobody did — and why
      the derivation below names its two sources instead of saying "the
      states".

      Every state of every scanner needs a prefix — but "state" here is
      **behavior, not `kind`**, and the two do not coincide. Derive the number
      prefixes from rule 2's absorption table, which enumerates eight phases,
      and the string prefixes from `StringState`'s kinds; the union is the
      list. Review found this the hard way, having first written a list off the
      kind unions alone and lost the leading zero: `0` and `12` are both `int`,
      and they diverge on the very next character — `120` is `number 120` and
      `00` is an error. The split lives in the `lexeme`, not in the `kind`.

      The kinds are still right, and should *not* grow a `zero` variant to make
      the derivation tidier. No caller wants the distinction: `0n` is as valid
      a bigint as `12n`, so stage 4's interception point is exactly `int`, and
      splitting it would make the wrapper match two kinds to ask one question.
      The state set is the API; the prefix list is a test obligation. It is the
      list that owes the finer grain.

      A **text** prefix also reaches a scanner state only through the
      tokenizer's own dispatch, so it pins that state against the characters the
      tokenizer can deliver, not against every character the now-public API
      admits. Two states are therefore not prefixes of their own, and the list
      has to say so, because each is a place where a mechanically
      complete-looking list would be **false** coverage: `start` shares the
      empty prefix, and the two terminal states cannot be any prefix's resting
      state at all.

      So enumerated:

      - **top level** — the empty prefix, so a bare `c` is swept. This one
        prefix is also **`start`** for both scanners: `c` is where the
        dispatcher hands `"` to a fresh string scan and a digit or `-` to a
        fresh number scan, and inside the tokenizer neither scanner has any
        other way in;
      - **number** — one per row of the absorption table: `12` in the integer
        part, **`0` after a leading zero**, `1.5` in the fraction and `1e5` in
        the exponent, all accepting; `00`, `12+` and `1e.` for recovery; and
        `-`, `1.`, `1e`, `1e+`, `1e-` incomplete. `12` cannot stand in for `0`:
        the two share the `+` that both absorb, and differ on every digit,
        which is the character that separates them;
      - **string** — inside a literal (`"a`), after a backslash (`"\`), each
        `\u` hex position (`"\u`, `"\uA`, `"\uAB`, `"\uABC`), and — since
        rule 3 gives malformed strings a recovery of their own — **inside
        recovery** after an invalid escape (`"\x`) and its post-backslash
        substate (`"\x\`). Without those two, a mishandled quote, backslash,
        LF or CR *after* an invalid escape is reachable only by the handful of
        cases pinned individually, which is what this task exists to stop
        relying on;
      - **after a literal, both ways** — `""` and `"\x"`. These are *not*
        prefixes for `done` and `failed`, and listing them under those names
        would be the false coverage just described: both states are terminal,
        so the tokenizer emits its token and returns to top level rather than
        resting in either, and a prefix ending in a closed literal sweeps
        top-level dispatch. What they pin is the **resumption point** after
        each kind of string — that a well-formed and a malformed literal hand
        the next character back to the same place — and `"\x"` is where 3a
        changes the emitted token, so its rows are the ones a reviewer diffs
        that change against;
      - **word** — a keyword prefix (`tru`), a complete keyword (`true`), and a
        non-keyword run (`x`).

      `done` and `failed` are reached by the sweep, then, but never held, and
      their contract — every input `stopped`, nothing consumed — is proved
      directly on the scanner by the export task above. So is the number
      scanner's terminal `recovery`, for the same reason and with the same
      division of labour: a caller may feed a terminal state where the
      tokenizer never would, and only a direct proof sees that.

      For each prefix, and every ASCII character `c`, record `prefix` + `c` +
      `1`. If the implementation's state set does not match this list, the list
      is wrong and the state set wins — subject to the two exemptions named
      above, which are claims about what a text sweep can reach, not licence to
      leave a state unpinned. A kind carrying two behaviors owes **two**
      prefixes, as `int` does; matching the list against the kind union alone is
      how the leading zero went missing.

      Add the **old** machine's states too, since it has states the replacement
      deliberately lacks: JavaScript operator runs (`>>`, `>>>`, `>>>=`, `===`,
      `!==`, `&&`, `??`, `=>`, `**=`), each one `invalid token` today and one
      `unexpected character` per character after; and its **comment** states
      (`/*`, `//`). `/*` is the only old state that can swallow a suffix —
      `/*"*/1` loses its `number 1`, per the exception above — but sweep `//`
      as well, since "it cannot" is the kind of claim this review has
      falsified repeatedly and the prefix costs nothing. A prefix set
      derived only from the new scanner cannot reach any of them, which is how
      this was missed.
- [ ] Commit **two** tables from the sweep, not one: the old tokenizer's output
      (recorded once during implementation, for review) and the new scanner's
      expected output. The proof asserts against the *new* table — asserting
      against the old one cannot pass, since the `n` class changes deliberately
      and 14 rows change their message — and the old table is what a reviewer
      diffs it against. Neither may import
      `fjs/js/tokenizer`: a permanent dependency would contradict this stage's
      own "no runtime importer calls `tokenize`" task and leave stage 7 unable
      to delete the machine without rewriting the proof.
- [ ] Check the recorded diff against the two invariants, which is the whole
      point of recording it: no row where the old output has no error and the
      new one does (or vice versa), and no row where a valid JSON document
      tokenizes differently — **with the one exception**, an `n` the old
      tokenizer deletes from inside a number, which the sweep reaches at
      `c = 'n'`. Test it by inspecting the *old* output: a row crossing the
      erroring boundary is the fix if its old token is a number that swallowed
      an `n`, and a bug otherwise. Do not test it by matching input shapes —
      the class includes `1n1n1`, `0n01` and `-1n1` but excludes `1n0`, and
      three attempts in this document to write that shape down were all wrong.
- [ ] Sweep **mixed boundaries** too, not only single characters: `00"/1` and
      `12+"]` are both invisible to `prefix` + `c` + `1`, because the damage
      comes from what the re-dispatched character's *own* scanner then
      consumes — in `12+"]` a re-dispatched `+` would hand `"` to a string scan
      that eats the `]`. Generate the table from two-character suffixes as
      well; that is how both absorbed characters were found, one review round
      apart.
- [ ] Pin the individual cases, since they are what a reader reads: **no input
      in the `00` + `c` + `1` family changes its token kinds or counts** — that
      is the point of reproducing today's recovery set rather than improving it.
      Messages are a separate matter and do change, so the two groups are pinned
      apart: `00-2`, `00-`, `00"a"`, `00;1`, `00 1`, `00]`, `00,` and `00<LF>1`
      are unchanged token for token, while `00"/1`, `00-"/1`, `00/1` and `12/1`
      keep their kinds and counts with `/`'s message becoming `unexpected
      character`. `message` is part of `JsonToken`, so a committed table that
      claimed the whole family unchanged could not be satisfied.
- [ ] Prove string recovery ends at an unescaped quote, a raw LF and a raw CR
      but not a space — `"a<LF>1` emits the number `1`, `"a 1` is one error.
- [ ] Pin the **comment** cases, since they are the one place a suffix token is
      lost: `/*a*/1` is four `unexpected character` and an `invalid token` for
      the word `a`, then `number 1`; `/*"*/1` is two `unexpected character`
      then one `invalid string`, with the `number 1` gone; and `//"<LF>1`
      keeps its `number 1`, since LF ends string recovery. Assert the loss rather than leaving it to be
      discovered — it is the exception the no-suffix-loss claim carries, and a
      proof that states it is what stops the next reader from "fixing" it by
      teaching JSON's scanner about comments.
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
