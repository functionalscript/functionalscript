# BNF

See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).

- the functional representation [./module.f.mjs](./module.f.mjs),
- the serializable representation [./data/](./data/),
- symbols for multi-character tokens [./token_symbol/](./token_symbol/),
- parser/automaton backends built over the serializable representation:
  - LL(1) dispatch/matcher [./ll1/](./ll1/),
  - recursive descent matcher [./descent/](./descent/).

## The AST is one contract

The AST a `RuleSet` implies is part of the `RuleSet` contract, not any one
backend's private business: every backend builds a node per rule *invocation* —
a rule is entered before its first symbol is consumed — and a `Repeat` rule is
one flat node of the items it matched
([./descent/README.md](./descent/README.md#repetition-is-flat)). A consumer may
therefore read either backend's AST; a semantic action attached to a rule finds
that rule's node in both. The `descentEquivalence` proof group in
`./ll1/proof.f.mjs` pins the shared shapes, one grammar and one expected AST
per case, matched by both backends.

What a backend may add is *decoration* (per-code-point metadata in
[./descent/](./descent/)) and its own failure reporting; the successful shape
is shared.

## Terminals and EOF

A terminal is a semantic symbol. The domain is

```text
EOF              = -1
ordinary symbols = 0 .. 2^24 - 2
```

`-1` is outside the non-negative physical-symbol domain, so EOF does not depend
on how wide a physical symbol is, and no alphabet — Unicode code points, bytes,
[token symbols](./token_symbol/) — has to give up one of its own values for it.
`eof` is the singleton range `[-1, -1]`; `fullRange` is `[0, 2^24 - 2]` and holds
ordinary symbols only, so `not()` / `notSet()` never produce EOF.

### Stored codes are not semantic values

A `TerminalRange` still packs two **24-bit stored endpoint codes** into one JS
number, and the codes are unchanged: EOF is stored as `2^24 - 1`, every ordinary
symbol is stored as itself. `rangeEncode` / `rangeDecode` convert between the two
with a branchless wrap (`(value + 2^24) & mask` and its inverse), so the domain
still holds exactly `2^24` terminals — one per code — and a packed literal such
as `0x000030_000039` still reads as its endpoints.

The consequence is that stored order is not semantic order: `2^24 - 1` is the
largest code but the smallest terminal. Anything that compares terminals —
containment, complements, dispatch ranges — compares **decoded** values.

Moving EOF to `-1` was a breaking change to serialized BNF ranges rather than a
representation change: a range whose endpoint used to be the ordinary symbol
`2^24 - 1` now decodes as EOF. There is no compatibility layer for grammar data
written against the old semantics; regenerate it instead.

### Logical EOF in parser input

Callers and alphabet adapters supply physical ordinary symbols only and never
append `-1`. Each parser backend synthesizes exactly one logical EOF after the
physical input, so a grammar can require the end of input with the `eof`
terminal, and a grammar that does not mention `eof` is unaffected.

Public positions and remainders stay physical (`0 <= idx <= input.length`).
Internally a backend tracks the complete cursor `(idx, eofConsumed)`, because
consuming EOF is progress even though `idx` does not move — sequencing,
alternatives, repetition, backtracking, and failure ordering all use the complete
cursor, and `(idx, true)` is further than `(idx, false)`. The synthesized EOF has
no physical source element, so it contributes no leaf to the AST, and diagnostics
about it point at `input.length`.

## Functional Representation

Define grammar using this representation.

```ts
const space = ' '
const digit = range('09')
const sequence = () => [space, digit]
// console.log(sequence.name) // "sequence"
const spaceOrDigit = {
    space, //
    digit, //
}
```

## Serializable Data Representation

To export.

```js
export default [{
    space: 0x000020_000020,
    digit: 0x000030_000039,
    sequence: ['space', 'digit'],
    spaceOrDigit: {
        space: 'space',
        digit: 'digit',
    },
    twoSequences: ['sequence', 'sequence'],
    empty: [],
    minus: 0x00002D_00002D,
    optionalMinus: {
        none: 'empty',
        minus: 'minus',
    },
    iDigit: ['optionalMinus', 'digit'],
}, 'spaceOrDigit']
```

## Dispatch

The [./ll1/](./ll1/) backend compiles a `RuleSet` into one first-set range map
per rule. Only a variant's map carries values that are read — the branch each
lookahead selects, entered *before* the symbol is consumed — plus the nullable
branch a dispatch miss selects; every other rule kind consults its map solely
for first-set membership, which is how a repetition decides to start another
round. See [./ll1/README.md](./ll1/README.md) and `./ll1/types.ts`.

## AST

A node per rule invocation, `{ tag, sequence }`: the tag names the variant
branch the node came through (`undefined` elsewhere), and the sequence holds
the consumed symbols and child nodes in order. `iDigit` from the rule set
above:

- `"-1"` => `{ sequence: [{ tag: 'minus', sequence: [0x2D] }, { sequence: [0x31] }] }`
- `"1"` => `{ sequence: [{ tag: 'none', sequence: [] }, { sequence: [0x31] }] }`

## Common Patterns

Repeat `a`:

```json
{
  "a": {
     "some": ["b", "a"],
     "none": [],
  }
}
```
