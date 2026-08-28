## Restructure JSON, DataJS, and FunctionalScript parsers/serializers

**Priority:** P2
**Status:** open

This is a coordinating issue: it records the design decided in discussion,
sequences the stages, and names the edits owed to existing issues. Each stage
gets its own co-located `todo/` file when it starts; concrete tasks live there,
not here.

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
- **`fjs/fsc`** — nearly empty: a character-classifier stub plus a dead third
  copy of the JSON grammar
  ([orphaned-json-grammar](../fjs/fsc/todo/orphaned-json-grammar.md)).
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

- **JSON**: accepted language and value semantics are frozen; the tokenizer
  becomes self-contained (the `fjs/js/tokenizer` wrapper is replaced by a
  small scanner of JSON's own lexical grammar). Error shapes may change once
  in that swap; accepted-input behavior and proofs do not.
- **DataJS** (the format known in this repository as DJS): a new, minimal,
  spec'd format — JSON extended from a tree to a DAG, nothing else. New
  hand-written parser and serializer in `fjs/media/datajs`, layered on JSON's
  exported pieces. Everything that is not needed for the DAG property moves to
  FunctionalScript.
- **FunctionalScript**: the current `fjs/djs` front end (grammar-based
  tokenizer, BNF parser, AST, transpiler) moves to `fjs/fsc` and continues to
  grow there — comments, imports, identifier keys, and the staged EDAG work.
  The compiler can emit DataJS (normalized) or JSON.
- **BNF is not a runtime dependency of the media codecs.** The spec carries
  the grammars as BNF text; `fjs/bnf/**` may hold the JSON and DataJS grammars
  as *proof-covered examples* cross-checked against the spec's test vectors.
  An example grammar without proof coverage is how
  [orphaned-json-grammar](../fjs/fsc/todo/orphaned-json-grammar.md) happened;
  none may be added without proofs.

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
one pass. The reference parser returns live JS values and does not freeze them
(FunctionalScript has no `Object.freeze`); the spec is silent on freezing and
other implementations may.

**Syntax.**

```text
module    ::= const* export
const     ::= 'const' id '=' value ';'
export    ::= 'export' 'default' value        (no trailing ';')
value     ::= primitive | id | array | object
key       ::= string | '[' '"__proto__"' ']'
```

- **`;` terminates every `const`;** no `;` after `export default`, no empty
  statements. Rationale, each sufficient alone: no line-terminator taxonomy in
  the spec (a lone CR *is* a JS `LineTerminator` — trivia no implementer
  should need); one canonical spelling per document; the separator is a
  visible character, so byte-different files that render identically cannot
  differ in meaning; and a document minifies to one line —
  `const a=[];export default[a,a]` — enabling DataJS inside JSON strings,
  line-delimited streaming, and one-line test fixtures. Whitespace is needed
  only between adjacent word-tokens (`const a`, `export default x`).
- **Whitespace is JSON's** — space, tab, LF, CR — insignificant everywhere.
  Other JS whitespace (U+2028/U+2029, NBSP, FF, BOM) is rejected.
- **No comments, no imports.** A DataJS document is closed; the compiler
  inlines resolved imports when normalizing FunctionalScript to DataJS.
- **Strings and numbers are JSON's grammar.** Bigint is a production of its
  own, not a suffix on the number grammar: JSON's integer part (no fraction,
  no exponent, no leading zeros) followed by `n` — JS rejects `1.5n` and
  `1e2n`, so "number + `n`" would over-accept. `-` is not an operator: it
  folds into a following number, bigint, or `Infinity` token only (`-NaN`,
  `-undefined`, a bare `-` are rejected).
- **Keys** are JSON strings, plus the computed spelling `["__proto__"]` as the
  only way to write that one key; a bare or string `"__proto__"` key is
  rejected (JS would read it as prototype replacement).
- **Const names** are ASCII: `[A-Za-z_$][A-Za-z0-9_$]*`, each bound once,
  minus two exclusion sets. Every name JavaScript rejects as a binding
  identifier in module code (module code is strict) is excluded: the
  reserved words, including `import`, `export`, `let`, `yield`, `await`,
  and `static`, and the strict-mode-only bindings `eval` and `arguments` —
  `const class = 1` and `const eval = 1` are JS syntax errors there, so
  accepting either would break the subset law. Binding `undefined`, `NaN`,
  or `Infinity` is additionally
  rejected — JS *permits* `const undefined = 5` and later `undefined` then
  means the const, which a subset treating it as a literal would silently
  reinterpret. The spec enumerates the excluded words exhaustively rather
  than citing ECMA-262.
