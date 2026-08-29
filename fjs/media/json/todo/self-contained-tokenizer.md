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

#### `<digits> n <digits>` is accepted today, as a number, with no error

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
to it. The boundary is sharp: `1n`, `1n0`, `1n00`, `0n0` all error, while `1n1`,
`1n01`, `1n10`, `12n12` and `-1n1` do not.

This is the design's own defect class in its worst form. `"\x"` at least emits
an error beside its fabricated string; this emits **a value token for text the
input never contained and no error at all** — and `0n1` produces `number(01)`,
which is not even a valid JSON number. `parse` returns `["ok", …]`. It is
precisely what [DESIGN.md §10](../../../../DESIGN.md#10-refuse-what-you-cannot-handle)
forbids.

The class is **larger than one `n`, and does not have a tidy shape.** A search
over all strings of length ≤ 5 that contain `n` finds 62 error-free inputs,
including `1n1n1` → `number(111)`, `0n01` → `number(001)`, `-1n1` →
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

   **The scan is maximal munch**, as it is for words in rule 4. A character the
   grammar can consume is consumed. There is exactly **one** character the
   grammar cannot consume that is taken anyway — a digit immediately after a
   complete `int` whose first digit was `0` — and taking it moves the scan into
   a **non-accepting** state. That single exception is what `00` needs: `int ::= '0' | [1-9] [0-9]*`
   means the first `0` completes, so without it `00` would scan as two `number
   0` tokens instead of the one `invalid number` it is today. A digit after a
   leading zero continues the lexeme; it does not start a new one.

   What happens at the end is decided by **how the lexeme failed**, and there
   are three cases, not two. An earlier draft had two and would have destroyed
   tokens in five number phases.

   - **Accepting stop.** The lexeme is complete, and the character that ended it
     is re-dispatched. It becomes a `number` token if that character is an
     accepting terminator, and one `invalid number` if it is not — `"` in
     `12"a"`, `;` in `12;1` — with the character re-dispatched either way, so
     the string or the next token still scans.
   - **Incomplete stop.** The grammar wanted more and met a character that
     cannot continue: `-`, `1.`, `1e`, `1e+`, `1e-`. One `invalid number`, and
     the character is **re-dispatched**, exactly as in the accepting case.
     `1e"a"` is `invalid number` then the string `"a"` — which is what the
     tokenizer does today, in all five phases. `12.]` is here rather than above,
     since `12.` stops after the point: `error, ]`.
   - **Leading-zero run.** A `0` followed by a digit: maximal munch pulls the
     digit into an `int` that was already complete. This is the **only** case
     that enters **recovery** — consume through to the next recovery boundary
     and emit one `invalid number`, so `00abc`, `01"a"` and `012"a"` are each a
     single error with the rest swallowed.

   Measured, that third trigger is exactly as narrow as stated: `01"a"`,
   `00"a"`, `012"a"` and `-00"a"` swallow the string, while `1.2"a"`, `1e2"a"`
   and `-0"a"` emit it. Any rule that sent every non-accepting stop to recovery
   would swallow strings after `-`, `1.`, `1e`, `1e+` and `1e-` — five phases of
   token loss, from one word in the rule.

   The pair most easily conflated: `0abc` is an *accepting* stop (the `0`
   completes) so it is `invalid number` then `invalid token`, while `00abc` is a
   *leading-zero run* so it is one error.

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
   word rule takes it — two errors, exactly as today. Only a **leading-zero
   run** — `00abc`, `01"a"` — enters recovery and consumes the rest into a
   single error.

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
| `-.123` | error, error, number `123` | same count — `invalid number`, `unexpected character`, number `123` |
| `0abc,` | error, error, `,` | unchanged — `0` completes, `abc` re-dispatched |
| `1true` | error, `true` | unchanged — same reason |
| `0n`, `123n` | `invalid token` — a **JS bigint literal** | `invalid number`, `invalid token` |
| `[-123n]` | `[`, error, error, `]` | `[`, error, error, `]` — same count, JSON's messages |
| `12"a"` | error, string `"a"` | unchanged — `"` ends without accepting |
| `12+1` | one error — `+1` is **swallowed** | `invalid number`, then `+` re-dispatched |
| `>>>=` | one `invalid token` — a **JS operator** | four `unexpected character` |
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

Worth recording, since two earlier drafts got this wrong in opposite
directions: **no row in the table loses a token today's tokenizer emits.**
`-.123` was once said to, and it does not — under the three-case rule the `-` is
an incomplete stop, so the `.` is re-dispatched and `number 123` survives, with
only the two error messages changing. Then a draft that made `-` a recovery
boundary lost `number 1` in `00-"/1`, which is why that change was reverted. The
design changes error *shapes* and destroys nothing today's tokenizer emits. It
does not go the other way either: `00-2`'s `-2` is lost today and stays lost,
because recovering it costs more than it returns.

Narrowing the set to JSON's own delimiters is defensible, and is a separate,
deliberate change with its own proofs — not something to slip into a port.

#### Where a number lexeme ends

Three failure states, which earlier drafts conflated into two:

- **A complete number followed by a character outside the accepting set** emits
  one `invalid number` and **re-dispatches** that character. `1true` is
  `invalid number` then `true`; `12"a"` is `invalid number` then the string.
- **An incomplete number** — the grammar wanted more and met a character that
  cannot continue — does the same: one `invalid number`, character
  **re-dispatched**. `1e"a"` is `invalid number` then the string, and so are
  `-"a"`, `1."a"`, `1e+"a"` and `1e-"a"`. This is the case a two-state rule
  swallowed, destroying a string in all five phases.
- **A leading-zero run** — a `0` followed by a digit — is the **only** state
  that enters recovery, consuming until a boundary and emitting one `invalid
  number`. `00abc`, `01"a"` and `012"a"` are each one error.

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
  terminating character was consumed or must be re-dispatched.

#### The number state exposes its phase, because that is what stage 4 wraps

That list is not sufficient on its own, and saying so is the difference between
a seam and a signature. Work through what DataJS actually has to do:

- **`1n`.** The bigint production is JSON's *integer* part followed by `n` —
  with no fraction and no exponent, since JS rejects `1.5n` and `1e2n`. So the
  wrapper must be able to tell that scanning stopped **after a well-formed
  `int` with nothing else consumed**, and it must see that before JSON's own
  recovery treats `n` as a non-terminator and swallows it into an `invalid
  number`. *Well-formed* is load-bearing: JS rejects `00n` exactly as it
  rejects `00`, so "stopped in the integer part" must not be a state a
  leading-zero run can also reach.
- **`-Infinity`.** The wrapper must intervene immediately **after the leading
  minus**, where JSON would otherwise see `I` as a non-terminator and consume
  the whole run as a malformed number.

A contract of "named state, initial value, terminator rule" can be satisfied by
an implementation whose state is opaque — and then neither interception is
possible. So the contract has one more clause, and it is the load-bearing one:

**`scanNumber`'s state is a public discriminated union.** Its variants are the
grammar's phases — after the sign, in the integer part, after the decimal
point, in the fraction, after the exponent letter, after the exponent sign, in
the exponent — **plus one variant that is not a phase: the leading-zero run**,
the recovery state the error rule above gives a `0` followed by a digit. Each
carries the lexeme accumulated so far. A wrapper inspects the state at the
moment the scanner meets a character it cannot consume, and decides whether to
take over *before* the accept-or-reject decision is made.

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
  From every other variant — the leading-zero run included — an `n` is JSON's
  to reject.
- **The leading-zero variant is closed to the wrapper**, and JSON's own
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
bisection. Every accepted-input proof must pass **byte-identically**, so any
failure among them is the port — that half is a closed set, because the proofs
are enumerated. Error-shape differences are judged against the **two invariants
and the stated rules**: a difference is the error-rule change if it follows from
them, and the port if it does not. The generated sweep tables are how such
differences are *surfaced*; they do not decide which ones may exist, and the
next section says why they cannot.

**No finite sweep is exhaustive**, and this design has now claimed otherwise
three times — first over two number prefixes, then over the number scanner
alone, then over the new scanner's states while the *old* one has states the new
one deliberately lacks. `>>>=` is one `invalid token` today, because the
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
- [ ] Prove the state is observable the way stage 4 needs: from the exported
      state alone, a caller can distinguish "stopped after a well-formed `int`"
      (the bigint interception point) from "stopped after the sign" (the
      `-Infinity` one), from the **leading-zero run**, and from every other
      variant, before the accept-or-reject decision. Pin the leading-zero case
      explicitly — after `00`, the state is the recovery variant and not the
      integer one — since that is the single distinction standing between
      stage 4 and a bigint built from `00n`.
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
      direct consumer matching on today's messages (`" are missing` and
      `unterminated string literal`, which both become `invalid string`,
      `unescaped character`, `invalid token` for `0n`) sees different tokens,
      and a consumer relying on a *value* token after a malformed literal stops
      receiving one. Valid JSON is unaffected, and the entry should say so.
