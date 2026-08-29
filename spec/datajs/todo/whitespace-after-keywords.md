## Require whitespace after `const`, `export` and `default`

**Priority:** P3
**Status:** open

### Problem

[`spec/datajs/README.md`](../README.md) states the whitespace rule
conditionally: whitespace is required "exactly where leaving it out would
merge two tokens into one". The condition is correct but it is a statement
about lexing, so every implementer has to reason about token merging to apply
it, and every tokenizer has to implement **maximal munch** over
`[A-Za-z0-9_$]+` — read the whole run of identifier characters, *then* decide
whether it is a word or an `id`. A tokenizer that stops as soon as it has
matched a keyword is wrong, and wrong in the direction that matters: it would
accept `export default$0;`, which JavaScript reads as the single identifier
`default$0` and rejects, breaking the subset law.

Requiring whitespace at three fixed sites may remove the obligation entirely.
The observation is that over-splitting is harmless everywhere else: a
tokenizer that reads `null$13` as `null` `$13` has produced two adjacent value
tokens, and the grammar has no production for that, so the parser rejects the
document either way. Only the message changes, not the accepted language.

### Proposal

Investigate, then decide between three options. Whichever wins, the acceptance
criterion is the subset law: **no document DataJS accepts may be rejected by
JavaScript or read differently by it.**

#### Why three sites and not more

A merge is possible only where the left token can end with an identifier
character and the right token can begin with one. Walking the grammar, the
adjacent-token pairs are:

| production | pairs | merge? |
| --- | --- | --- |
| `document ::= const* export` | `;`·`const`, `;`·`export` | no — `;` |
| `const ::= 'const' id '=' value ';'` | `const`·id | **yes** |
| | id·`=`, `=`·value, value·`;` | no — `=`, `;` |
| `export ::= 'export' 'default' value ';'` | `export`·`default` | **yes** |
| | `default`·value | **yes** |
| | value·`;` | no — `;` |
| `array`, `object`, `member`, `key` | every pair | no — `[ ] { } , :` |

So `const`·id, `export`·`default` and `default`·value are the complete set,
which is what makes a positional rule possible at all.

#### Why over-splitting is safe elsewhere

A tokenizer that terminates a word the moment it matches one of the nine
keywords produces, at every other position, one of:

- **keyword then `id`** — `null$13` → `null` `$13`. The keyword is a complete
  value, so the parser expects `;`, `,`, `]` or `}` next and rejects.
- **keyword then number or bigint** — `null0` → `null` `0`. Same rejection.
- **keyword then a letter, digit or `_` run** — `truex` → `true` then `x`,
  which is not a word and does not start with `$`, so it is a lexical error.
  This one is a gift from the `$` rule: before it, `x` was a valid `id`.

None of these is accepted, so none can disagree with JavaScript. The three
hazard sites are hazards precisely because the grammar *does* have a
production for a word followed by a word there.

#### Option A — mandatory whitespace, unconditional

Whitespace is required after `const`, after `export` and after `default`,
always. A tokenizer then lexes those three as "keyword plus at least one
whitespace character", which is stateless: `const$a` fails the match, does not
start with `$`, and is a lexical error; `exportdefault` likewise. No maximal
munch, no "was there whitespace before this token" bit threaded from tokenizer
to parser.

The cost is the one-line spellings the specification currently advertises:
`export default[1];`, `export default"a";` and `export default-1;` all become
invalid, and normalized form grows one byte for every document. In exchange
the normalized layout rule stops being conditional too — a single space after
`const`, `export` and `default`, and nowhere else — which is the same
simplification the reader gets, applied to the writer.

#### Option B — mandatory only before an identifier character

Whitespace is required after `const`, `export` and `default` when the next
character is in `[A-Za-z0-9_$]`. One character of lookahead at three fixed
sites, instead of maximal munch at every word. `export default[1];` and the
current normalized bytes survive unchanged.

Weaker than A — the rule is still conditional, and an implementer still has to
be told why — but it changes no accepted document except the ones already
rejected by JavaScript, so it is not a format change at all. That may make it
the cheaper answer for a specification meant to stop changing.

#### Option C — leave the rule as it is

Maximal munch over a run of identifier characters, then classify, is four
lines in a hand-written tokenizer. The question this investigation has to
answer honestly is whether the simplification is worth a change to a format
whose stated goal is to stop changing, and whether it survives contact with
the table-driven tokenizer stage 4 actually builds. Option C is the default if
the answer is no.

### Tasks

- [ ] Confirm the adjacency table above against the grammar, and confirm that
      no split of a merged pair at a non-hazard site is accepted — by
      enumeration, not by inspection.
- [ ] Check the same three sites in FunctionalScript, which stage 5 gives the
      same statement syntax and which does *not* restrict identifiers to a
      leading `$`. The "gift from the `$` rule" above does not apply there, so
      the conclusion may differ.
- [ ] Decide between A, B and C; record the decision and the rejected options
      in [`spec/datajs/README.md`](../README.md).
- [ ] If A or B: update the Whitespace section, the normalized-form layout
      rule if it moves, and the reject vectors in
      [`conformance-vectors.md`](./conformance-vectors.md).
- [ ] Add merge vectors either way: `export default$0;`, `const$0=1;`,
      `exportdefault $0;`, `export default1;`, and the harmless-split cases
      `null$13`, `null0`, `truex`.

### Related

- [`spec/datajs/README.md`](../README.md) — its Whitespace section states the
  conditional rule this issue questions.
- [`conformance-vectors.md`](./conformance-vectors.md) — where the merge
  vectors land.
- [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  — stage 4 builds the tokenizer this would simplify; stage 5 carries the
  question into FunctionalScript.
