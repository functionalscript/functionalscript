# Parser Infrastructure

Two types:

- Sequence
- Or

```ts
type Sequence<R> = readonly R[]
type Or<R> = {readonly or: Sequence<R>}
type Terminal = string
type DataRule<R> = Sequence<R>|Or<R>|Terminal
```

Define common and recursive rules using functions.

```ts
type LazyRule = () => DataRule
type Rule = DataRule<Rule>|LazyRule

const i: LazyRule = () => {or:[
    '',
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
        '',
        ['(', {id: 'i'}, ')'],
    ]}
}
```

This type can be used for serialization.

## Terminal Symbols

```ts
type TerminalSequence = string
type TerminalRange = {readonly range: string}
type Terminal = TerminalSequence | TerminalRange
```

See https://en.wikipedia.org/wiki/Terminal_and_nonterminal_symbols#Terminal_symbols.

## Output

```ts
type Node = {
    readonly id?: LazyRule
    readonly nodes: readonly Node[] | string
}
```

## Merging Strategies

1. Error on conflict.
2. Ordered shallow merge. Rewrite existing rule.
3. Ordered deep merge. For example, merging identifiers and keywords.
   **Note:** the algorithm may try infinite resource allocation if grammar is invalid.

See [LR parser](https://en.wikipedia.org/wiki/LR_parser).

## Determinism

The final automata should be deterministic.