- **Every JSON value is a DataJS value; no JSON document is a DataJS
  document** (a DataJS document is a JS module, so it cannot be a JSON
  document). The textual conversion `"export default " + json` yields a
  valid document with one exception: a bare `"__proto__"` object key —
  rejected by DataJS because JS reads it as prototype replacement — must be
  rewritten to the computed spelling `["__proto__"]` during conversion.
  Plain concatenation is exactly valid for JSON containing no `__proto__`
  key.

**Serialization.** Any conforming serializer may emit any valid document; a
separate *normalized form* section defines one byte-deterministic canonical
serializer (a const emitted
iff its value is an object or array referenced more than once **by reference
identity**; consts are emitted in **post-order of one depth-first traversal**
of the root value — arrays in element order, objects in observable key
order, each shared node descended into only on first encounter — with names
`_0`, `_1`, … assigned in emission order, so a shared node's dependencies
are always declared before it and "who is `_0`" has exactly one answer:
for `root = [parent, parent, child]` with `child` inside `parent`, `child`
finishes first and is `_0`, `parent` is `_1`; primitives are always emitted
inline and never hoisted, since
primitive sharing is unobservable and a value-equality ref counter would
face the `0`/`-0` and `NaN` merging ambiguity that the `Object.is`
round-trip guarantee forbids; the canonical number spelling is exactly
ECMAScript's `ToString(Number)` — a fully deterministic algorithm the spec
restates, so no "shortest spelling" tie such as `1e3` vs `1E3` exists,
`ToString` never produces the uppercase form — with one stated exception,
`-0`, which `ToString` spells `0` and canonical DataJS spells `-0`;
bigints as full digits + `n`; fixed string escaping). The serializer's
*input* is a programmatic value that is not frozen and may be cyclic
(`value.self = value`); DataJS represents DAGs only, so the serializer
detects cycles and rejects them as an error — never emitting a
self-referencing `const _0={"self":_0};` (a TDZ failure in JS) and never
recursing unboundedly — with rejection proofs in stage 4. Normalization
is not a blocker for the format spec. The serializer cannot delegate numbers
to `JSON.stringify` (it loses `-0` and non-finite values); DataJS owns its
number writer. The canonical layout is **one line** — fully minified, with
whitespace only where two word-tokens meet — so normalization has zero
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

- **`;` is required in early-stage FunctionalScript**, matching DataJS. This
  removes ASI — including its future "no LineTerminator here" restricted
  productions — before the expression grammar grows the hazards (`(`, `[` at
  line start). Relaxing later to also accept newline termination is
  backward-compatible; the reverse would be breaking, so strict-first is the
  safe ratchet. Repository `.f.mjs` source is unaffected (it is parsed by
  Node/TypeScript); the cost lands at `.f.mjs` → `.f.js` migration, where the
  normalizer inserts `;` mechanically — `.f.js` is compiler-formatted, not
  hand-formatted.
- **`undefined`, `NaN`, `Infinity` become FunctionalScript reserved words**,
  so the DataJS binding restriction is inherited rather than special-cased.
- The moved parser's separator rule changes from newline to `';'` (the moved
  tokenizer's operator vocabulary gains `;`).
- Subset laws are proof obligations, not prose: every DataJS *accept* vector
  parses in FunctionalScript to the same value graph; the normalizer closes
  the loop (`parse_datajs(normalize(m))` equals the evaluation of any
  data-only module `m`); FunctionalScript fixtures remain valid JS with
  identical meaning (checked against a real JS engine in proofs).

### Stages

Each stage lands green and independently; `fjs compile` keeps working
throughout.

1. **Spec** — `spec/datajs/`: format spec (grammar as BNF text, data model,
   rationale) plus the normalization section, and the conformance test
   vectors (accept, reject, round-trip) that every later stage runs against.
   Decides the one remaining deferred detail: the media type. (The
   canonical layout is decided: one line — see **Serialization** above.)
