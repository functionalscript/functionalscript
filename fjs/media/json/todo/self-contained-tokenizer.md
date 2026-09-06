## self-contained-tokenizer. JSON's reader comes from a grammar, not a wrapper

**Priority:** P2 — lowered from P1. Stage 4 still waits on it, but the reader
cannot report errors until a mapping can carry metadata, so it cannot hold the
front of a queue.
**Status:** blocked
**Blocked by:** [ebnf-migration](../../../todo/ebnf-migration.md)
and the metadata channel filed in
[functionalscript/functionalscript#1890](https://github.com/functionalscript/functionalscript/pull/1890)
— `fjs/ebnf/todo/meta-ast-mapping.md`, which lands with it.

### The direction changed, and this issue is rewritten around it

JSON's tokenizer is a ~100-line adapter over
[`fjs/js/tokenizer`](../../../js/tokenizer/module.f.mjs), the 747-line
JavaScript tokenizer. That is still the problem, and the argument for fixing it
is unchanged: JSON is frozen by
[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) and `fjs/js/tokenizer` must
grow with FunctionalScript, so every future JavaScript token — a new operator, a
new numeric literal, a new escape — reaches JSON's `default` arm as an input it
has to classify. The coupling is visible in the output: `/* c` reports
`*/ expected`, JSON being told about an unterminated comment it has no comments
to have; `>>>=` is one token because JavaScript lexes it as one operator; `0n`
is `invalid token` because it is a valid JS bigint literal.

**What changed is the replacement.** This issue used to specify a hand-written
scanner of JSON's lexical grammar, with `scanString` and `scanNumber` exported
as a seam for `fjs/media/datajs`. JSON's reader will instead come from an
**EBNF grammar** over [`fjs/ebnf/`](../../../ebnf/module.f.mjs), with a mapping
that builds the tokens or the value.

That reverses this repository's standing rule that the media codecs take no
runtime dependency on a grammar module
([parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
lists it among the decisions not to reopen; it is reopened, and that file
records the reversal). The old rule rested on `fjs/bnf` not being stable enough
to depend on. What changes it is not that argument but what the alternative
costs: a hand-written tokenizer and container machine **per format** against a
grammar of a few dozen readable lines.

The evidence is on the record rather than assumed. The hand-written design was
written, reviewed over several rounds, implemented in full and withdrawn —
[#1895](https://github.com/functionalscript/functionalscript/pull/1895),
reverted. It reached a working scanner with 100% proof coverage and a 5,586-row
differential sweep, and along the way review found a fabricated-token class, a
`\uXXXX` recovery hole that silently ate the token after a bad escape, and two
terminator-set errors in this very document. Those are the defects a hand-written
lexer produces, and each one had to be found by a person. **That is the cost the
grammar is being bought to avoid**, and it is why the withdrawal is a change of
direction rather than a retreat.

### Why it is blocked rather than open

**Less is missing than an earlier draft of this section claimed**, and the
difference matters, because it says what to build rather than what to wait for.
Measured against the tree as it stands:

- The **grammar already exists**, exported and proof-covered, at
  [`fjs/ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs). It is not work
  this issue owes.
- The **LL(1) backend already parses JSON with it.**
  [`fjs/ebnf/ll1/proof.f.mjs`](../../../ebnf/ll1/proof.f.mjs) builds
  `parser(json)`, and running it on `[1]` returns a full typed `Ast<typeof
  json>`.
- **Values are already mappable.** [`fjs/ebnf/map`](../../../ebnf/map/README.md)
  rewrites an AST bottom-up, and `ll1`'s own proof does exactly that over the
  LL(1) backend to turn `[-12,3]` into integers.
- An LL(1) failure already returns **an offset** — `[1,` yields `['error', 3]`.

So a grammar-driven reader is closer than "nothing to implement". Two gaps are
real, and they are about the *mapping*, not the grammar:

1. **A mapping receives no metadata.** Per `map`'s own table a function sees
   only its children already rewritten — never a position, never which symbol
   it matched — and it cannot return information alongside its value. So a
   mapping cannot attach source locations or classify a failure. That channel
   is [#1890](https://github.com/functionalscript/functionalscript/pull/1890)
   (`meta-ast-mapping`), and the module's own migration is
   [ebnf-migration](../../../todo/ebnf-migration.md).
2. **An offset is not an error message.** The backend says *where* a parse
   failed, not *what* was wrong. Today's tokenizer emits classified messages
   (`invalid number`, `invalid token`), and the error shapes a grammar-driven
   reader should emit are an open question either way — see the last item under
   [What unblocks this](#what-unblocks-this).

**The bar is not position preservation.**
[`fjs/media/json/parser`](../parser/module.f.mjs) says so in its own source:
its single error "carries no position or metadata". An earlier draft here
claimed the replacement had to preserve error positions the parser reports; it
reports none, and the LL(1) backend already gives more location information
than the current API exposes.

**Do not start a hand-written scanner in the meantime.** That is what was just
withdrawn.

### What any replacement is held to

These are measurements of the current tokenizer, not design, so they survive the
change of direction intact. A grammar-driven reader is judged against exactly
the same two invariants the hand-written one was, for the same reason: they are
what stops the accepted language moving under a consumer.


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
precisely what [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
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

> Stage 3a has landed, so the shape this section describes is **history**: the
> table below is what `tokenize` did before it, kept because it is what the 3a
> proofs were written against and what a reader comparing the two stages needs.

Rewriting error shapes is cheap to wave through as churn, so the one that is a
defect should be named as such. It emitted a **value token for text that was never
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
since the suppression covers all of them at once.

A caller that filters errors out — or a parser that resynchronizes on the next
value — sees a string `"x"` that no document contained. That is
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle): an
unsupported input is refused, never answered with a plausible wrong value. The
malformed literal has to report as error tokens alone — as many as the scan
raises, since `"\x\y"` has two defects and says so, but no value token among
them. It is the fabricated value §10 forbids, not the second error.

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

### What is preserved, and what is only recorded

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

### The accepting set, measured

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

The exception is **comments**, and it is the one loss this port declines to
avoid — *declines*, not cannot, which is how an earlier draft put it and which
review was right to refuse.
Today `/*"*/1` is one `invalid token` then `number 1`, because JavaScript's
machine takes the comment as a single token and the `"` inside it never starts
anything. The replacement has no comment state, so it emits `unexpected
character` for `/` and `*`, then reads `"` as a JSON string that runs to end of
input and eats `*/1`. **The avoidance exists**, and stating that it does not was
the overclaim: a scanner can carry an error-recovery state that, on `/*`, runs
to the closing `*/` and emits one error there, resuming after it. That rejects
comments as firmly as anything here — it never yields a comment token, and no
input moves out of erroring — so "you would have to accept comments" was never
the obstacle. It is **block** comments only: in `//"<LF>1` the LF ends
string recovery and is re-dispatched, so the `number 1` still
arrives — a line comment cannot swallow a suffix, because the construct and the
malformed string end at the same character. Reproducing today's result
would still mean giving JSON's scanner the *extent* of a JavaScript construct —
where `/*` ends — which is the grammar this stage exists to remove, and it buys
tokens no consumer reads. Measured: every consumer of this `tokenize` in the
repo — `fjs/media/json/module.f.mjs`, `fjs/media/json/extended/module.f.mjs`
and the parser's own proof — hands the tokens to `parse`, and `parse` returns
the same `["error", "unexpected token"]` for `/*"*/1`, for `/*"*/`, and for
`/*"*/1 2`. The suffix this port loses is unobservable through every path that
exists. So the loss is declined on price, not on impossibility, and the door
stays open: an error-resilient direct consumer would make the recovery state
worth building, as its own change with its own proof.

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

### Maximal munch reaches past the grammar

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
its point. That table is also what the two references below mean by
"absorbed", and every row of it is a fact about today's tokenizer rather than
a choice.

Two review rounds found this rule one phase at a time, which is why it is
stated generatively and then measured rather than listed. `12+"]` is
`invalid number` then `]` today; re-dispatching the `+` hands `"` to a
string scan that eats the `]`. `1e."/1` is `invalid number`, an error for
`/`, then `number 1`; re-dispatching the `.` loses that `1` the same way.

Both were re-measured against the wrapper as it stands and still hold. What a
grammar-driven reader *should* do with them is open: the withdrawn design
reproduced these accidents on purpose, and that rationale went with it.

### Where a number lexeme ends

Three failure states, which earlier drafts conflated into two:

- **A complete number followed by a character outside the accepting set** emits
  one `invalid number` and **re-dispatches** that character. `1true` is
  `invalid number` then `true`; `12"a"` is `invalid number` then the string.
  `+` is not such a character — it is absorbed, per the table above.
- **An incomplete number** — the grammar wanted more and met a character that
  cannot continue — does the same: one `invalid number`, character
  **re-dispatched**. `1e"a"` is `invalid number` then the string, and so are
  `-"a"`, `1."a"`, `1e+"a"` and `1e-"a"`. This is the case a two-state rule
  swallowed, destroying a string in all five phases.
- **An absorbed character** — a number-syntax character the grammar cannot
  consume, per the table above — is the **only** state that enters
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

### Stage 3a — the fabricated token — **landed**

Independent of everything above, and still correct under the new direction: it
fixes the wrapper that remains in place until the grammar replaces it.

#### Why it landed on its own

The fabricated `string` after `"\x"` was a doc/DESIGN.md §10 violation that
existed before any port was designed, and was provable against the wrapper as it
stood. It is the premise, so it landed first, on its own, with no dependency
change: `dropFabricatedString` in
[`../tokenizer/module.f.mjs`](../tokenizer/module.f.mjs).

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
keeps `"ok"`, which the proof pins.

As implemented the rule is a few lines *before* the wrapper's fold rather than
inside it — a `stateScan` over the JS token stream, applied where `tokenize`
builds it. Inside the fold it would have been incomplete: the fabricated token
also arrives while the wrapper sits in its `'-'` state, which returns to `'def'`
on the error and so passes the following `string` straight through, and `-"\x"`
leaked one where `"\x"` did not. Ahead of the fold the rule holds for both
without JSON's own machine knowing about it. Either way the port deletes it,
which is the point rather than a cost: it is what makes 3b carry no idea of its
own.

#### The change, and its proofs

**Done.** `dropFabricatedString` in
[`../tokenizer/module.f.mjs`](../tokenizer/module.f.mjs), with the
`stringRecovery` proofs beside it; 3b deletes both.

- [x] In `fjs/media/json/tokenizer/module.f.mjs`, drop the `string` token that
      immediately follows an `unescaped character`, `invalid hex value` or
      `unescaped control character in string` error. No dependency change, no
      new scanner, no other error shape touched.
- [x] Prove the three cases and the boundary: `"\x"` and `"\u{41}"` and a raw
      NUL are each one error with no value token, while `"\x" "ok"` keeps
      `"ok"` — the last is what makes the rule a rule rather than a heuristic.

      One case the design did not name had to be added: the fabricated token
      also reaches the wrapper's `'-'` state, which returns to `'def'` on the
      error and would have passed the `string` through, so `-"\x"` leaked one
      where `"\x"` did not. That is why the suppression runs over the JS token
      stream *before* `scanToken` rather than inside it.
- [x] Declare the break in the PR description's `Changelog:` section,
      `**BREAKING CHANGES:**` — a consumer relying on a value token after a
      malformed literal stops receiving one. Valid JSON is unaffected, and the
      declaration should say so.
- [x] `npm run gen` (no diff), then `tsc`, `fjs test` — and `node --test`,
      5493 passing.

      `cargo clippy -- -D warnings` and `cargo fmt -- --check` are
      unconditional, unlike `cargo test`; both ran on the branch head in CI —
      `clippy` in every platform job, `fmt` in `wasm` — and passed. Calling
      them vacuous because 3a touches no Rust was wrong: the checks apply to
      the tree, not to the diff, and "not affected by this change" is a
      prediction where a green run is a fact.

### What unblocks this

- [ ] **#1890 lands**, so a mapping can receive and return metadata. This is
      the one true blocker: without it a mapping sees only its rewritten
      children, so no reader built on it can locate or classify a failure.
- [ ] The `fjs/ebnf/` half of
      [ebnf-migration](../../../todo/ebnf-migration.md) settles, so the codec is
      not written against names still in motion. **Not** a claim that parsing is
      missing — `ll1` parses JSON today.
- [x] ~~Write JSON's grammar in EBNF.~~ **It already exists**, exported and
      proof-covered, at
      [`fjs/ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs), and
      `fjs/ebnf/ll1` already parses JSON with it. Placement is settled with it:
      not under `fjs/bnf`, which is the module being retired and holds its JSON
      grammar as an example only
      ([bnf-grammar-single-owner](../../../bnf/todo/bnf-grammar-single-owner.md)).
      **Do not write a second one.**
- [ ] Cross-check that grammar against the accepted-language probes above. It
      was written to RFC 8259 rather than against this tokenizer, so agreement
      is expected but unmeasured, and the `1n1` class is exactly where today's
      wrapper is known to differ from JSON.
- [ ] Write the mapping from its AST to JSON values, which is `fjs/ebnf/map`'s
      `rewrite` — the shape `ll1`'s proof already demonstrates on a smaller
      grammar. This is the reader's substance and the part that does not exist
      yet.
- [x] ~~Decide what replaces the seam.~~ **Answered in code, and it is what the
      reversal predicted.**
      [`fjs/ebnf/lib/datajs`](../../../ebnf/lib/datajs/module.f.mjs) already
      imports JSON's exported rules — `string`, `uint`, `optionNeg`,
      `optionFloatSuffix`, `digit`, `ws` — so the reuse is of *rules*, by
      ordinary import, and DataJS's grammar extends rather than wraps. The
      requirement in
      [`fjs/media/datajs/todo/parser-serializer.md`](../../datajs/todo/parser-serializer.md)
      is met by it: a bigint is `uint` plus `'n'`, and `Infinity` is a word in
      the number variant rather than number syntax.
- [ ] Re-derive the error-shape decisions — the last genuinely open design
      question. The measured tables above say what today's tokenizer does; an
      LL(1) failure is instead a bare offset, and today's tokenizer emits
      classified messages. What a grammar-driven reader *should* do with
      malformed input is settled by neither, and the answer will not be the
      hand-written recovery rules, which existed to reproduce a JavaScript
      lexer's accidents.

### Related

- [parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
  — this is its stage 3, and the file that carries the reversed no-runtime-BNF
  rule.
- [ebnf-migration](../../../todo/ebnf-migration.md) — `fjs/ebnf/` beside
  `fjs/bnf/`, then retire `bnf/`. The module this now depends on.
- [#1890](https://github.com/functionalscript/functionalscript/pull/1890) —
  `meta-ast-mapping`, the metadata channel a reader's mapping needs.
- [#1895](https://github.com/functionalscript/functionalscript/pull/1895) —
  the withdrawn hand-written implementation. Read it for the measurements and
  for the defect classes review found, not as a plan.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — DataJS's
  grammar. Its string rule is JSON's and its number rule is JSON's unchanged.
- [bnf-grammar-single-owner](../../../bnf/todo/bnf-grammar-single-owner.md) —
  written when a codec grammar was an example rather than a runtime dependency;
  edited for this direction. Its `fjs/media/json/grammar` ban survives on the
  narrower ground that `fjs/bnf` is the module being retired.
- [streaming-recognizer](./streaming-recognizer.md) — built on the `Scan<S>`
  seam this issue no longer promises, so it is now **blocked on this one** and
  its tasks are marked not to be started. Its requirement survives the rebase;
  its lexer plan does not.
- [number-edge-cases](./number-edge-cases.md),
  [standard-parse-serialize](./standard-parse-serialize.md) — behavior around
  this tokenizer.
- [`fjs/ebnf/lib/json`](../../../ebnf/lib/json/module.f.mjs) and
  [`fjs/ebnf/lib/datajs`](../../../ebnf/lib/datajs/module.f.mjs) — the grammars
  this reader is to run, both already written and proof-covered, the second
  importing the first's rules.
- [`fjs/ebnf/map`](../../../ebnf/map/README.md) — the AST-to-value rewrite a
  reader's mapping is written in, and the layer the metadata channel extends.
