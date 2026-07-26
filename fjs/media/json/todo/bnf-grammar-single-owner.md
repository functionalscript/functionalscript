## bnf-grammar-single-owner. The JSON BNF grammar has no owner

**Priority:** P4
**Status:** open

### Problem

The JSON lexical grammar, written in `fjs/bnf` combinators, exists in two
places, and neither of them is `fjs/media/json`:

- `fjs/bnf/testlib.f.ts:127-186` — `deterministic()`, a complete JSON grammar
  used only by proofs (`fjs/bnf/proof.f.ts`, `fjs/bnf/data/proof.f.ts`,
  `fjs/bnf/descent/proof.f.ts`, `fjs/bnf/ll1/proof.f.ts`). The same file also
  holds `classic()` (`:14-125`), a second JSON grammar transcribed from
  json.org.
- `fjs/djs/tokenizer/module.f.ts:64-140` — `buildToken()`, the production DJS
  token grammar, which restates the JSON lexical rules and extends them.

The overlap is verbatim in places:

```ts
// fjs/bnf/testlib.f.ts:129-157        // fjs/djs/tokenizer/module.f.ts:66-95
const onenine = range('19')            const onenine = range('19')
const digit: Rule = range('09')        const digit: Rule = range('09')
const digits0 = repeat0Plus(digit)     const digits0 = repeat0Plus(digit)
const digits = [digit, digits0]        const digits = [digit, digits0]
```

and near-verbatim for the ~20-line string rule (`fjs/bnf/testlib.f.ts:133-153`
vs. `fjs/djs/tokenizer/module.f.ts:70-91`), which differ only in how the solidus
escape is tagged — `set('"\\/bfnrt')` versus `set('"\\bfnrt')` plus an explicit
`solidus: '/'` branch, because the descent parser emits the matched branch's
*key* as the AST tag and DJS needs a stable name for it.

Two problems follow from there being no owner:

1. **`fjs/bnf` knows about JSON.** The BNF package is grammar *tooling* —
   `Rule` combinators, an LL(1) matcher, a descent parser, a data
   representation. A concrete JSON grammar is not part of that concern; it is
   there only because the proofs needed a realistic grammar to exercise. The
   membership rule already agreed for `fjs/media/` says a module belongs there
   iff it implements content whose identity is a media type — a JSON grammar is
   exactly that.
2. **A change to JSON's lexical rules has no single place to land.** The digit
   and string layers are maintained in two files that must be kept consistent by
   eye, and `fjs/bnf/testlib.f.ts` is the file least likely to be looked at when
   the format changes, since nothing outside proofs imports it.

### Proposal

Give the grammar an owner: a new `fjs/media/json/grammar/module.f.ts` exporting
the JSON grammar in `fjs/bnf` combinator form. Direction of dependency is
`fjs/media/json/grammar → fjs/bnf` (no cycle; `fjs/bnf` imports nothing from
`fjs/media/json`, and the current importers of the grammar are proofs, which may
import freely).

Export the shared lexical pieces individually, not just the whole grammar, so
the DJS tokenizer can consume the parts it does not extend:

```ts
// fjs/media/json/grammar/module.f.ts
import {
    range, remove, repeat, repeat0Plus, set, unicodeMax,
    type Rule, type Variant,
} from '../../../bnf/module.f.ts'

export const onenine: Rule
export const digit: Rule
export const digits0: Rule
export const digits: Rule

/**
 * A JSON string literal, parameterized by its simple-escape branches.
 *
 * `simpleEscapes` is the variant matched after the `\`, minus the `\uXXXX`
 * branch: branch name → the literal it matches. The descent parser emits the
 * matched branch's *key* as the AST tag, so this parameter is exactly "how are
 * the one-character escapes tagged" and nothing else.
 */
export const string = (simpleEscapes: Variant): Rule => [
    '"',
    repeat0Plus({
        ...remove(range(` ${unicodeMax}`), set('"\\')),
        escape: ['\\', { ...simpleEscapes, u: uEscape }],
    }),
    '"'
]

/** The whole deterministic JSON grammar (today `testlib.deterministic`). */
export const json: Rule

// private: `uEscape`, `number` and `ws` — used only to build the above
```

**The escape parameter, concretely.** No new type is needed: the parameter is
`bnf`'s existing `Variant` (`fjs/bnf/module.f.ts:61`,
`{ readonly [k in string]?: Rule }`), and `set` (`:137`) already returns
something assignable to it (`RangeVariant`, `:158`). The two call sites are then
the expressions they already are today:

