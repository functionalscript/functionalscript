## proof-recognizer-and-fixtures. Give the bnf proofs a shared recognizer helper and grammar fixtures

**Priority:** P3
**Status:** open

### Problem

`fjs/bnf` already has the right home for shared proof material —
`fjs/bnf/testlib.f.ts`, which owns the two JSON grammars (`classic`,
`deterministic`) that four proof files import. Three smaller pieces of the same
kind never made it there and are copy-pasted instead, across
`fjs/bnf/descent/proof.f.ts`, `fjs/bnf/ll1/proof.f.ts`, and
`fjs/djs/tokenizer/proof.f.ts`.

#### 1. The "recognizes the whole input" helper — 8 copies

Every recognizer test needs the same question answered: *did the parser accept
and consume all of the input?* It is spelled out inline eight times, in two
backend-specific shapes:

```ts
// descent shape — fjs/bnf/descent/proof.f.ts:185, :211, :227
const expect = (s: string, expected: boolean) => {
    const cp = toArray(stringToCodePointList(s))
    const mr = descentParserCpOnly(m, '', cp)
    const success = mr[1] && mr[2] === cp.length
    assertEq(success, expected, mr)
}

// ll1 shape — fjs/bnf/ll1/proof.f.ts:198, :223, :238, :322
const expect = (s: string, success: boolean) => {
    const mr = m('', toArray(stringToCodePointList(s)))
    assertEq(mr[1] && mr[2]?.length === 0, success, mr)
}
```

`fjs/djs/tokenizer/proof.f.ts:18` is an eighth site in the descent shape, with
`JSON.stringify([s, mr])` as its message instead of `mr`.

The copies have drifted in exactly the ways copies do: the start-rule name is
`''` in seven sites and `'value'` in one; `isSuccess` is a named local in one ll1
site (`:197`) and inline in the other three; the failure message differs. None
of these differences is intentional.

The two shapes are the same predicate — *accepted, and the remainder is
empty* — differing only in how each backend reports the remainder (an index
into the code points vs. a leftover list). That difference belongs in one
adapter, not in eight test bodies.

#### 2. The `numberRule` mini-grammar — 9 copies

The smallest interesting grammar in the tree, "an optional minus followed by
one digit", is rebuilt from scratch in every case that needs it —
`fjs/bnf/descent/proof.f.ts:150`, `:161`, `:172`, `:285` and
`fjs/bnf/ll1/proof.f.ts:57`, `:70`, `:162`, `:173`, `:184`:

```ts
const emptyRule = ''
const minusRule = range('--')
const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule }
const digitRule = range('09')
const numberRule = [optionalMinusRule, digitRule]
```

Four of the nine carry a copy-paste typo, `minursRule`
(`descent:151`, `:173`; `ll1:58`, `:163`) — harmless because the binding is
local, but a direct measurement of how these blocks were produced. One site
(`ll1:70-74`) is a deliberate variant that prefixes an `optionalSpaceRule`; it
is the one that should stay distinct, and today it is indistinguishable at a
glance from the eight that should not.

#### 3. The JSON acceptance corpus — 20 cases, 3 copies

`fjs/bnf/descent/proof.f.ts:234-253` and `fjs/bnf/ll1/proof.f.ts:243-262` list
the **same 20 inputs with the same 20 verdicts**, verbatim — the corpus that
exercises `deterministic()` through each of the two backends.
`fjs/djs/tokenizer/proof.f.ts:25-51` lists all 20 again plus 7 of its own.

The DJS copy is the interesting one. It shares every input, and **six verdicts
flip from `false` to `true`**:

| input | JSON grammar | DJS token grammar |
|-------|--------------|-------------------|
| `'   tr2ue   '` | reject | accept |
| `'   h-56.7e+5   '` | reject | accept |
| `'   -56.7e+5   3'` | reject | accept |
| `'   [ 12, false2, "a"]  '` | reject | accept |
| `'   { "q": [ 12, false, [}], "a"] }  '` | reject | accept |
| `'   [{ "q": [ 12, false, [}], "a"] }]  '` | reject | accept |