2. **Dead code** — delete `fjs/fsc/bnf.f.mjs` and `fjs/fsc/json.f.mjs`, or
   convert the salvageable parts into proof-covered `fjs/bnf/**` examples.
   Resolves [orphaned-json-grammar](../fjs/fsc/todo/orphaned-json-grammar.md).
3. **JSON self-contained tokenizer** — replace the `fjs/js/tokenizer` wrapper
   in `fjs/media/json/tokenizer` with a scanner of JSON's own lexical
   grammar, exporting the string and number scanners for reuse.
   Accepted-input proofs unchanged; error-shape proofs rewritten once.
4. **`fjs/media/datajs`** — parser (JSON's container machine via its policy
   seam, plus an identifier policy) and serializer (the shared walker of
   [157](../fjs/djs/todo/157-json-djs-shared-value-machine.md) §2 with a
   ref-lookup hook, own number writer), proofs over the spec vectors.
5. **Front-end move** — `fjs/djs/{tokenizer,parser,ast,transpiler}` →
   `fjs/fsc/*` as a rename. The rest of `fjs/djs` has stated destinations
   rather than following the rename: `serializer/` is reworked into stage
   4's `fjs/media/datajs` (it does not move to `fsc`); the value-tree types
   in `fjs/djs/types.ts` go with it, per
   [663](../fjs/djs/todo/663-json-djs-tree-type.md); `examples/` and the
   top-level `module.f.mjs`/`proof.f.mjs` carrying `compile()` move with
   the front end to `fsc`. Separator `nl` → `';'`; reserved words added;
   the DataJS numeric leaves taught to the moved front end — `NaN`,
   `Infinity`, `-Infinity`, and exact `-0` are unresolved identifiers in
   today's parser, so reserving the names alone would *reject* DataJS accept
   vectors: tokenizer, grammar, minus-folding, and AST/evaluation support is
   stage-5 work (the front-end half of
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

- [ ] Stage 1: write `spec/datajs/` and the conformance vectors; file its
      co-located todo.
- [ ] Stage 2: resolve
      [orphaned-json-grammar](../fjs/fsc/todo/orphaned-json-grammar.md).
- [ ] Stage 3: JSON self-contained tokenizer; file its todo under
      `fjs/media/json/todo/`.
- [ ] Stage 4: `fjs/media/datajs`; file its todo.
- [ ] Stage 5: front-end move to `fjs/fsc`; file its todo.
- [ ] Stage 6: normalizer + subset-law proofs; file its todo.
- [ ] Stage 7: `fjs/js/tokenizer` retirement and the breaking-change release.
- [ ] Update affected issues as their subject matter moves (see below).
- [ ] `npx tsc`, `fjs test` at every stage.

### Edits owed to existing issues

- [157-json-djs-shared-value-machine](../fjs/djs/todo/157-json-djs-shared-value-machine.md)
  — §2's shared-walker extraction becomes stage 4 work; §3's minus-rewriter
  question is settled by stage 3 (the folding lives in JSON's own tokenizer
  and DataJS reuses it). Rebase the issue on this plan or fold it in.
- [663-json-djs-tree-type](../fjs/djs/todo/663-json-djs-tree-type.md) — the
  shared `Tree<P>` instantiation targets `fjs/media/datajs`; rename paths.
- [bnf-grammar-single-owner](../fjs/media/json/todo/bnf-grammar-single-owner.md)
  — re-scope: the canonical JSON grammar's owner is the spec (text) plus a
  proof-covered `fjs/bnf` example, not a runtime module; the
  `fjs/djs/tokenizer` pointer becomes the `fsc` tokenizer.
- [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md) — its
  front-end paths move `djs` → `fsc` in stage 5, while its serializer
  citation (`../serializer/module.f.mjs`) follows the serializer into
  stage 4's `fjs/media/datajs`; its special-number round-trip
  requirement is satisfied by the DataJS spec rather than DJS-specific
  patches.
- [orphaned-json-grammar](../fjs/fsc/todo/orphaned-json-grammar.md) —
  resolved by stage 2.
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
- [`todo/migrate-typescript-to-mjs.md`](./migrate-typescript-to-mjs.md) — the
  repository-wide source migration this plan slots into.