| Caller | Argument | Why |
|---|---|---|
| `json` (canonical) | `set('"\\/bfnrt')` | tag = the matched character; what `fjs/bnf/testlib.f.ts:141` does today |
| `fjs/djs/tokenizer` | `{ ...set('"\\bfnrt'), solidus: '/' }` | a `/` tag would collide with the `/` operator tag in `filterFunc`, so that one branch is named (`:74-80` today) |

Scope of the parameter, so an implementer does not have to guess:

- It covers **all** simple escapes, not just the solidus. Both callers pass the
  complete set; the parameter is not a patch or an override map.
- It does **not** cover `\uXXXX`. Both callers tag that branch `u` and spell its
  body identically (`['u', ...repeat(4)({ digit, AF: range('AF'), af: range('af') })]`),
  so it stays private and fixed inside `string`.
- It does **not** cover the unescaped-character branch
  (`remove(range(` ${unicodeMax}`), set('"\\'))`) — identical in both callers.

`number` and `ws` stay **private**. They are needed to build `json`, but DJS
keeps its own versions of both (see the scope note below), so neither has an
external consumer — and `AGENTS.md` only admits an `export` once one exists.
Export them if and when a real importer appears.

Then:

- `fjs/bnf/testlib.f.ts` keeps `classic()` — a *deliberately* non-deterministic,
  json.org-shaped transcription whose purpose is to exercise the BNF machinery
  on an awkward grammar, not to describe JSON canonically — and imports
  `json` for `deterministic()`, or drops it entirely in favour of the new
  module. Whichever it is, decide it explicitly and say why in
  `fjs/bnf/README.md`.
- `fjs/djs/tokenizer/module.f.ts` imports `onenine`/`digit`/`digits0`/`digits`
  and the parameterized `string`, and keeps its own `number`, `ws`, `newLine`,
  `id` rules.

**Scope the sharing honestly.** Only the digit layer and the string rule are
genuinely common. DJS's `number` (`fjs/djs/tokenizer/module.f.ts:127-140`) is
materially different — it tags missing fraction/exponent digits as `numError`,
adds the `bigint` `n` suffix, and consumes a trailing identifier character as an
error rather than starting a new token — and DJS's whitespace is split into
`ws`/`newLine` because JS is newline-sensitive. Do **not** contort those into a
shared factory; sharing the four digit rules and one parameterized string rule
is the whole win, and it is enough to give the format an owner. If `string`
turns out to need more than the single `Variant` parameter specified above to
serve both callers, ship the digit layer alone and record why in the module's
JSDoc.

### Tasks

- [ ] Create `fjs/media/json/grammar/module.f.ts` with the `@module` header,
      exporting the lexical rules and the whole `json` grammar; add
      `fjs/media/json/grammar/proof.f.ts` with full coverage.
- [ ] `deno.json` registration is a **no-op today, and an obligation later**.
      `deno.json` currently holds only `tasks` and `fmt`, so there is no
      `exports` map for `AGENTS.md`'s registration rule to add an entry to, and
      creating one holding this single path would turn an unrestricted package
      into one exposing a single module — strictly worse than leaving it absent.
      This issue therefore adds no registration step. The obligation does not
      disappear: whichever change introduces the complete map
      ([group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md))
      must enumerate every `module.f.ts` then present, this one included, and
      that issue's task now says so.
- [ ] Point `fjs/bnf/testlib.f.ts`'s `deterministic()` at it (or delete
      `deterministic()` and update the four proof importers); document in
      `fjs/bnf/README.md` why `classic()` stays a bnf-local fixture.
- [ ] Point `fjs/djs/tokenizer/module.f.ts` at the shared digit rules and the
      parameterized `string`.
- [ ] `npx tsc` clean; `fjs t` passes (`fjs/bnf`, `fjs/bnf/data`,
      `fjs/bnf/descent`, `fjs/bnf/ll1`, `fjs/djs/tokenizer`).

### Related

- [vocabulary-single-source](../../../djs/tokenizer/todo/vocabulary-single-source.md)
  — the same "grammar is the single source of truth" argument, applied to the
  DJS *operator* vocabulary. Complementary: that issue derives token tags from
  the grammar; this one gives the grammar itself one home.
- [157](../../../djs/todo/157.md) — shares the JSON/DJS *value* machinery
  (parser, serializer). It notes the lexical engine `fjs/js/tokenizer` is
  already factored correctly; the BNF grammar layer above it is not.
- [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
  — the `fjs/media/` membership rule this placement follows.
