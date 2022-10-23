# FSM

This module is about a [finite-state machine](https://en.wikipedia.org/wiki/Finite-state_machine). It's not about
[Flying Spaghetti Monster](https://en.wikipedia.org/wiki/Flying_Spaghetti_Monster).

## FA Expression

- `symbol(s)`
- `next state`

## FA Rule

- `init state`
- `FA Epression`

## Example

FunctionalScript Identifier

### Grammar (EBNF)

```
id ::= `_$a..zA..Z` id2
id2 ::= `_$a..zA..Z0..9` id2
```

### FA

```js
const grammar = [
  ['init', toByteSet('_$a..zA..Z'), 'id'],
  ['id', toByteSet('_$a..zA..Z0..9'), 'id'],
]
```
