# BNF

See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).

- the new functional parser [./module.f.ts](./module.f.ts),
- the new serializable parser [./data/](./data/).

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
export default {
    space: 0x000020_000020,
    digit: 0x000030_000039,
    sequence: ['space', 'digit'],
    spaceOrDigit: {
        space: 'space',
        digit: 'digit',
    },
    twoSequences: ['sequence', 'sequence'],
}
```

## DispatchRules

```ts
type DispatchRule = {
    readonly isEmpty: boolean
    readonly rangeMap: RangeMap<{
        readonly tag: string|undefined
        readonly rules: DispatchRule[]
    }>
}
```

```ts
const spaceOrDigit: DispatchRule = {
    isEmpty: false,
    rangeMap: {
        0x20: { tag: 'space', rules: [] },
        0x30..0x39: { tag: 'digit', rules: [] },
    }
}

const digit: DispatchRule = {
    isEmpty: false,
    rangeMap: {
        0x30..0x39: { rules: [] }
    }
}

const sequence: DispatchRule = {
    isEmpty: false,
    rangeMap: {
        0x20: { rules: [digit] }
    }
}

const twoSequences: DispitchRule = {
    isEmpty: false,
    rangeMap: {
        0x20: [digit, sequence]
    }
}
```

## AST

`" 1"`

`[{space:0x20},{digit:0x31}]`
