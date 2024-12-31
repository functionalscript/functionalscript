# Parser Infrastructure

Types:

- Terminal https://en.wikipedia.org/wiki/Terminal_and_nonterminal_symbols#Terminal_symbols.
- Sequence
- Or

```ts
type TerminalRange = readonly[number, number]
type Sequence<R> = readonly R[]
type Or<R> = { readonly or: Sequence<R> }
type DataRule<R> = Sequence<R>|Or<R>|TerminalRange|string
```

Define common and recursive rules using functions.

```ts
type LazyRule = () => DataRule
type Rule = DataRule<Rule>|LazyRule

const i: LazyRule = () => {or:[
    [],
    ['(', i, ')'],
]}
```

Using functions as identifiers for the rules we can create a data only type with references.

```ts
type RefRule = { readonly id: string }
type Rule = DataRule<Rule>|RefRule
type RuleMap = { readonly[k in string]: }

const i: RuleMap = {
    i: {or:[
        [],
        ['(', {id: 'i'}, ')'],
    ]}
}
```

This type can be used for serialization.

## TerminalRange

`length`:

- `1`: `'a'` one symbol
- `2`: `'ab'` a range from `'a'` to `'b'`

## Output

```ts
type Node = {
    readonly id?: LazyRule
    readonly nodes: readonly Node[] | string
}
```

Additional information that could be included into the `Node`:
- position in the file `byte number`
- position in a text file: `line` and `column` using Unicode.

## Determinism

The final automata should be deterministic.

## Merging Strategies

1. Error on conflict.
2. Ordered shallow merge. Rewrite existing rule.
3. Ordered deep merge. For example, merging identifiers and keywords.
   **Note:** the algorithm may try infinite resource allocation if grammar is invalid `LR`.

See [LR parser](https://en.wikipedia.org/wiki/LR_parser).

## Example

See [31-json.f.ts](./31-json.f.ts)
