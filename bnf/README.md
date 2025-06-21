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
    }
}
```

## Rules

```ts
type Rule = {
    readonly isEmpty: boolean
    readonly rangeMap: (c: number) => readonly Rule[] | undefined // ???
}
```
