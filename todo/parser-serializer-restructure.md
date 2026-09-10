## Restructure JSON, DataJS, and FunctionalScript parsers/serializers

**Priority:** P1 — stage 4 is urgent and stage 1b feeds it; see
[Priority](#priority-stages-3-and-4-come-first). **Stage 3b is P2**: open,
partly startable, and not first, which is the level and status its own issue
carries.
**Status:** wip — stages 1a, 2 and 3a done. **Stage 1b is what to pick up
next**: it is P1 and gates stage 4, while stage 3b is P2 with its error shapes
still undecided.

This is a coordinating issue: it records the design decided in discussion,
sequences the stages, and names the edits owed to existing issues. Each stage
gets its own co-located `todo/` file when it starts; concrete tasks live there,
not here.

### Pick up here

Read in this order; each line says what to do and why it comes when it does.
Item 1 is context rather than work. **Item 2 is what to start.**

1. **Stage 3b changed direction, and that changes this plan.** JSON's reader
   will come from an **EBNF grammar** over `fjs/ebnf/` rather than the
   hand-written scanner this issue specified, so the no-runtime-grammar rule
   below is reversed.

   **It is not blocked, though two earlier drafts of this plan said so.**
   Measurement retired that claim: the document grammar exists at
   `fjs/ebnf/lib/json`, the LL(1) backend parses JSON with it and folds a
   rewrite set into the parse. What 3b runs is
   narrower and **not written**: a token-stream grammar over that module's
   exported lexical rules, over UTF-16 code units, mapped to the tokens the
   container machine consumes — the machine stays, with both codecs and
   their `NumberPolicy` untouched. Four measured contracts decide that, in
   the stage's issue: a value mapping would lose the seam the extended
   codec's `123n` comes from; the public `tokenize` accepts streams
   that are no document, which the document grammar rejects; and strings are
   code-unit sequences, which the `ll1` proof's code-point decoding throws
   on. Its typed mapping has one prerequisite, `string`'s pin in
   widened-rule-signatures (closed),
   and one design question of its own: the naive token grammar gets a
   number's and a word's boundaries wrong. The metadata channel in
   [#1890](https://github.com/functionalscript/functionalscript/pull/1890) buys
   errors *better* than today's rather than the ones this reader owes, and it
   cannot classify a parse failure at all, since a failure yields no tree to
   annotate. What genuinely remains is a design decision — what the reader
   reports on malformed input — plus the module's own migration,
   [`fjs/todo/ebnf-migration.md`](../fjs/todo/ebnf-migration.md).

   It still is not what to pick up first. It is P2, its error shapes are
   undecided, and `fjs/ebnf/` is mid-migration, so writing a codec against it
   now means writing against names still moving. Stage 1b is P1 and gates
   stage 4, which is the ordering that matters.

   The hand-written design was written, reviewed, implemented in full and
   **withdrawn** —
   [#1895](https://github.com/functionalscript/functionalscript/pull/1895),
   reverted. Read it for its measurements, not as a plan. The rewritten issue
   carries what survives:
   [`fjs/media/json/todo/self-contained-tokenizer.md`](../fjs/media/json/todo/self-contained-tokenizer.md).
   What it carries is now measurement rather than design: the two invariants
   any replacement is held to, the accepted-language probes, the measured
   accepting and terminator sets, the error shapes today's wrapper produces,
   and a checklist of what has to be decided before an implementation can
   start. Those survive the reversal because they are facts about the
   tokenizer being replaced rather than about its replacement. Read the tables
   as what that file calls them — **recorded, not promised**: a before/after
   record reviewed as data, not a rule a replacement inherits. The two
   invariants are the part an implementation is actually held to.
   *Why it still matters:* stage 4 needs it. DataJS's reader reuses JSON's, and
   over a grammar the reuse is of rules rather than of exported scanners.
   That is answered in code —
   [`fjs/ebnf/lib/datajs`](../fjs/ebnf/lib/datajs/module.f.mjs) already
   imports JSON's rules — and the rewritten issue marks it done.
2. **Start here: stage 1b, the conformance vectors**
   ([`spec/datajs/todo/conformance-vectors.md`](../spec/datajs/todo/conformance-vectors.md)).
   *Why here:* it is stage 4's proof source, so landing stage 4 first means
   writing its proofs twice. The corpus bootstraps in JSON precisely so it can
   exist before any DataJS reader does. It is *not* a prerequisite of stage 3,
   which is JSON's own tokenizer and settles its own accepted set with JSON's
   own proofs — unchanged but for one enumerated defect, an `n` today's
   tokenizer deletes from inside a number.
   *Why it moved:* it was listed after stage 3 for convenience, not dependency.
   It is P1 and gates stage 4, where 3b is P2 with its error shapes undecided,
   and it is blocked on nothing — it needs no DataJS reader, and it does not
   care whether that reader is eventually hand-written or generated.
3. **Then: stage 4, `fjs/media/datajs`.** Design is filed:
   [`fjs/media/datajs/todo/parser-serializer.md`](../fjs/media/datajs/todo/parser-serializer.md).
   The normative
   behavior is already settled in
   [`spec/datajs/README.md`](../spec/datajs/README.md); stage 4 implements that
   spec, it does not redesign it. Its first task, the decision the stage list
   below states, is made and its reader landed: the grammar at
   `fjs/ebnf/lib/datajs` mapped to values by `fjs/media/datajs/parser`, the
   token-driven container machine retired for this format rather than widened,
   so JSON's parser seam is no prerequisite. The byte path, the serializer and
   normalized form remain.
   *Why:* this is the deliverable everything else is waiting for — see
   [Priority](#priority-stages-3-and-4-come-first).
4. **Then stages 5–7**, in order, as listed below.

**Already done, do not redo:** stage 1a (the DataJS specification), stage 2
(the dead `fjs/fsc` grammars, deleted), and stage 3a (the fabricated string
token, dropped). All three are on `main`.

**Do not start a hand-written JSON scanner.** That is what #1895 was, and it is
withdrawn — not because it failed, but because the defects review had to find in
it one at a time are the cost the grammar is being bought to avoid.

**Three things are decided and should not be reopened without a reason:**
DataJS is frozen at "JSON extended from a tree to a DAG, plus the leaves JSON
cannot spell" — new syntax belongs in FunctionalScript, not here; the media
codecs take no runtime dependency on `fjs/js/tokenizer`, which is the whole
point of the restructure — **the half of that rule about grammar modules is
reversed, see below**; and the mandatory identifier prefix is
**`$`**, not `_` or any other character. The prefix itself is what carries the
design — it retires the exclusion list — and the grammar does not force which
character does it, so the choice was made once and is closed. The objection on
the record against it is that `$` reads as a named placeholder nearly
everywhere (`${name}`, `$1` in replacement patterns, `$0` in a shell), which
lands squarely on normalized `$0`, `$1`, … names — though only where a document
is *written into* shell source, since piping one through a shell does not expand
it; see
[the spec's rationale](../spec/datajs/README.md#rationale) for what that costs
and what it does not.

### Problem

Parsing and serialization are spread over four module families whose
relationships grew rather than being designed:

- **`fjs/media/json`** — the structural parser (one container machine with a
  `NumberPolicy` seam, standard and extended codecs) and serializer are JSON's
  own and recently reworked. Its *tokenizer* is not: it is a ~100-line adapter
  over `fjs/js/tokenizer`, the hand-written 747-line JavaScript tokenizer.
- **`fjs/djs`** — a full module pipeline: a grammar-based BNF tokenizer, a BNF
  parser over token symbols, `AstModule`, and the transpiler behind
  `fjs compile`. It conflates two different things: a data interchange format
  (values, `const` sharing) and the language front end (imports, comments,
  identifier keys, future expressions).
- **`fjs/fsc`** — nearly empty: a character-classifier stub. It also held a
  dead third copy of the JSON grammar, deleted by stage 2.
- **`fjs/bnf`** — the grammar toolkit, still evolving: a breaking
  EOF-encoding change shipped recently
  ([#1516](https://github.com/functionalscript/functionalscript/pull/1516)),
  and the unicode split is still pending.

Two structural problems follow:

1. **The media codecs sit downstream of permanently evolving code.** JSON and
   the data format depend on the JS token vocabulary (`fjs/js/tokenizer`),
   which must grow with FunctionalScript. A frozen interchange format cannot
   be built on a mutating lexer, and the same argument bars a runtime
   dependency on `fjs/bnf` until that module is stable.
2. **The data format and the compiler front end are one codebase.** The DJS
   pipeline cannot be promoted to a spec'd, "implement it in an afternoon"
   format while it also carries module framing, trivia, and the growth path of
   the language.

### Proposal

Three tiers, each self-contained, with dependency arrows pointing only at
spec-frozen layers:

```text
fjs/media/json     own tokenizer + parser          frozen by the JSON spec
      ▲
fjs/media/datajs   reuses JSON's pieces            frozen by the DataJS spec
                   (strings, numbers, containers)

fjs/fsc            JS tokenizer (comments, all     evolves with the language
                   operators) → parser → AST → EDAG
```

- **JSON**: accepted language and value semantics are frozen; the
  `fjs/js/tokenizer` wrapper is replaced by a reader generated from JSON's own
  grammar over `fjs/ebnf/`. Error shapes may change once in that swap;
  accepted-input behavior does not, with one enumerated exception — inputs like
  `1n1`, which today's tokenizer accepts as a number by deleting the `n`, start
  erroring. No existing proof is in that class. Both halves are measured and
  the invariants stated in
  [self-contained-tokenizer](../fjs/media/json/todo/self-contained-tokenizer.md),
  which survives the change of direction because they are facts about the
  tokenizer being replaced rather than about its replacement.
- **DataJS** (the format known in this repository as DJS): a new, minimal,
  spec'd format — JSON extended from a tree to a DAG, nothing else. Its reader
  is built on a grammar extending JSON's rather than on JSON's exported
  scanners, which the withdrawn design promised and nothing now provides. That
  grammar is already written, at
  [`fjs/ebnf/lib/datajs`](../fjs/ebnf/lib/datajs/module.f.mjs) beside JSON's and
  importing its rules — not under `fjs/media/datajs`, which holds the codec.
  **Whether that grammar maps straight to values or only feeds the token-driven
  container machine is not decided here**: it is stage 4's first task, below,
  and the container machine is retired on the first route and widened on the
  second. The serializer stays hand-written either way, since nothing generates
  one from a grammar.
  Everything that is not needed for the DAG property moves to FunctionalScript.
- **FunctionalScript**: the current `fjs/djs` front end (grammar-based
  tokenizer, BNF parser, AST, transpiler) moves to `fjs/fsc` and continues to
  grow there — comments, imports, identifier keys, and the staged EDAG work.
  The compiler can emit DataJS (normalized) or JSON.
- **A grammar module *is* a runtime dependency of the media codecs — reversed.**
  This bullet used to read "BNF is not a runtime dependency of the media
  codecs", with the grammars kept as proof-covered examples. JSON's and DataJS's
  readers are instead a grammar over [`fjs/ebnf/`](../fjs/ebnf/module.f.mjs)
  plus a mapping.

  The old rule rested on the grammar module not being stable enough to depend
  on, and that argument has not changed — `fjs/ebnf/` is mid-migration, which is
  why stage 3b is not the thing to start first. What changed is what the
  alternative costs: a hand-written tokenizer and container machine per format,
  whose defects have to be found one at a time by review, against a grammar of a
  few dozen readable lines.

  The reversal is also narrower than it looks: it names `fjs/ebnf/`, and
  **`fjs/bnf` is not what a codec may depend on.** That module is the classical
  one being retired ([ebnf-migration](../fjs/todo/ebnf-migration.md)), so the
  old rule survives verbatim with respect to it:

  > The spec carries the grammars as BNF text; `fjs/bnf/**` may hold the JSON
  > and DataJS grammars as *proof-covered examples* cross-checked against the
  > spec's test vectors. An example grammar without proof coverage is how the
  > dead `fjs/fsc` copy happened — nothing imported or proved it, so it
  > silently drifted from the other two; none may be added without proofs.

  The proof-coverage half binds harder now, and binds `fjs/ebnf/` too. The
  three issues written against the withdrawn rule —
  [bnf-grammar-single-owner](../fjs/bnf/todo/bnf-grammar-single-owner.md),
  [207-bnf-semantic-actions](../fjs/bnf/todo/207-bnf-semantic-actions.md) and
  [`fjs/media/datajs`](../fjs/media/datajs/todo/parser-serializer.md) — are
  edited to match rather than left to be read as live instructions.

### The DataJS format (decision record)

Decisions made in design discussion; the spec (stage 1) is their normative
home. The governing principle: **derive behavior from JS**. DataJS ⊂
FunctionalScript ⊂ JavaScript, where `⊂` means *accepted with identical
meaning* — a subset may reject what its superset accepts, but must never
accept something and mean something different by it.

**Name.** DataJS; "DJS" survives only as an informal abbreviation. Not
"DataScript" (taken by a well-known database library). The npm name `datajs`
belongs to a defunct OData library — check availability before any standalone
package publishes; the spec does not need it.

**Data model.** A DAG of values. Leaves are JSON's primitives plus `bigint`,
`undefined`, `NaN`, `Infinity`, `-Infinity`, `-0`. Number round-trips satisfy
`Object.is`. Object entries follow JS object semantics exactly, and the spec
restates both halves rather than citing ECMA-262. Duplicate keys: value from
the last occurrence, position from the first. Observable key order is JS's
own-property ordering: keys that are array indices (canonical numeric
strings, `0` ≤ n < 2^32−1) come first in ascending numeric order, then all
other keys in first-occurrence order — `{"2":0,"1":0}` observably orders
`"1"` before `"2"` in every JS engine, and a non-JS implementation must
reorder the same way. Normalized output emits keys in that observable
order. Sharing is semantic — two
references to one `const` denote the same node, and references may only point
at *earlier* consts, so a document is acyclic by construction and parseable in
one pass. After grammar recognition and before returning the parsed result,
processing rejects duplicate declarations, resolves every reference against
earlier bindings, and fails the document if any reference is unresolved. The
reference parser returns live JS values and does not freeze them
(FunctionalScript has no `Object.freeze`); the spec is silent on freezing and
other implementations may.

**Syntax.**

```text
module    ::= const* export
const     ::= 'const' id '=' value ';'
export    ::= 'export' 'default' value ';'
value     ::= primitive | id | array | object
key       ::= string | '["__proto__"]'
```

- **`;` terminates every statement**, `export default` included; no empty
  statements.
  Rationale for `;` over a newline, each sufficient alone: no line-terminator
  taxonomy in the spec (a lone CR *is* a JS `LineTerminator` — trivia no
  implementer should need); one canonical spelling per document; the separator
  is a visible character, so byte-different files that render identically
  cannot differ in meaning; and a document minifies to one line —
  `const $0=[];export default [$0,$0];` — enabling DataJS inside JSON strings,
  line-delimited streaming, and one-line test fixtures. Whitespace is required
  at three positions and optional between other tokens, except within the exact
  `["__proto__"]` key sequence, per the next bullets.
- **Every statement ends with `;`, `export default` included** — the `;`
  terminates a statement, as it does in JavaScript, rather than separating one
  from the next. An intermediate draft dropped the final one on the reasoning
  that it would be the trailing separator JSON forbids for commas; that was
  reverted, and the reversal is the more useful record. **The comma rule is
  about ambiguity, not about trailing punctuation**: a comma between elements
  has a second reading — `[1,,2]` is three elements with a hole, so `[1,2,]`
  needs an explicit exception saying the last one makes none — and a `;` has no
  second reading for a rule to disambiguate, the empty statement being rejected
  on its own account. Three things follow. The production is
  `export default AssignmentExpression ';'`, so writing the `;` keeps the
  subset law resting on the grammar rather than on ASI supplying a terminator
  at end of input. A writer that ends every statement with `;` never asks which
  statement is last, which is the same argument the positional whitespace rule
  makes one bullet down. And parser complexity is identical either way — the
  `;` lives in whichever production owns it — so the implementer's job, which
  this format optimizes, does not favour the shorter form. The cost is one
  byte per document and a JSON conversion of `"export default " + json + ";"`
  rather than a bare prefix. Measured against Node: `export default [1]`
  without the `;`, followed by an appended line beginning with `[`, silently
  exports `1` instead of `[1]`; with the `;` it stays `[1]`.
- **Whitespace is JSON's** — space, tab, LF, CR — insignificant between tokens.
  The exact `["__proto__"]` key is one token and contains none. Other JS
  whitespace (U+2028/U+2029, NBSP, FF, BOM) is rejected.
- **Whitespace is required after `const`, `export` and `default`**, with no
  condition, and optional between other tokens except within `["__proto__"]`.
  Two of the three were forced
  already — a name begins with `$` and `export` is always followed by
  `default`, so `const$0` and `exportdefault` are each one identifier — and the
  third is the choice: `export default[1];` would lex, but requiring the space
  regardless is what makes the rule positional. Note what did *not* decide it:
  the conditional rule is implementable without maximal munch (require
  whitespace before an identifier, word, or unsigned number/bigint whenever the
  preceding character is an identifier character — one character of
  look-behind) and leaves the grammar LL(1) either way, the `-` folded into its
  token being what buys that.
  The payoff is stage 4's, and it is larger on the **serializer** than on the
  parser. A serializer under the conditional rule must know the first character
  the value writer will emit before it can decide on the space, and the value's
  type does not tell it: `Infinity` takes the space, `-Infinity` does not; `1`
  does, `-1` does not. Normalized bytes would depend on the sign of a number.
  Unconditional, the statement writer emits `export default ` and hands off.
  On the parser side, `const`, `export` and `default` can be lexed as a keyword
  plus at least one whitespace character, with no look-behind and no "was this
  token preceded by whitespace" bit; a word may otherwise end wherever it ends,
  because a wrong split elsewhere (`null$13` → `null` `$13`) produces two
  adjacent value tokens, which no production accepts. The merge-capable
  adjacencies are exactly `const`·name, `export`·`default` and `default`·value;
  every other pair has a punctuator, a string or a `-` between.
- **No comments, no imports.** A DataJS document is closed; the compiler
  inlines resolved imports when normalizing FunctionalScript to DataJS.
- **Strings and numbers are JSON's grammar.** Bigint is a production of its
  own, not a suffix on the number grammar: JSON's integer part (no fraction,
  no exponent, no leading zeros) followed by `n` — JS rejects `1.5n` and
  `1e2n`, so "number + `n`" would over-accept. `-` is not an operator: it
  folds into a following number, bigint, or `Infinity` token only (`-NaN`,
  `-undefined`, a bare `-` are rejected).
- **Keys** are JSON strings, plus the exact computed sequence
  `["__proto__"]` as the only way to write that one key. The sequence is
  contiguous and literal: whitespace and escape substitutions are not allowed.
  After grammar recognition and before returning the parsed result, processing
  decodes all JSON string escapes in every key and rejects it when the decoded
  value is `__proto__`; this rejects both
  `"__proto__"` and spellings such as `"\u005f_proto__"` (JS would read either
  as prototype replacement).
- **Const names** are ASCII and **start with `$`**: `$[A-Za-z0-9_$]*`, each
  bound once, with **no exclusion list**. The two collisions an exclusion list
  would have to cover are both closed by the leading `$` — though not with the
  same guarantee, which the spec's rationale now separates: the *value-word*
  collision is closed permanently by DataJS's own grammar, since the words it
  reads as values are **six** — `true`, `false`, `null`, `undefined`, `NaN`,
  `Infinity` — and that list does not grow when ECMA-262 does. The `word`
  production names `const`, `export` and `default` too, which is why a
  *tokenizer* decides among nine, but those three are ECMA-262 reserved words
  and so belong to the other collision. That one, the *reserved-word*
  collision, is ECMA-262's to decide, and
  would need **two** things at once — a new keyword spelled with a `$` **and**
  made unusable as a **binding identifier in module code**. That second
  condition is binding position, not reserved-word status: `let` and `static`
  are contextual keywords and still syntax errors as `const` names in a module,
  so "contextual" alone guarantees nothing. Measured: none of the sixty
  reserved, strict-mode-future, contextual and value words contains a `$`;
  fourteen of sixteen contextual keywords, including `using`, `accessor`,
  `satisfies` and `match`, are legal `const` names, the two exceptions being
  `let` and `static`, restricted by ES5 rather than by any later addition; and `#x` is rejected as a binding where `$x` and
  `_x` are accepted, which is why TC39 reaches outside the identifier grammar
  for new markers. What the format does to reduce the cost if it happened
  anyway — normalized names are `$` plus digits, the failure is a syntax error
  rather than a silent misread, re-normalizing renames every const
  mechanically, and the corpus pins `$class`/`$undefined` so no implementation
  drifts back to an exclusion list — is in the spec's rationale, along with the
  one-line grammar narrowing available if ECMA-262 ever moves toward `$`. A name JS rejects
  as a binding identifier in module code (module code is strict) would break
  the subset law outright — `const class = 1` and `const eval = 1` are syntax
  errors there — and a name JS *permits* but DataJS reads as a value is worse
  still: `const undefined = 5` makes `undefined` mean the const, which a subset
  treating the word as a literal would silently reinterpret. An earlier draft
  enumerated both sets, about fifty words every implementation would carry and
  a list ECMA-262 can extend; the `$` moves the whole question into the token
  grammar, decided on the first character. A tokenizer therefore needs no
  keyword-vs-identifier lookup: a word starting with `$` is an `id`, a word
  starting with a letter is one of the nine the grammar names or an error.
  **Which character carries the prefix is a separate question from whether
  there is one**, and it is settled rather than derived: `_` has the same
  property — no reserved word contains one either, so `_class` and `_undefined`
  are equally ordinary names — so the grammar does not choose between them.
  `$` is the decision; it is in the do-not-reopen list above, with the cost
  recorded in the spec.
- **Every JSON value is a DataJS value; no JSON document is a DataJS
  document** (a DataJS document is a JS module, so it cannot be a JSON
  document). The textual conversion `"export default " + json + ";"` — a prefix
  and a terminator — yields a valid document with one exception: a bare `"__proto__"` object key —
  rejected by DataJS because JS reads it as prototype replacement — must be
  rewritten to the exact, whitespace- and escape-free computed sequence
  `["__proto__"]` during conversion.
  Plain concatenation is exactly valid for JSON containing no `__proto__`
  key.

**Serialization.** Any conforming serializer may emit any valid document; a
separate *normalized form* section defines one byte-deterministic canonical
serializer (a const emitted
iff its value is an object or array referenced more than once **by reference
identity**; consts are emitted in **post-order of one depth-first traversal**
of the root value — arrays in element order, objects in observable key
order, each shared node descended into only on first encounter — with names
`$0`, `$1`, … assigned in emission order, so a shared node's dependencies
are always declared before it and "who is `$0`" has exactly one answer:
for `root = [parent, parent, child]` with `child` inside `parent`, `child`
finishes first and is `$0`, `parent` is `$1`; primitives are always emitted
inline and never hoisted, since
primitive sharing is unobservable and a value-equality ref counter would
face the `0`/`-0` and `NaN` merging ambiguity that the `Object.is`
round-trip guarantee forbids; the canonical number spelling is exactly
ECMAScript's `ToString(Number)` — a fully deterministic algorithm the spec
restates, so no "shortest spelling" tie such as `1e3` vs `1E3` exists,
`ToString` never produces the uppercase form — with one stated exception,
`-0`, which `ToString` spells `0` and canonical DataJS spells `-0`;
bigints as full digits + `n`; canonical string escaping is exactly
ECMAScript's `QuoteJSONString` — what `JSON.stringify` emits for a string:
the minimal escapes `\"` `\\` `\b` `\t` `\n` `\f` `\r`, other control
characters as `\u00`·two lowercase hex digits, unpaired surrogates as
lowercase `\uXXXX`, everything else literal and `/` never escaped — again a
deterministic algorithm the spec restates rather than a "minimal escaping"
adjective). The serializer's
*input* is a programmatic value that is not frozen, so it must be validated
against the DataJS data model, and anything outside the model is rejected
as an error rather than approximated: a leaf outside the leaf set (a
function, a symbol, a `Date` or any other non-plain object), a sparse
array's hole (which is not an `undefined` element), a symbol-keyed or
accessor own property (reading a getter is an effect), and a cycle
(`value.self = value`) — DataJS represents DAGs only, and treating a
back-edge as sharing would emit a self-referencing `const $0={"self":$0};`,
a TDZ failure in JS. Rejection proofs in stage 4 cover each case. Normalization
is not a blocker for the format spec. The serializer cannot delegate numbers
to `JSON.stringify` (it loses `-0` and non-finite values); DataJS owns its
number writer. The canonical layout is **one line** — fully minified, with a single space
after each of `const`, `export` and `default` and nowhere else, so a root that
cannot merge still carries its space (`export default [1];`, never
`export default[1];`) — so normalization has zero
layout freedom, which is what byte-determinism (and any future content
addressing) needs. Tooling *defaults* to a human-readable layout (one
statement per line, indented containers), which is simply one of the many
valid non-normalized spellings; normalized output is requested explicitly.

**Extensions.** Recognized: `.data.js`, `.data.mjs`, `.d.js`, `.d.mjs`.
Emitted and canonical: `.data.js` (`.data.mjs` where unambiguous ESM
resolution matters). No `.f` combinations — `.f.[m]js` marks FunctionalScript
source, and every DataJS document is compiler-accepted by construction, so a
combined marker would encode a redundant fact.

### FunctionalScript consequences

- **`;` terminates every statement in early-stage FunctionalScript**,
  matching DataJS — and the part stage 5 must not miss is that a module's
  **final statement carries one too**, exactly as `export default value;` does.
  The obligation is one-way and it points the opposite way from an earlier
  draft of this bullet, which had the final statement unterminated:
  FunctionalScript has to *accept* a module whose last statement ends with `;`,
  or it rejects every valid DataJS document at its final export and the
  DataJS ⊂ FunctionalScript proof stage 6 owes cannot hold. Whether it *also*
  accepts an unterminated final statement is FunctionalScript's own call, being
  strictly more permissive. So stage 5's rule is `;` after each statement,
  never `;` between statements with EOF after the last — and this is the
  cheaper obligation of the two, since a parser requiring a terminator
  everywhere needs no end-of-input special case.
- This removes ASI entirely rather than most of it — both the hazardous half
  (the "no LineTerminator here" restricted productions, and a lone CR or
  U+2028 ending a statement, before the expression grammar grows the `(` and
  `[` line-start traps) and the end-of-input rule that an unterminated final
  statement would have leaned on. Relaxing later to also accept newline
  termination is backward-compatible; the reverse would be breaking, so
  strict-first is the safe ratchet. Repository `.f.mjs` source is unaffected
  (it is parsed by Node/TypeScript); the cost lands at `.f.mjs` → `.f.js`
  migration, where the normalizer inserts `;` mechanically — `.f.js` is
  compiler-formatted, not hand-formatted.
- **`undefined`, `NaN`, `Infinity` become FunctionalScript reserved words.**
  FunctionalScript accepts identifiers that do not start with `$`, so it needs
  the restriction for itself; DataJS no longer relies on inheriting it, its
  `$`-leading names making the collision unreachable.
- The parser's separator rule is `';'` only, and this landed ahead of the
  stage: `fjs/djs/parser`'s move to the LL(1) backend
  ([ebnf-migration](../fjs/todo/ebnf-migration.md), stage 6) dropped the
  newline terminator, since telling a newline from a `;` reached through
  newlines took unbounded lookahead, and `fjs/djs/serializer` writes the
  `;` after every statement. Stage 5 inherits the rule rather than making
  the change.
- **Whether FunctionalScript takes DataJS's positional whitespace rule is a
  stage-5 decision, and DataJS does not depend on the answer.** DataJS requires
  *more* whitespace than a merging-based rule would, so every DataJS document
  satisfies either, and the subset law holds whichever FunctionalScript picks.
  The question is worth asking there on its own merits: FunctionalScript has
  more keyword-adjacent-to-name sites (`import`, `from`, `as`, and whatever the
  expression grammar grows), and its identifiers do not start with `$`, so the
  cases DataJS gets for free — `truex` being a lexical error rather than
  `true` followed by a valid name — do not carry over.
- Subset laws are proof obligations, not prose: every DataJS *accept* vector
  parses in FunctionalScript to the same value graph; the normalizer closes
  the loop (`parse_datajs(normalize(m))` equals the evaluation of any
  data-only module `m`); FunctionalScript fixtures remain valid JS with
  identical meaning (checked against a real JS engine in proofs).

### Priority: stages 3 and 4 come first

Stages 3 and 4 are the urgent ones, ahead of the rest of this plan. They are
what [EDAG](./edag-spec.md) is waiting on. Stage 1b comes with them, between the
two — it is stage 4's proof source.

**Urgency is not the same as readiness, and stage 3b now separates them.** The
change of direction lowered its own issue to **P2**. It is still what stage 4
waits on, and it is startable — the lexical rules and the mapping engine
exist, though its token-stream grammar is not written, must match today's
tokenizer at a number's and a word's boundaries, and its mapping waits on
`string`'s pin — but what it
reports on malformed input is undecided, and `fjs/ebnf/` is mid-migration.
Design work, one type prerequisite and a moving dependency are poor reasons
to hold the
front of a queue, so the P1 urgency of this plan rests on stages 1b and 4.

An EDAG is an expression DAG whose sharing is *semantics*, not an encoding
detail: one node referenced from two operand positions is one value, and `{} ===
{}` is `false`, so a carrier that expands sharing changes the meaning of the
graph. Its serialized form is a DataJS module, because the EDAG's sharing
structure and DataJS's `const` structure are the same thing —
[edag-stage1-discussion](./edag-stage1-discussion.md). JSON cannot carry it, and
not marginally: it has no way to express sharing at all, and it also lacks the
`bigint` leaves EDAG's `Primitive` admits and loses `NaN`, `±Infinity` and
`-0`. Both directions are needed, not just writing — the incremental-compile
cache reads `.f.js` back, and the property that matters is that parsing a
serialized EDAG reproduces the same EDAG.

**Stage 3 is a dependency of stage 4 on the token-machine route only.**
DataJS's reader reuses parts of JSON's rather than restating them: strings
are JSON's unchanged, and DataJS's numbers are JSON's int/frac/exp core plus
a bigint suffix and `-Infinity` folding. Over a grammar that reuse is of
*rules* rather than of exported scanners, and the rules are already imported
— `fjs/ebnf/lib/datajs` exists — so the grammar route consumes nothing from
stage 3b. The token-machine route does: its token-stream grammar extends
JSON's and inherits the boundary resolution 3b owes. Either way stage 4 stays
close behind 3b, to keep the shared rules honest.

Stage 1b (the conformance vectors) is stage 4's other dependency, and not
stage 3's: it is stage 4's proof source, and its corpus is stored in JSON
exactly so it can exist before a DataJS reader does. So the dependencies are
1b before 4, and 3b before 4 on the token route — a relationship, not a queue.
An earlier draft wrote it as an intended order of 3, 1b, 4; that is withdrawn,
and the order work is picked up in is the next paragraph's.

**The execution order is 1b first, then 3b and 4 as stage 4's route decides.**
Stage 4's first task — choosing that route — waits on nothing and can run
beside 1b. On the token route stage 4's implementation follows 3b; on the
grammar route it needs only 1b's corpus and the `fjs/ebnf` items its issue
names, and 3b proceeds on its own P2 schedule. 1b never depended on stage 3:
the corpus bootstraps in JSON, and it is indifferent to whether the DataJS
reader that eventually consumes it is hand-written or generated from a
grammar. It is P1 where 3b is P2, it needs no decision that has not been made,
and running it early costs nothing — it still lands before stage 4, which is
the only ordering constraint it ever carried.

### Stages

Each stage lands green and independently; `fjs compile` keeps working
throughout.

1. **Spec** — `spec/datajs/`. The specification itself is **done**:
   [`spec/datajs/README.md`](../spec/datajs/README.md) carries the grammar,
   data model, const names, serialization and normalized form,
   the JSON and JavaScript relationships, and the rationale, and settles the media
   type by deferring to the existing dialect design in
   [`fjs/todo/group-fs-subdirectories-by-concern.md`](../fjs/todo/group-fs-subdirectories-by-concern.md):
   `text/javascript` with the dialect out of band, since RFC 9239 closes the
   JavaScript MIME list. The dialect segment DataJS takes in that chain is the
   one detail left to reconcile in that todo. The
   conformance vectors are the remaining half, tracked in
   [`spec/datajs/todo/conformance-vectors.md`](../spec/datajs/todo/conformance-vectors.md);
   stages 4 and 6 consume them — not stage 3, which is JSON's own tokenizer.
2. **Dead code — done.** `fjs/fsc/bnf.f.mjs` and `fjs/fsc/json.f.mjs` are
   deleted rather than salvaged: both were dead (no importer) and unproven,
   the JSON half duplicated `deterministic` in `fjs/bnf/testlib.f.mjs` rule
   for rule, and the FunctionalScript half encoded **newline-separated**
   statements (`fjsTail = option(['\n', ws0, fjs])`, `wsNoNewLine0`) — the
   design this plan replaces with `;`, so keeping it would have preserved a
   grammar contradicting the decision record above. Git history holds them if
   a future stage wants the `id`/`alpha`/comment rules.
3. **JSON's reader — 3a done, 3b open but not first; see above.** Two PRs:
   **3a** drops the fabricated `string` token that follows a malformed-literal
   error, in the existing wrapper, since that defect predates the replacement
   and is provable without it; **3b** replaces the `fjs/js/tokenizer` wrapper in
   `fjs/media/json/tokenizer` with a reader generated from JSON's own grammar
   over `fjs/ebnf/`, whose mapping builds **tokens** for the container machine
   in `fjs/media/json/parser`, which stays with both codecs and their
   `NumberPolicy` unchanged. **3b exports no scanners.** That seam belonged
   to the withdrawn hand-written design, and what replaces it is answered in
   code:
   rule reuse by ordinary import, as
   [`fjs/ebnf/lib/datajs`](../fjs/ebnf/lib/datajs/module.f.mjs) already does.
   Accepted-input proofs unchanged in both,
   but for one enumerated defect — the `n` an old number swallowed — which only
   3b can fix; error-shape proofs rewritten once, to shapes 3b has still to
   decide.
4. **`fjs/media/datajs` — urgent, see above; this is what EDAG needs.** Parser
   and serializer, proofs over the spec vectors.

   **Settled: the reader is the grammar, and it landed** —
   [`fjs/media/datajs/parser`](../fjs/media/datajs/parser/module.f.mjs) folds
   [`fjs/ebnf/lib/datajs`](../fjs/ebnf/lib/datajs/module.f.mjs) to a node per
   value and resolves the names over the statements, keeping the depth
   contract through an explicit stack; the container machine is retired for
   this format and the quoted seam work below is not owed. What follows
   records the question as it stood. The paragraph below describes the
   *other* route, written when a hand-written token-driven parser was the plan:

   > The parser reuses JSON's container machine, and today's seam is
   > **not wide enough for that**: `NumberPolicy` receives number tokens only,
   > `JsonToken` has no identifier/bigint/`=` tokens, and the object states
   > accept string keys only. Generalizing the seam is therefore explicit
   > stage-4 prerequisite work on `fjs/media/json/parser`: extend the token
   > vocabulary the machine can be fed, add the leaf/identifier policy hook
   > (JSON's instantiation: error) and the key-form hook (JSON's: string keys
   > only), and pin JSON's accepted language and behavior unchanged by proofs
   > across the API change.

   The two are not variants of one design. If the grammar maps straight to
   values, the container machine is not widened but **retired**, and that
   quoted work is wasted; if the grammar only produces tokens for it, the
   widening is still owed exactly as written. What is measured bears on it
   without settling it. Stage 3b took the token route for JSON because a
   value mapping breaks two contracts today's parser keeps: depth, since
   `rewrite` recurses per node and overflows at 1,000 nested arrays where the
   parser is proven at 5,000, and the `NumberPolicy` seam that gives the
   extended codec its `bigint`. DataJS owes the first — its values nest as
   JSON's do — and not the second: its grammar parses `1` and `1n` to
   distinct branches with every digit retained, so a mapping picks `Number`
   or `BigInt` from the branch, and the format has one numeric domain where
   the seam exists for two codecs over one grammar. What it does share with
   3b is the alphabet, UTF-16 code units, since its corpus carries lone
   surrogates that code-point decoding throws on. The grammar route has to
   keep depth through the mapping, on top of the recursive type DataJS's
   widened `value` thunk needs like JSON's; the token route keeps it by
   construction and is what today's code is shaped for.
   It is settled, above, and recorded in
   [its own issue](../fjs/media/datajs/todo/parser-serializer.md).

   The serializer is unaffected either way, since nothing generates one from a
   grammar. It is the shared walker of
   [157](../fjs/djs/todo/157-json-djs-shared-value-machine.md) §2 with a
   ref-lookup hook and DataJS's own number writer.
5. **Front-end move** — `fjs/djs/{tokenizer,parser,ast,transpiler}` →
   `fjs/fsc/*` as a rename. The rest of `fjs/djs` has stated destinations
   rather than following the rename: `serializer/` is reworked into stage
   4's `fjs/media/datajs` (it does not move to `fsc`); the value-tree types
   in `fjs/djs/types.ts` go with it, per
   [663](../fjs/djs/todo/663-json-djs-tree-type.md); `examples/` and the
   top-level `module.f.mjs`/`proof.f.mjs` carrying `compile()` move with
   the front end to `fsc`. Terminator `nl` → `';'` **after each** statement,
   the module's final one included (never `;` between statements with EOF
   after the last — see the FunctionalScript consequences above); reserved
   words added;
   the DataJS numeric leaves taught to the moved front end — `NaN`,
   `Infinity`, and `-Infinity` are unresolved identifiers in
   today's parser, so reserving the names alone would *reject* DataJS accept
   vectors: their tokenizer, grammar, minus-folding, and AST/evaluation
   support is stage-5 work; exact `-0` already parses correctly (the
   tokenizer pins the `-0` lexeme and `parseFloat` preserves signed zero),
   so it needs a regression proof, not reimplementation (together the
   front-end half of
   [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md)'s
   special-number requirement), a precondition of stage 6's subset proofs;
   `fjs compile` repointed. The EDAG staging continues under the `fsc`
   name. This stage changes accepted public `.f.js` syntax (statement
   termination, newly reserved names), so its own PR carries the
   `**BREAKING CHANGES:**` changelog treatment for that behavior — it is
   not deferred to stage 7.
6. **Compiler output** — the normalizer: data-only FunctionalScript (imports
   resolved and inlined) to normalized DataJS or JSON, with the subset-law
   proofs above. DataJS output is total; JSON output is permitted only when
   every leaf has a JSON spelling and no graph sharing is lost — a value
   containing `undefined`, `NaN`, `±Infinity`, `bigint`, or a shared node
   is **rejected as an error**, never silently substituted or dropped,
   matching the validation policy of
   [json-bigint-serialization](../fjs/djs/todo/json-bigint-serialization.md).
   `bigint` is rejected even though its digits are spellable in JSON: the
   text `1` read back by the standard `.json` reader is the *number* `1`,
   so emitting `1n` as `1` would silently change the value's type — the
   extended codec's bigint output remains available only as a caller's
   explicit, so-labeled choice, never the normalizer's `.json` default.
   Rejection proofs cover each unrepresentable leaf and the shared-node
   case.
7. **Cleanup** — retire `fjs/js/tokenizer` when its last consumer is gone
   (`fjs/js/string_escape` and `fjs/js/keywords` remain as shared,
   JS-spec-frozen tables); the clean-break release with `**BREAKING
   CHANGES:**` changelog treatment for the removed `fjs/djs/*` paths and
   changed serializer output — no compatibility shims. (Each earlier stage
   that changes public behavior, stage 5 in particular, carries its own
   breaking-change entry in its own PR, per the changelog convention.)

### Tasks

- [x] Stage 1a: write `spec/datajs/README.md`; disambiguate the older "DJS"
      in [`spec/README.md`](../spec/README.md), which names the wider subset
      the compiler accepts today.
- [ ] Stage 1b: the conformance vectors —
      [`conformance-vectors`](../spec/datajs/todo/conformance-vectors.md).
      **Next, and actionable now**: the only constraint it carries is landing
      **before stage 4**, which consumes it, since landing stage 4 first means
      writing its proofs twice. It was sequenced after stage 3 for convenience
      rather than dependency, and it goes first because it is P1 where 3b is
      P2 with its error shapes undecided. The corpus bootstraps in JSON so it
      needs no DataJS reader to exist.
- [x] Stage 2: dead `fjs/fsc` grammar deleted; its todo file removed and the
      citations in [207](../fjs/bnf/todo/207-bnf-semantic-actions.md)
      repointed at `fjs/bnf/testlib.f.mjs`.
- [x] Stage 3a: drop the fabricated `string` token in the existing wrapper —
      [`self-contained-tokenizer`](../fjs/media/json/todo/self-contained-tokenizer.md),
      the defect that predates the replacement and is provable without it.
- [ ] Stage 3b: the reader comes from a grammar over `fjs/ebnf/`, not from a
      hand-written scanner. **Startable but not first**: the lexical rules
      exist at `fjs/ebnf/lib/json` and `fjs/ebnf/ll1` folds a rewrite set
      into the parse — the token-stream grammar 3b runs, over UTF-16 code
      units, is still to be written and made to match today's at a number's
      and a word's boundaries; its mapping builds **tokens** for the container
      machine that stays and
      needs `string`'s pin from
      widened-rule-signatures (closed)
      first — so this is no longer blocked on
      [#1890](https://github.com/functionalscript/functionalscript/pull/1890) —
      that channel buys better errors than today's, not the ones owed. What is
      undecided is the error shapes, and `fjs/ebnf/` is mid-migration.
      A reader must compose EOF: `json` alone accepts `[1]x`.
      What is measured and still holds is the swap's blast radius: the accepted
      language is JSON's already, but for one defect — `1n1` and its class,
      accepted today by deleting an `n` from inside a number, which only 3b can
      fix — so beyond that only error shapes change. What replaces the
      hand-written seam is answered in code — rule reuse by import, as
      `fjs/ebnf/lib/datajs` already does — and what error shapes a
      grammar-driven reader should produce is the open question that issue
      lists.
- [ ] Stage 4: `fjs/media/datajs`; todo filed, reader landed on the grammar
      route. The byte path, the serializer and normalized form remain, with
      proofs over stage 1b's corpus as their source.
- [ ] Stage 5: front-end move to `fjs/fsc`; file its todo.
- [ ] Stage 6: normalizer + subset-law proofs; file its todo.
- [ ] Stage 7: `fjs/js/tokenizer` retirement and the breaking-change release.
- [ ] Update affected issues as their subject matter moves (see below).
- [ ] `tsc`, `fjs test` at every stage.

### Edits owed to existing issues

- [157-json-djs-shared-value-machine](../fjs/djs/todo/157-json-djs-shared-value-machine.md)
  — §2's shared-walker extraction becomes stage 4 work; §3's minus-rewriter
  question is settled by stages 3–4: the folding is a parameterized helper
  whose strict JSON instantiation folds `-` before a number token only
  (JSON's acceptance unchanged), while DataJS's instantiation adds its own
  cases (`-Infinity`, negative bigint) — the extra sign forms never enter
  the JSON tokenizer. Rebase the issue on this plan or fold it in.
- [663-json-djs-tree-type](../fjs/djs/todo/663-json-djs-tree-type.md) — the
  shared `Tree<P>` instantiation targets `fjs/media/datajs`; rename paths.
- [bnf-grammar-single-owner](../fjs/bnf/todo/bnf-grammar-single-owner.md)
  — **re-scoped, and owed a second edit by the reversal above.** Its
  `fjs/media/json/grammar` proposal stays withdrawn and the `fjs/bnf` grammar
  still ships at `fjs/bnf/lib/json`, but the reason has changed: that path is
  no longer "a media codec may not depend on a grammar module at runtime",
  which is reversed. It is that `fjs/bnf` is the classical module being
  retired, so a runtime grammar belongs to `fjs/ebnf/` and arrives with stage
  3b. Until 3b lands the `fjs/bnf/lib/json` grammar remains an example
  rather than the codec's source, so nothing in that issue's current work
  changes — but its statement that **the media scanners stay hand-written** is
  withdrawn and must not be built on. Lowering the example onto
  `fjs/ebnf/unicode/` is **not** open there: it happens when the grammar is
  ported to `fjs/ebnf/lib` ([ebnf-migration](../fjs/todo/ebnf-migration.md)'s
  consumer port), and the classical original stays as it is until `bnf/` is
  deleted. What remains open is the shared lexical API
  #1817 shipped only partly — parameterizing `string` over its simple escapes,
  exporting the digit rules, and pointing the tokenizer at them. The
  `fjs/djs/tokenizer` pointer becomes the `fsc` tokenizer,
  which stays grammar-based across the stage-5 rename.
- [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md) — its
  front-end paths move `djs` → `fsc` in stage 5, while its serializer
  citation (`../serializer/module.f.mjs`) follows the serializer into
  stage 4's `fjs/media/datajs`; its special-number round-trip
  requirement is satisfied by the DataJS spec rather than DJS-specific
  patches.
- `orphaned-json-grammar` — **done**: resolved by stage 2 and its file
  deleted with the code it described.
- `fjs/djs/README.md` and the remaining `fjs/djs/todo/*` files — move with
  their subject matter in stage 5; the DJS name in them refers to the moved
  front end, not to DataJS.

### Related

- [`fjs/media/json/README.md`](../fjs/media/json/README.md) — the policy-seam
  parser design DataJS layers on.
- [`fjs/djs/parser/README.md`](../fjs/djs/parser/README.md) — the front end
  that moves to `fjs/fsc`.
- [`todo/edag-stage1-discussion.md`](./edag-stage1-discussion.md),
  [`todo/edag-spec.md`](./edag-spec.md) — EDAG semantics the moved front end
  compiles to; serialized EDAG spells object constructors as arrays, so
  DataJS's JS-derived object semantics do not conflict with EDAG's ordered
  entries.
- [`fjs/fsc/README.md`](../fjs/fsc/README.md) — the `.f.mjs` → `.f.js`
  migration where the `;` requirement lands.
- [`fjs/fsc/README.md`](../fjs/fsc/README.md) — the repository-wide source
  migration this plan slots into. (Its stage-1 issue,
  `todo/migrate-typescript-to-mjs.md`, was deleted when stage 1 finished.)