Those six rows *are* the specification of how a JS token stream differs from a
JSON document — the tokenizer accepts any sequence of well-formed tokens and
leaves structure to the parser. That is worth stating once, in a table. Today
it is derivable only by diffing two files that nothing links together, and a
seventh divergence introduced by a future grammar change would look exactly
like the six intended ones.

### Proposal

Move all three into `fjs/bnf/testlib.f.ts`, next to `classic()` and
`deterministic()`.

**1. One recognizer adapter per backend, one assertion helper over both.**

```ts
/** Accepts and consumes the whole input. */
export type Recognizer = (input: readonly number[]) => boolean

export const descentRecognizer = (rule: Rule, start: string = ''): Recognizer => …
export const ll1Recognizer = (rule: Rule, start: string = ''): Recognizer => …

/** Asserts a recognizer's verdict on each `[input, accepted]` row. */
export const assertRecognizes = (r: Recognizer) => (cases: readonly Case[]): void => …
export type Case = readonly [string, boolean]
```

`stringToCodePointList`/`toArray` move inside the adapter, so no proof site
repeats the decode. Watch the import direction: `testlib.f.ts` currently
imports only `./module.f.ts`, and the adapters need `./descent` and `./ll1`.
Both are leaves under `fjs/bnf` and neither imports `testlib.f.ts`, so this adds
no cycle — but if it turns out inconvenient, put the adapters in
`fjs/bnf/descent/testlib.f.ts` and `fjs/bnf/ll1/testlib.f.ts` and keep only
`Case` / `assertRecognizes` / the corpus in the shared file.

**2. `export const number: Rule`** — the optional-minus-then-digit grammar,
exported by name. The nine sites import it; `ll1:70-74`'s space-prefixed
variant stays local and is thereby visibly *not* the shared one.

**3. `export const jsonCases: readonly Case[]`** — the 20-row corpus with the
JSON verdicts. `descent` and `ll1` consume it unchanged. `fjs/djs/tokenizer`
consumes it through an explicit override:

```ts
// fjs/djs/tokenizer/proof.f.ts — the six rows where a JS token stream is
// more permissive than a JSON document, stated as a table rather than as a
// silently divergent copy.
const jsTokenOverrides = ['   tr2ue   ', '   h-56.7e+5   ', …] as const
```

so the divergence is declared in one place and any *new* divergence fails the
proof instead of blending in.

Roughly 150 lines of proof text collapse to imports, and the three files stop
answering "what does this grammar accept?" independently.

### Tasks

- [ ] Add `Case`, `assertRecognizes`, and the two recognizer adapters to
      `fjs/bnf/testlib.f.ts` (or per-backend testlibs if the import direction
      argues for it); confirm no import cycle.
- [ ] Add `number` (the optional-minus-then-digit grammar) and `jsonCases`.
- [ ] Convert `fjs/bnf/descent/proof.f.ts` and `fjs/bnf/ll1/proof.f.ts`; keep
      `ll1:70-74`'s space-prefixed variant local and comment why.
- [ ] Convert `fjs/djs/tokenizer/proof.f.ts` to `jsonCases` plus a named
      override list for the six flipped verdicts and its 7 extra inputs.
- [ ] Confirm coverage of `fjs/bnf/descent`, `fjs/bnf/ll1` and
      `fjs/djs/tokenizer` is unchanged — this must move test text, not test
      cases.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [bnf-grammar-single-owner](../../media/json/todo/bnf-grammar-single-owner.md)
  — moves the *grammars* (`deterministic()`, and the lexical rules `djs`
  restates) to `fjs/media/json/grammar`. Disjoint from this issue, which moves
  the *harness and fixtures* around them; whichever lands first, the other
  still applies. If the grammar moves, `jsonCases` moves with it and the
  recognizer helpers stay in `fjs/bnf`.
- [65Y-proof-assertEq-adoption](../../emergent_testing/todo/65y-proof-asserteq-adoption.md)
  — replaces `if (x !== e) { throw x }` with `assertEq`. Orthogonal: these
  sites already use `assertEq`; what repeats here is everything around it.
- [stack-recursive-matching](../ll1/todo/stack-recursive-matching.md) and the
  `longInput` regression block (`fjs/bnf/descent/proof.f.ts:260+`) — a second,
  differently-shaped corpus; leave it alone until this one is done.
