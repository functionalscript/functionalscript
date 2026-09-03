## bnf-grammar-single-owner. Finish the canonical grammars' shared lexical API

**Priority:** P4
**Status:** blocked
**Blocked by:** [Separate alphabet-specific BNF helpers](./unicode-rules.md)

### Problem

The ownership question this issue opened with — *the JSON lexical grammar exists
in two places and neither copy is owned* — is answered. The canonical
deterministic grammar now lives at
[`fjs/bnf/lib/json/module.f.mjs`](../lib/json/module.f.mjs) with a
co-located `proof.f.mjs`, and `fjs/bnf/testlib.f.mjs`'s `deterministic()` is a
one-line delegation to it rather than a second copy.

Two things are still owed, and they belong to different changes.

The module was written against the current API — `range`, `set`, `unicodeMax`
imported from generic `fjs/bnf/module.f.mjs`, and raw JavaScript strings
(`'"'`, `'\\'`, `'true'`) used directly as `Rule` values. The blocking split
removes both: text interpretation moves to `fjs/ebnf/unicode`, and `string`
leaves the functional `DataRule`. That **port is the split's own**, not this
issue's — it breaks these grammars, so it fixes them in the same change. This
issue records what the port has to preserve.

What is left for this issue is the shared lexical API itself, which #1817 shipped
only partly: `string` is not parameterized over its simple escapes, so a second
caller cannot keep its own branch tags; `onenine`, `digits0` and `digits` are
private, so "reuse the digit rules" has nothing to import; and the `fsc`
tokenizer is not pointed at any of it. None of that is alphabet work, but all of
it is easier to land once the split has settled the names.

**Do not create `fjs/media/json/grammar/module.f.mjs`.** That was this issue's
original proposal and it is withdrawn.
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
settles that the media codecs take **no runtime dependency** on `fjs/bnf`: the
canonical JSON grammar's owner is the spec text plus a proof-covered `fjs/bnf`
example, not a runtime module under `fjs/media/json`. A module there would
recreate exactly the duplication this issue existed to remove.

That is also why this file moved here from `fjs/media/json/todo/`. Everything it
still describes — the two `fjs/bnf/lib` grammars and the `fjs/ebnf/unicode` API they
must move onto — lives under `fjs/bnf`, and it now rules out adding any code at
all under `fjs/media/json`, so a reader of the media codec's `todo/` would find
nothing here to act on.

That constraint is on the **media codecs**, and only them. Their scanners stay
hand-written and take no runtime dependency on `fjs/bnf`
([self-contained-tokenizer](../../media/json/todo/self-contained-tokenizer.md)
covers the JSON one), so for those the spec — not a shared module — is what
keeps them and the BNF example in agreement.

The compiler front end is the opposite case and keeps this issue's original
task. `fjs/djs`'s tokenizer is already grammar-based
([parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)),
and stage 5 moves it to `fjs/fsc` as a **rename**, BNF dependency intact. So
pointing it at the shared digit and string rules — while its DJS-specific
number, whitespace, and token rules stay local — remains live work; only the
path changes, from `fjs/djs/tokenizer` to the `fsc` tokenizer.

### Proposal

When the split rebases [`fjs/bnf/lib/json`](../lib/json/module.f.mjs) and
[`fjs/bnf/lib/datajs`](../lib/datajs/module.f.mjs) onto the API it produces, the
boundary it must leave visible is:

- generic grammar structure and combinators come from the front end —
  `fjs/bnf/module.f.mjs` for the classical grammars, `fjs/ebnf/module.f.mjs`
  once [ebnf-migration](../../todo/ebnf-migration.md) ports them;
- all JavaScript-string / Unicode-code-point interpretation comes from
  `fjs/ebnf/unicode/module.f.mjs`, which that plan creates at that path
  directly;
