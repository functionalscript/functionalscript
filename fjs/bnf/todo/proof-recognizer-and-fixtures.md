## proof-recognizer-and-fixtures. Give the bnf proofs a shared recognizer helper and grammar fixtures

**Priority:** P3
**Status:** blocked
**Blocked by:** [Separate alphabet-specific BNF helpers](./unicode-rules.md)

### Problem

`fjs/bnf` already has the right home for shared proof material —
`fjs/bnf/testlib.f.mjs`, which owns the two JSON grammars (`classic`,
`deterministic`) that four proof files import. Three smaller pieces of the same
kind never made it there and are copy-pasted instead, across
`fjs/bnf/descent/proof.f.mjs`, `fjs/bnf/ll1/proof.f.mjs`, and
`fjs/djs/tokenizer/proof.f.mjs`.

This design predates the alphabet split. Its shared `number` fixture currently
constructs Unicode terminals with core `range('--')` / `range('09')`, and its
import analysis assumes `fjs/bnf/testlib.f.mjs` obtains text helpers from
`./module.f.mjs`. After the split, text/range construction belongs to
`fjs/grammar/unicode/module.f.mjs`. Do not implement the fixture extraction against
the old core API: rebase the fixture imports on `fjs/grammar/unicode` first while keeping
the recognizer backends themselves generic.

#### 1. The "recognizes the whole input" helper — 8 copies

Every recognizer test needs the same question answered: *did the parser accept
and consume all of the input?* It is spelled out inline eight times, in two
backend-specific shapes:

```ts
// descent shape — fjs/bnf/descent/proof.f.mjs:202, :228, :244
const expect = (s: string, expected: boolean) => {
    const cp = toArray(stringToCodePointList(s))
    const mr = descentParserCpOnly(m, '', cp)
    const success = mr.success && mr.idx === cp.length
    assertEq(success, expected, mr)
}

// ll1 shape — fjs/bnf/ll1/proof.f.mjs:198, :223, :238, :322
const expect = (s: string, success: boolean) => {
    const mr = m('', toArray(stringToCodePointList(s)))
    assertEq(mr[1] && mr[2]?.length === 0, success, mr)
}
```

The two backends read their results differently because their result *types*
differ: descent returns the record `DescentMatchResult`
(`fjs/bnf/descent/types.ts:52-57` — `{ ast, success, idx, failure? }`),
while ll1's `MatchResult` is still a tuple. Any adapter has to speak both.

`fjs/djs/tokenizer/proof.f.mjs:33` is an eighth site in the descent shape, with
`JSON.stringify([s, mr])` as its message instead of `mr`.

The copies have drifted in exactly the ways copies do: the start-rule name is
`''` in seven sites and `'value'` in one; `isSuccess` is a named local in three
ll1 sites and inline in the fourth; the failure message differs. None of these
differences is intentional.

The two shapes are the same predicate — *accepted, and the remainder is empty* —
differing only in how each backend reports the remainder. That difference belongs
in one adapter, not in eight test bodies.

#### 2. The `numberRule` mini-grammar — 8 copies plus 1 variant

The smallest interesting grammar in the tree, "an optional minus followed by one
digit", is rebuilt from scratch in every case that needs it:

```ts
const emptyRule = ''
const minusRule = range('--')
const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule }
const digitRule = range('09')
const numberRule = [optionalMinusRule, digitRule]
```

The fixture remains a Unicode/text fixture, so after the alphabet split the
`range` used here must come from `fjs/grammar/unicode/module.f.mjs` (or the equivalent
final Unicode adapter API), **not** from core `fjs/bnf/module.f.mjs`. The produced
rules are still ordinary generic BNF rules consumed by descent/LL1.

Four of the nine copies carry a `minursRule` typo. One site is a deliberate
variant that prefixes optional space; it should stay distinct rather than being
silently folded into the shared fixture.

#### 3. The JSON acceptance corpus — 20 cases, 3 copies

`fjs/bnf/descent/proof.f.mjs` and `fjs/bnf/ll1/proof.f.mjs` list the same 20 inputs
with the same verdicts; `fjs/djs/tokenizer/proof.f.mjs` repeats them plus DJS-token
specific cases. Six JSON-rejecting rows are intentionally accepted by the JS
/DJS token stream because tokenization leaves document structure to the parser.
That divergence should be an explicit override table rather than a copied corpus.

### Proposal

Move the shared harness and fixtures into a neutral testlib, after rebasing
text construction on the Unicode adapter. It is a **separate home** from
`classic()` and `deterministic()`: those stay in `fjs/bnf/testlib.f.mjs`, which
depends on the classical front end and which grammar-bucket moves in stage 5
and deletes in stage 8. Putting the neutral harness beside them would sink it
with that file; moving them into the neutral layer would drag the front end
along.

**1. One recognizer adapter per backend, one assertion helper over both.**

```ts
export type Recognition = {
    readonly accepted: boolean
    readonly diagnostic: unknown
}

export type Recognizer = (input: string) => Recognition

export const descentRecognizer = (ruleSet: RuleSet, entry: string): Recognizer => …
export const ll1Recognizer = (ruleSet: RuleSet, entry: string): Recognizer => …

export const assertRecognizes = (r: Recognizer) =>
    (cases: readonly Case[]): void => …
export type Case = readonly [string, boolean]
```

The recognizer must not collapse to a bare `boolean`: current assertions include
the backend match result as their diagnostic. `assertRecognizes` should report
`[input, diagnostic]` so failures identify both the corpus row and the parser
state.

