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
const lowercaseAlpha = byteSet.range('a')('z')
const uppercaseAlpha = byteSet.range('A')('Z')
const alpha = byteSet.union(lowercaseAlpha)(uppercaseAlpha)
const idSymbol = byteSet.union(byteSet.one('_'))(byteSet.one('$'))
const idBegin = byteSet.union(alpha)(idSymbol)

const digit = byteSet.range('0')('9')
const idNext = byteSet.union(idBegin)(digit)

const grammar = [
  ['init', idBegin, 'id'],
  ['id', idNext, 'id'],
]
```
