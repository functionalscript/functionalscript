## bnf-grammar-single-owner. The JSON BNF grammar has no owner

**Priority:** P4
**Status:** blocked
**Blocked by:** [Separate alphabet-specific BNF helpers](../../../bnf/todo/unicode-rules.md)

### Problem

The JSON lexical grammar, written with `fjs/bnf` combinators, exists in two
places, and neither copy is owned by `fjs/media/json`:

- `fjs/bnf/testlib.f.mjs` contains the deterministic JSON grammar used by BNF
  proofs plus the deliberately awkward `classic()` json.org fixture;
- `fjs/djs/tokenizer/module.f.mjs` restates much of the JSON lexical grammar and
  extends it for DJS.

Two, not three: a dead third copy at `fjs/fsc/json.f.mjs` was deleted rather
than given an owner, so this inventory is complete as written.

The duplicated digit/string rules have no single owner, while `fjs/bnf` itself
should remain grammar tooling rather than the home of a concrete media grammar.

This design originally imported Unicode helpers such as `range`, `set`, and
`unicodeMax` from generic `fjs/bnf/module.f.mjs` and used raw JavaScript strings as
`Rule` values. That API is removed by the blocking alphabet-specific BNF split.
Do not implement this TODO against the old API.

### Proposal

Give the canonical grammar an owner at:

```text
fjs/media/json/grammar/module.f.mjs
```

The dependency direction remains:

```text
fjs/media/json/grammar -> fjs/bnf + fjs/bnf/unicode
```

After the alphabet split:

- generic grammar structure/combinators come from `fjs/bnf/module.f.mjs`;
- all JavaScript-string / Unicode-code-point interpretation comes from
  `fjs/bnf/unicode/module.f.mjs`;
- raw strings are not generic BNF rules. Text literals such as `"`, `\`, `/`,
  punctuation, keywords, and character sets must be lowered through Unicode
  helpers before they enter the generic grammar.

Conceptually the imports should follow this boundary:

```ts
import {
    commaJoin0Plus, option, remove, repeat, repeat0Plus,
    type Rule, type Variant,
} from '../../../bnf/module.f.mjs'
import {
    range, set, str, unicodeMax,
} from '../../../bnf/unicode/module.f.mjs'
```

The exact helper names should follow the API produced by the blocking Unicode
split. The important constraint is ownership: generic BNF does not regain string
semantics merely to make this grammar convenient.

Export the genuinely shared lexical pieces individually so DJS can reuse the
parts it does not extend:

```ts
export const onenine: Rule
export const digit: Rule
export const digits0: Rule
export const digits: Rule
export const string = (simpleEscapes: Variant): Rule => /* Unicode helpers */
export const json: Rule
```

`string(simpleEscapes)` still owns the common JSON string structure, including
`\uXXXX`, while allowing callers to choose names for the simple-escape variant
branches. The canonical JSON caller and DJS tokenizer can therefore preserve
their existing tag differences without duplicating the whole string grammar.

Only share what is actually common. DJS's number grammar is materially different
(bigint suffix, error tagging, identifier-boundary handling), and DJS whitespace
is newline-sensitive. Keep those DJS-specific rules local rather than forcing a
factory abstraction.

`fjs/bnf/testlib.f.mjs` may keep `classic()` as a BNF-local stress fixture, but the
canonical deterministic JSON grammar should come from `fjs/media/json/grammar`.
Document why `classic()` remains local if it stays.

### Unicode migration requirements

Before implementing this TODO after the blocking split:

- [ ] Replace every old core import of `range`, `set`, `unicodeMax`, `str`, or
      equivalent Unicode/text helpers with imports from
      `fjs/bnf/unicode/module.f.mjs`.
- [ ] Replace every raw string used as a generic BNF `Rule` with the appropriate
      Unicode helper construction.
- [ ] Ensure generic combinators receive already-lowered rules/symbols and do not
      reintroduce hidden string interpretation into `fjs/bnf/module.f.mjs`.
- [ ] Update examples/proofs to make the generic-vs-Unicode boundary visible.

### Tasks

- [ ] Wait for [Separate alphabet-specific BNF helpers](../../../bnf/todo/unicode-rules.md)
      and rebase this grammar on the resulting `bnf/unicode` API.
- [ ] Create `fjs/media/json/grammar/module.f.mjs` with the standard `@module`
      header and proof coverage.
- [ ] Export the shared digit rules, parameterized JSON string rule, and complete
      canonical JSON grammar.
- [ ] Keep JSON-specific Unicode construction in `fjs/media/json/grammar` using
      `fjs/bnf/unicode`; do not move it back into generic BNF.
- [ ] Point `fjs/bnf/testlib.f.mjs` deterministic JSON use at this module (or remove
      that wrapper and update proof importers); document the role of `classic()`.
- [ ] Point `fjs/djs/tokenizer/module.f.mjs` at the shared digit/string rules while
      keeping DJS-specific number/whitespace/token rules local.
- [ ] Handle `deno.json` registration according to the repository's exports-map
      state when this module is implemented; do not create a one-entry restrictive
      exports map solely for this file.
- [ ] `tsc`; run relevant BNF, JSON, and DJS tokenizer proofs/tests.

### Related

- [Separate alphabet-specific BNF helpers](../../../bnf/todo/unicode-rules.md) —
  **blocks this task** and defines where string/code-point constructors live.
- [`fjs/djs/tokenizer`](../../../djs/tokenizer/module.f.mjs) — same single-source
  principle, already applied: `operatorTags` derives from the grammar's
  `operator` keys, and `wsChars`/`nlChars` feed both the grammar rules and every
  downstream trivia-tag check.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — shares JSON/DJS value machinery; orthogonal to
  ownership of the lexical BNF grammar.
- [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
  — media-directory ownership convention followed by this placement.
- [parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
  — the plan this task now sits inside; its stage 2 deleted the third copy, and
  its BNF rule (grammars are spec text plus proof-covered `fjs/bnf` examples,
  never a runtime dependency of the codecs) constrains where this one can land.