The adapters take a `RuleSet` and its entry name, and call **no `toData`** —
that would reintroduce the front-end dependency
[grammar-bucket](../../todo/grammar-bucket.md) removes before its stage 5. The
entry is a parameter rather than derived or defaulted: the one grammar whose
root is `'value'` proves a hard-coded `''` is wrong, and a `RuleSet` does not
carry its own entry. `ll1Recognizer` builds via `parserRuleSet(ruleSet)` and
`descentRecognizer` via `descentParserRuleSet(ruleSet)`; both backends already
expose those, so no production API is added here.

The adapter also absorbs the file-local proof copy of `descentParserCpOnly`.
Keep the DJS tokenizer export: its proof has typed-result consumers beyond the
recognition corpus, so removing it would be a separate public-API change.

`stringToCodePointList` / `toArray` / code-point mapping stay inside the Unicode
recognizer adapter. The alphabet-specific conversion should be imported from the
Unicode boundary after `unicode-rules.md` lands; generic parser modules should
not regain text dependencies.

**2. `export const number`** — the optional-minus-then-digit grammar. Exported
as a **`RuleSet` plus its entry name**, not as a functional `Rule`: the
adapters take a rule set, so a functional fixture would put `toData` back at
every call site and restore in the fixture the front-end dependency the
adapters just dropped
([grammar-bucket](../../todo/grammar-bucket.md) requires it gone before its
stage 5). Author the rule set **directly** — converting a functional rule
"once, in the fixture" would make the shared testlib import `toData`, so every
backend proof using the fixture keeps a transitive front-end dependency. If a
functional spelling is wanted for readability, it belongs in a separate
front-end fixture that neutral backend proofs never import. Eight duplicate sites use
it; the optional-space variant stays local because it is genuinely a different
case.

**3. `export const jsonCases: readonly Case[]`** — the 20-row corpus with JSON
verdicts. Descent and LL1 consume it unchanged. DJS tokenizer consumes it with an
explicit named override list for the rows where token-stream acceptance differs.

### Tasks

- [ ] Keep everything here neutral, per the proposal above: adapters over
      `RuleSet` plus entry, fixtures authored as rule sets, and a testlib that
      survives. This issue is unblocked at
      [grammar-bucket](../../todo/grammar-bucket.md)'s stage 2, before that
      plan decouples the backend proofs for its stage 5, so anything
      front-end-coupled built here would be undone immediately or would block
      the stage-8 deletion.
- [ ] Wait for [the alphabet split](./unicode-rules.md), then rebase the
      testlib's text/range imports on `fjs/grammar/unicode/module.f.mjs`;
      do not import Unicode `range` from core `./module.f.mjs`.
- [ ] Add `Case`, `Recognition`, `assertRecognizes`, the two recognizer
      adapters, **and the AST renderer** — `showAst` plus the root
      `private.ts` that types it, which the LL1 and descent proofs assert
      with and which is backend-neutral — to a testlib that **survives the
      migration** — not
      `fjs/bnf/testlib.f.mjs`, which imports `./lib/json` and `./module.f.mjs`
      and which grammar-bucket stage 5 moves with the classical front end and
      stage 8 deletes. A neutral shared testlib beside the backends, or
      per-backend ones; confirm no import cycle.
- [ ] Carry each backend's `MatchResult` through as `Recognition.diagnostic` and
      report `[input, diagnostic]` from `assertRecognizes`.
- [ ] Take the entry name **alongside** the `RuleSet`, since a `RuleSet` holds
      neither the functional rule nor its entry — the caller that built it has
      both. No `toData` inside an adapter (that would reintroduce the `FRule`
      the first task removes) and no `''` default.
- [ ] Fold the proof-local `descentParserCpOnly` / code-point adapter into
      `descentRecognizer`; leave the DJS tokenizer's public export alone.
- [ ] Add `number` as a directly authored `RuleSet` and entry name — no
      functional `Rule`, no `toData` in the shared testlib — and add
      `jsonCases`.
- [ ] Convert descent and LL1 proofs; keep the optional-space grammar variant
      local and document why it is distinct.
- [ ] Convert the DJS tokenizer proof to `jsonCases` plus a named override list
      and its DJS-only inputs.
- [ ] Give the new testlib its own co-located `proof.f.mjs` covering every
      export, as any new `.f.mjs` owes. Downstream proofs happening to call it
      is not that coverage.
- [ ] Confirm coverage is unchanged — this must move test text, not test cases.
- [ ] Run `tsc` and `fjs t`.

### Related

- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — **blocks this
  task**; shared text fixtures must consume `fjs/grammar/unicode`, not the removed core
  text/range API.
- [bnf-grammar-single-owner](./bnf-grammar-single-owner.md) —
  owns the grammars themselves, now shipped under `fjs/bnf/lib`; this issue moves
  the proof harness/fixtures.
- [65Y-proof-assertEq-adoption](../../emergent_testing/todo/65y-proof-asserteq-adoption.md)
  — orthogonal assertion cleanup.
- `fjs/bnf/ll1/proof.f.mjs` / `fjs/bnf/descent/proof.f.mjs` `longInput` — the
  separate long-input regression corpus both matchers already carry.
- [the DJS parser](../../djs/parser/README.md) — token-symbol alphabet needs its own recognizer
  adapter, but can share `Case` / `assertRecognizes`.
- `fjs/bnf/descent/types.ts` `DescentFailure` — failure diagnostics compose
  through `Recognition.diagnostic`; do not collapse them to boolean.
