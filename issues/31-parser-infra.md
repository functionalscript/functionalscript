# Parser Infrastructure

Two types:

- Sequence
- Or

```ts
type Sequence<R> = readonly R[]
type Or<R> = {readonly or: Sequence<R>}
type DataRule<R> = Sequence<R>|Or<R>|string
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

## Determinism

The final automata should be deterministic.