- raw strings are not generic BNF rules. Text literals such as `"`, `\`, `/`,
  punctuation, keywords, and character sets are lowered through Unicode helpers
  before they enter the generic grammar.

Conceptually the imports should follow this boundary. The relative paths
differ before and after the port, so both are spelled out — a single block
mixing them resolves to nothing at either point.

**Before the port**, from `fjs/bnf/lib/json/`, if a classical grammar
chooses to take its text helpers from `fjs/ebnf/unicode/` once that exists
(allowed, never required):

```ts
import {
    commaJoin0Plus, option, remove, repeat0Plus,
} from '../../module.f.mjs'                        // fjs/bnf
import {
    range, set, str, unicodeMax,
} from '../../../ebnf/unicode/module.f.mjs'        // fjs/ebnf/unicode
import { repeat } from '../../../types/array/module.f.mjs'
```

The classical library never moves: under
[ebnf-migration](../../todo/ebnf-migration.md) it is ported to
`fjs/ebnf/lib/json/` when its consumers move, and deleted with `bnf/`. The
rule, rather than a third block: the Unicode path is fixed once
`fjs/ebnf/unicode/` exists, and the front-end path is that of the front end
the grammar is written against.

**After the port** to `fjs/ebnf/lib/json/`, against the EBNF front end:

```ts
import {
    commaJoin0Plus, option, remove, repeat0Plus,
} from '../../module.f.mjs'                        // fjs/ebnf
import {
    range, set, str, unicodeMax,
} from '../../unicode/module.f.mjs'                // fjs/ebnf/unicode
import { repeat } from '../../../types/array/module.f.mjs'
```

`repeat` is in that third line rather than the first because the split does not
touch it: [#1817](https://github.com/functionalscript/functionalscript/pull/1817)
already moved it out of `fjs/bnf` to `types/array` as a breaking change, so it
is an array helper today and stays one afterwards. Only `str` is a name this
split introduces.

The other helper names should follow the API the Unicode split produces. The
important constraint is the boundary: generic BNF does not regain string
semantics merely to make this grammar convenient.

The already-exported lexical pieces stay individually exported, so DataJS keeps
reusing the parts it does not extend — `digit`, `string`, `optionNeg`, `uint`,
`optionFloatSuffix`, `ws`, `wsSymbol`, `cj`, `array`, `object`, `createValue`,
`json`. `createValue(property, value)` already owns the common JSON value
structure while letting a caller supply its own property and value rules, which
is how `fjs/bnf/lib/datajs` adds bigint, `NaN`, `Infinity`, `undefined`, and
`$` references without restating the JSON value grammar.

`string` needs the same treatment before a third caller can reuse it, and does
not have it yet. It hard-codes its simple escapes as `set('"\\/bfnrt')`, so the
branch tag for an escaped `/` is `/` — and `fjs/djs/tokenizer` deliberately
spells that branch `solidus: '/'` instead, because `'/'` is already an operator
tag there and `filterFunc` keeps every member of `operatorTags`. Handing that
tokenizer JSON's `string` as-is would make `"\/"` flatten the slash into an
operator token and split the string. So the shared piece is a
`string(simpleEscapes)` taking the simple-escape variant as a parameter — it
still owns the structure, including `\uXXXX` — and each caller names its own
branches. That parameterization was this issue's original design; it is
restated here because the shipped `string` does not have it.

Only share what is actually common. DataJS's number grammar is materially
different (bigint suffix, non-finite words), and it replaces the JSON number
branch rather than parameterizing it. Keep such rules local rather than forcing
a factory abstraction.

`fjs/bnf/testlib.f.mjs` keeps `classic()` as a BNF-local stress fixture — it is
the deliberately awkward json.org spelling, kept to exercise backtracking, not a
grammar anyone should consume. That is *not* written down where it lives:
`classic()` carries a bare `@type` annotation and nothing else, so a reader who
finds it next to a one-line `deterministic()` has no way to tell it is kept on
purpose. Saying so beside the code is still owed.

### The post-recognition pass is documented but unowned

Recorded here because this issue is the owner of record for both grammars, not
because this issue implements it.

`../lib/datajs/module.f.mjs`'s header specifies a pass that runs after grammar
recognition and before a parsed result is returned: decode string-key escapes
and reject a decoded `__proto__`, resolve references against earlier `const`
declarations, reject a duplicate `const`, and fail on an unresolved reference.
[`spec/datajs/README.md`](../../../spec/datajs/README.md) and
`../lib/datajs/README.md` say the same. Nothing implements it, and no open task
owns it.

The grammars are recognizers, so a recognizer accepting these is correct
behavior rather than a bug in the rule set — but every input the documentation
calls invalid is accepted today. Measured against `dataJs` through
`descentParser`, each of these matches to the end of input:

```js
export default {"__proto__":5};              // README calls this invalid
export default {"\u005f_proto__":5};         // README calls this invalid
const $x=1;const $x=2;export default $x;     // duplicate const
export default $nope;                        // unresolved reference
const $a=$b;const $b=1;export default $a;    // forward reference
```

The last one is worth separating: the spec derives acyclicity from references
naming only an *earlier* `const`, so a forward reference is not merely
unvalidated — accepting it is what would let a cycle be written at all.

No caller is wrong today because no parser returns these to anyone; the risk
arrives with the first one that does.
[`207-bnf-semantic-actions`](./207-bnf-semantic-actions.md) is where the
implementation belongs — it owns refusal as an engine channel, names the
`__proto__` key as a concrete use, and puts reference resolution in a second
pass over the built module. Whoever builds a DataJS parser on these grammars
implements the pass with it; shipping one that skips it would be
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)'s silence.

### Unicode migration requirements

These constrain the **split's own port**, not work that follows it. Removing
`range`, `set` and `unicodeMax` from core BNF and dropping `string` from the
functional `DataRule` breaks both grammars the moment it lands, so
[`unicode-rules`](./unicode-rules.md) ports them in the same change —
[AGENTS.md §5](../../../AGENTS.md) requires every importer updated in the PR
that breaks them, and `tsc` will not let it land otherwise. They are recorded
here because this issue owns these grammars, and whoever does that port should
read them first:

- [ ] Replace every core import of `range`, `set`, `unicodeMax`, `str`, or
      equivalent Unicode/text helpers in `fjs/bnf/lib/json` and
      `fjs/bnf/lib/datajs` with imports from `fjs/ebnf/unicode/module.f.mjs`.
- [ ] Replace every raw string used as a generic BNF `Rule` with the appropriate
      Unicode helper construction. For `fjs/bnf/lib/datajs`'s `'["__proto__"]'`
      that means exactly the contiguous sequence `str` lowers it to: `str`
      returns a sequence of terminal ranges for a multi-symbol string, and
      adjacency in that sequence is already what makes the key one token — no
      `ws` between elements, no escape substitution inside it. What the spec
      forbids is a whitespace or escape-tolerant *rule*, not a multi-element
      lowering; the key cannot stay a single terminal, since the parser's input
      is code points.
- [ ] Ensure generic combinators receive already-lowered rules/symbols and do not
      reintroduce hidden string interpretation into `fjs/bnf/module.f.mjs`.
- [ ] Re-point the rule **values** any transformer map keys on
      ([207](./207-bnf-semantic-actions.md) keys by value, and
      lowering replaces rule values).
- [ ] Update proofs to make the generic-vs-Unicode boundary visible.

### Tasks

- [ ] Wait for [Separate alphabet-specific BNF helpers](./unicode-rules.md),
      which ports both `fjs/bnf/lib` grammars onto `fjs/ebnf/unicode` as part of its
      own change, and check the result against the requirements above. What
      follows below is the design work that port does not settle.
- [ ] Keep JSON-specific Unicode construction in `fjs/bnf/lib/json`; do not move
      it back into generic BNF and do not move it into `fjs/media/json`.
- [ ] Keep the exported readonly `Rule` / `Sequence` / `Variant` contracts on the
      shared pieces so a consumer cannot mutate a shared grammar singleton.
- [ ] Parameterize `string` over its simple-escape variant, so a caller can name
      those branches. Required before the next task: the tokenizer's `solidus`
      tag is not cosmetic.
- [ ] Export the digit rules a caller actually needs. Only `digit` is exported
      today; `onenine`, `digits0`, and `digits` are private, so "reuse the shared
      digit rules" cannot be done as written. The original issue listed all four.
- [ ] Point the `fsc` tokenizer (`fjs/djs/tokenizer` until stage 5 renames it)
      at the shared digit and string rules, keeping its DJS-specific number,
      whitespace, and token rules local, and its own simple-escape branch names.
      It is grammar-based and stays so, so this is sharing rules with a BNF
      consumer, not giving a media codec a BNF dependency.
- [ ] Document `classic()`'s role beside it in `fjs/bnf/testlib.f.mjs`.
- [ ] Handle `deno.json` registration according to the repository's exports-map
      state, if and when a map exists; do not create a one-entry restrictive
      exports map solely for these files.
- [ ] Implement the post-recognition pass with
      [`207-bnf-semantic-actions`](./207-bnf-semantic-actions.md), or file it as
      its own issue, before any DataJS parser built on these grammars ships.
- [ ] `tsc`; run relevant BNF, JSON, and DJS/fsc tokenizer proofs/tests.

### Related

- [Separate alphabet-specific BNF helpers](./unicode-rules.md) —
  **blocks this task** and defines where string/code-point constructors live.
- [`fjs/bnf/lib/json`](../lib/json/module.f.mjs),
  [`fjs/bnf/lib/datajs`](../lib/datajs/module.f.mjs) — the canonical
  grammars this task migrates.
- [self-contained-tokenizer](../../media/json/todo/self-contained-tokenizer.md) — why the
  **media** JSON scanner stays hand-written and takes no runtime dependency on
  these grammars. It does not govern the compiler front end, whose tokenizer is
  grammar-based and stays so.
- [157](../../djs/todo/157-json-djs-shared-value-machine.md) — shares JSON/DJS
  value machinery; orthogonal to the lexical BNF grammar.
- [group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — media-directory ownership convention; the withdrawn `fjs/media/json/grammar`
  placement is no longer one of its exports-map dependents.
- [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
  — the plan this task sits inside; its stage 2 deleted a third copy, and its BNF
  rule (grammars are spec text plus proof-covered `fjs/bnf` examples, never a
  runtime dependency of the **media codecs**) is what withdrew this issue's
  original proposal. Its stage 5 renames the grammar-based front-end tokenizer
  into `fjs/fsc`, which is why this issue's tokenizer task survives with a new
  path rather than being withdrawn with the rest.
