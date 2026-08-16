# BNF

See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).

- the functional representation [./module.f.mjs](./module.f.mjs),
- the serializable representation [./data/](./data/),
- symbols for multi-character tokens [./token_symbol/](./token_symbol/),
- parser/automaton backends built over the serializable representation:
  - LL(1) dispatch/matcher [./ll1/](./ll1/),
  - recursive descent matcher [./descent/](./descent/).

The two backends accept the same grammars but **do not** produce the same AST for
them — see [./ll1/README.md](./ll1/README.md#the-ast-diverges-from-the-descent-backends)
for the six-row table and [./todo/ll1-ast-divergence.md](./todo/ll1-ast-divergence.md)
for whether that is a defect or a contract. Until that is settled, an AST belongs
to the backend that produced it.

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

## DispatchRules

```ts
type DispatchRule = {
    readonly emptyTag: string|true|undefined  
    readonly rangeMap: RangeMap<{
        readonly tag: string|undefined
        readonly rules: DispatchRule[]
    }>
}

type DispatchSequence = {
    readonly emptyTag: true|undefined
    readonly rangeMap: RangeMap<{
        readonly tag: undefined
        readonly rules: DispatchRule[]
    }>
}

type DispatchVariant = {
    readonly emptyTag: string|undefined
    readonly rangeMap: RangeMap<{
        readonly tag: string
        readonly rules: DispatchRule[]
    }>
}
```

```ts
const spaceOrDigit: DispatchRule = {
    rangeMap: {
        0x20: { tag: 'space', rules: [] },
        0x30..0x39: { tag: 'digit', rules: [] },
    }
}

const digit: DispatchRule = {
    rangeMap: {
        0x30..0x39: { rules: [] }
    }
}

const sequence: DispatchRule = {
    rangeMap: {
        0x20: { rules: [digit] }
    }
}

const twoSequences: DispitchRule = {
    rangeMap: {
        0x20: [digit, sequence]
    }
}

const emtpy: DispatchRule = {
    emptyTag: true,
    rangeMap: {}
}

const minus: DispatchRule = {
    rangeMap: {
        0x2D..0x2D: { rules: [] }
    }
}

const optionalMap: DispatchRule = {
    emptyTag: 'none',
    rangeMap: {
        0x2D..0x2D: { tag: 'minus', rules: [] }
    }
}

const iDigit: Dispatch = {
    rangeMap: {
        0x2D..0x2D: { output: [{"minus:" ["-"]}], rules: [digit] }
        0x30..0x39: { output: [{"none": []}], rules: [] }
    }
}
```

## AST

`" 1"` => `[{space:0x20},{digit:0x31}]`
- optionalMinus:
  - `"-"` => `{ "minus": ['-'] }`
  - `""` => `{ "none": [] }`

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
