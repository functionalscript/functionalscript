## bnf-grammar-single-owner. Lower the canonical JSON BNF grammar onto `bnf/unicode`

**Priority:** P4
**Status:** blocked
**Blocked by:** [Separate alphabet-specific BNF helpers](../../../bnf/todo/unicode-rules.md)

### Problem

The ownership question this issue opened with — *the JSON lexical grammar exists
in two places and neither copy is owned* — is answered. The canonical
deterministic grammar now lives at
[`fjs/bnf/lib/json/module.f.mjs`](../../../bnf/lib/json/module.f.mjs) with a
co-located `proof.f.mjs`, and `fjs/bnf/testlib.f.mjs`'s `deterministic()` is a
one-line delegation to it rather than a second copy.

What is still owed is the *alphabet* migration. That module was written against
the current API — `range`, `set`, `unicodeMax` imported from generic
`fjs/bnf/module.f.mjs`, and raw JavaScript strings (`'"'`, `'\\'`, `'true'`)
used directly as `Rule` values. The blocking split removes both: text
interpretation moves to `fjs/bnf/unicode`, and `string` leaves the functional
`DataRule`. So the canonical grammar has an owner but sits on an API that is
going away.

**Do not create `fjs/media/json/grammar/module.f.mjs`.** That was this issue's
original proposal and it is withdrawn.
[parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
settles that the media codecs take **no runtime dependency** on `fjs/bnf`: the
canonical JSON grammar's owner is the spec text plus a proof-covered `fjs/bnf`
example, not a runtime module under `fjs/media/json`. A module there would
recreate exactly the duplication this issue existed to remove.

For the same reason `fjs/djs/tokenizer` — which moves to the `fsc` tokenizer in
the restructure's stage 5 — is **not** re-pointed at the shared rules. It stays
hand-written by decision
([self-contained-tokenizer](./self-contained-tokenizer.md)), and the spec, not
a shared runtime module, is what keeps it and the BNF example in agreement.

### Proposal

Rebase [`fjs/bnf/lib/json`](../../../bnf/lib/json/module.f.mjs) and
[`fjs/bnf/lib/datajs`](../../../bnf/lib/datajs/module.f.mjs) on the API the
alphabet split produces, keeping the boundary visible:

- generic grammar structure and combinators come from `fjs/bnf/module.f.mjs`;
- all JavaScript-string / Unicode-code-point interpretation comes from
  `fjs/bnf/unicode/module.f.mjs`;
- raw strings are not generic BNF rules. Text literals such as `"`, `\`, `/`,
  punctuation, keywords, and character sets are lowered through Unicode helpers
  before they enter the generic grammar.

Conceptually the imports should follow this boundary:

```ts
import {
    commaJoin0Plus, option, remove, repeat, repeat0Plus,
} from '../../module.f.mjs'
import {
    range, set, str, unicodeMax,
} from '../../unicode/module.f.mjs'
```

The exact helper names should follow the API produced by the blocking Unicode
split. The important constraint is the boundary: generic BNF does not regain
string semantics merely to make this grammar convenient.

The already-exported lexical pieces stay individually exported, so DataJS keeps
reusing the parts it does not extend — `digit`, `string`, `optionNeg`, `uint`,
`optionFloatSuffix`, `ws`, `wsSymbol`, `cj`, `array`, `object`, `createValue`,
`json`. `createValue(property, value)` already owns the common JSON value
structure while letting a caller supply its own property and value rules, which
is how `fjs/bnf/lib/datajs` adds bigint, `NaN`, `Infinity`, `undefined`, and
`$` references without restating the JSON value grammar.

Only share what is actually common. DataJS's number grammar is materially
different (bigint suffix, non-finite words), and it replaces the JSON number
branch rather than parameterizing it. Keep such rules local rather than forcing
a factory abstraction.

`fjs/bnf/testlib.f.mjs` keeps `classic()` as a BNF-local stress fixture — it is
the deliberately awkward json.org spelling, kept to exercise backtracking, not a
grammar anyone should consume. Its role is documented where it lives.

### Unicode migration requirements

Before implementing this TODO after the blocking split:

- [ ] Replace every core import of `range`, `set`, `unicodeMax`, `str`, or
      equivalent Unicode/text helpers in `fjs/bnf/lib/json` and
      `fjs/bnf/lib/datajs` with imports from `fjs/bnf/unicode/module.f.mjs`.
- [ ] Replace every raw string used as a generic BNF `Rule` with the appropriate
      Unicode helper construction. `fjs/bnf/lib/datajs` has one that must not be
      split by the lowering: `'["__proto__"]'` is a single exact token, and the
      spec forbids whitespace and escape substitutions inside it.
- [ ] Ensure generic combinators receive already-lowered rules/symbols and do not
      reintroduce hidden string interpretation into `fjs/bnf/module.f.mjs`.
- [ ] Re-point the rule **values** any transformer map keys on
      ([207](../../../bnf/todo/207-bnf-semantic-actions.md) keys by value, and
      lowering replaces rule values).
- [ ] Update proofs to make the generic-vs-Unicode boundary visible.

### Tasks

- [ ] Wait for [Separate alphabet-specific BNF helpers](../../../bnf/todo/unicode-rules.md)
      and rebase the two `fjs/bnf/lib` grammars on the resulting `bnf/unicode` API.
- [ ] Keep JSON-specific Unicode construction in `fjs/bnf/lib/json`; do not move
      it back into generic BNF and do not move it into `fjs/media/json`.
- [ ] Keep the exported readonly `Rule` / `Sequence` / `Variant` contracts on the
      shared pieces so a consumer cannot mutate a shared grammar singleton.
- [ ] Handle `deno.json` registration according to the repository's exports-map
      state, if and when a map exists; do not create a one-entry restrictive
      exports map solely for these files.
- [ ] `tsc`; run relevant BNF and JSON proofs/tests.

### Related

- [Separate alphabet-specific BNF helpers](../../../bnf/todo/unicode-rules.md) —
  **blocks this task** and defines where string/code-point constructors live.
- [`fjs/bnf/lib/json`](../../../bnf/lib/json/module.f.mjs),
  [`fjs/bnf/lib/datajs`](../../../bnf/lib/datajs/module.f.mjs) — the canonical
  grammars this task migrates.
- [self-contained-tokenizer](./self-contained-tokenizer.md) — why the JSON
  scanner stays hand-written and takes no runtime dependency on these grammars.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — shares JSON/DJS
  value machinery; orthogonal to the lexical BNF grammar.
- [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
  — media-directory ownership convention; the withdrawn `fjs/media/json/grammar`
  placement is no longer one of its exports-map dependents.
- [parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
  — the plan this task sits inside; its stage 2 deleted a third copy, and its BNF
  rule (grammars are spec text plus proof-covered `fjs/bnf` examples, never a
  runtime dependency of the codecs) is what withdrew this issue's original
  proposal.
