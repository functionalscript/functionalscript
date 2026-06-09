# Formal Grammar

**Priority:** P3
**Status:** done

[eDSL](https://en.wikipedia.org/wiki/Domain-specific_language#External_and_Embedded_Domain_Specific_Languages) for [formal grammars](https://en.wikipedia.org/wiki/Formal_grammar) using a modification of [BNF](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).

Types:

- [Terminal](https://en.wikipedia.org/wiki/Terminal_and_nonterminal_symbols#Terminal_symbols),
- Sequence,
- Or.

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

// BNF:
//   i ::= "(" i ")" | ""
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

## Resolution

The core formal grammar eDSL is implemented in
[`fs/bnf/module.f.ts`](../fs/bnf/module.f.ts), with documentation in
[`fs/bnf/README.md`](../fs/bnf/README.md). The serializable rule-set form,
grammar-to-data conversion, AST output, recursive descent parser, and LL(1)
parser are implemented in [`fs/bnf/data/module.f.ts`](../fs/bnf/data/module.f.ts)
and documented in [`fs/bnf/data/README.md`](../fs/bnf/data/README.md).

Remaining parser directions are tracked separately:

- [i032-stupid-parser](./032-stupid-parser.md) — non-deterministic parser.
- [i046-lr1-parser](./046-lr1-parser.md) — LR(1) parser.
- [i165-layered-parser](./165-layered-parser.md) — layered tokenizer/parser
  design.