- [ ] **Derive the sweep's prefixes from the scanner's own states**, one per
      state, rather than listing the ones that came to mind. This requirement is
      the point: the prefix set has now been too narrow twice — first covering
      only `12` and `00`, which cannot see that `1e"a"` emits a string today,
      then covering only the number scanner, which cannot see that `"\x"`
      changes at all. Both times the sweep was called exhaustive while being
      exhaustive over one axis.

      Every state of every scanner needs a prefix, and the state machine is
      what enumerates them, not a person:

      - **top level** — the empty prefix, so a bare `c` is swept;
      - **number** — one per variant of the union above: `12` in the integer
        part, `1.5` in the fraction and `1e5` in the exponent, all accepting;
        `00` the leading-zero run; and `-`, `1.`, `1e`, `1e+`, `1e-`
        incomplete;
      - **string** — inside a literal (`"a`), after a backslash (`"\`), and
        each `\u` hex position (`"\u`, `"\uA`, `"\uAB`, `"\uABC`);
      - **word** — a keyword prefix (`tru`), a complete keyword (`true`), and a
        non-keyword run (`x`).

      For each prefix, and every ASCII character `c`, record `prefix` + `c` +
      `1`. If the implementation's state set does not match this list, the list
      is wrong and the state set wins.

      Add the **old** machine's states too, since it has states the replacement
      deliberately lacks: JavaScript operator runs (`>>`, `>>>`, `>>>=`, `===`,
      `!==`, `&&`, `??`, `=>`, `**=`). Each is one `invalid token` today and
      becomes one `unexpected character` per character. A prefix set derived
      only from the new scanner cannot reach them, which is how this was
      missed.
- [ ] Commit **two** tables from the sweep, not one: the old tokenizer's output
      (recorded once during implementation, for review) and the new scanner's
      expected output. The proof asserts against the *new* table — asserting
      against the old one cannot pass, since `-` changes deliberately — and the
      old table is what a reviewer diffs it against. Neither may import
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
- [ ] Sweep **mixed boundaries** too, not only single characters: a case like
      `00"/1` is invisible to `00` + `c` + `1`, because the damage comes from
      what the re-dispatched character's *own* scanner then consumes. Generate
      the table from two-character suffixes as well.
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
