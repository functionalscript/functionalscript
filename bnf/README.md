# BNF

See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).

- the functional grammar helpers in [./module.f.ts](./module.f.ts) for composing
  new grammars from existing pieces,
- the serializable parser data in [./data/](./data/) (use the transformer in
  [./data/module.f.ts](./data/module.f.ts) to emit it).

In this module a **Sequence** is an ordered array of rules, while a **Variant**
is a mapping of production names to rule choices. The capitalized names in the
docs match the exported types to keep the vocabulary consistent.

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

const twoSequences: DispatchRule = {
    rangeMap: {
        0x20: [digit, sequence]
    }
}

const empty: DispatchRule = {
    emptyTag: true,
    rangeMap: {}
}

const minus: DispatchRule = {
    rangeMap: {
        0x2D..0x2D: { rules: [] }
    }
}

const optionalMinus: DispatchRule = {
    emptyTag: 'none',
    rangeMap: {
        0x2D..0x2D: { tag: 'minus', rules: [] }
    }
}

const iDigit: DispatchRule = {
    rangeMap: {
        0x2D..0x2D: { output: [{ "minus": ['-'] }], rules: [digit] },
        0x30..0x39: { output: [{ "none": [] }], rules: [] },
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
