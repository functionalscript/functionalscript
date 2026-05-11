# BNF

See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).

- the functional representation [./module.f.ts](./module.f.ts),
- the serializable representation [./data/](./data/).

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
