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

const dot = byteSet('.')

const grammar = [
  ['', digit, 'int'],
  ['int', digit, 'int'],
  //
  ['', digit, 'floatBegin'],
  ['floatBegin', digit, 'floatBegin'],
  ['floatBegin', dot, 'floatDot'],
  ['floatDot', digit, 'float'],
  ['float', digit, 'float'],
  //
  ['', idBegin, 'id'],
  ['id', idNext, 'id'],
]
```

```js
const result = {
  "['']": {
    digit: "['floatBegin','int']",
    idBegin: "['id']"
  },
  "['floatBegin','int']": {
    digit: "['floatBegin','int']",
    dot: "['floatDot']",
  },
  "['floatDot']": {
    digit: "['float']"
  },
  "['float']": {
    digit: "['float']"
  },
  "['id']": {
    idNext: "['id']"
  }
}
```

```js
const result = [
  { // 0
    digit: 1,
    idBegin: 4
  },
  { // 1
    digit: 1,
    dot: 2,
  },
  { // 2
    digit: 3
  },
  { // 3
    digit: 3
  },
  { // 4
    idNext: 4
  }
}
```

## How to Add a Property # 1

```ts
const a = { x: 5, y: 6 }
const b = { ...a, z: 7 }
```

## How to Add a Property # 2

```ts
import map from './types/map/module.f.ts'
const a = map.fromEntries(Object.entries({ x: 5, y: 6 }))
const b = map.setReplace('z')(7)(a)
```
