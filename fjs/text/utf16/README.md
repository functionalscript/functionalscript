# UTF-16

JavaScript strings are UTF-16, so this module is how FunctionalScript reads a
string as code points and writes code points back as a string. The code-unit
and surrogate tables are in the [text README](../README.md#utf-16).

## Where to start

```js
import {
    stringToCodePointList, codePointListToString,
    isWellFormed, floorCodePointBoundary,
} from './module.f.mjs'

stringToCodePointList('a😀')               // 0x61, 0x1f600 (as a List)
codePointListToString([0x61, 0x1f600])    // 'a😀'
isWellFormed('a😀')                       // true
isWellFormed('a\ud800b')                  // false: an unpaired surrogate
floorCodePointBoundary('a😀')(2)           // 1: index 2 is inside the pair
```

An unpaired surrogate is not an error that stops the decode. It becomes a
code point tagged with `errorMask`, and encoding it gives the same code unit
back, so a string survives the round trip unchanged. `isWellFormed` is the
question to ask before handing a string to something that needs valid
Unicode, such as the [UTF-8](../utf8/README.md) encoder.

## Functions

| Function | From | To |
|---|---|---|
| `stringToList` | string | code units, `List<U16>` |
| `listToString` | code units | string |
| `toCodePointList` | code units | code points |
| `fromCodePointList` | code points | code units |
| `stringToCodePointList` | string | code points |
| `codePointListToString` | code points | string |
| `codePointToString` | one code point | string |
| `codeUnitToString` | one code unit | string |

The functions that answer a list are lazy, so a long string is read only as
far as the caller walks. The ones that answer a string, `listToString` and
`codePointListToString`, read their whole input first, so they never return
on an unbounded list.

`floorCodePointBoundary(s)(i)` is the place to cut a string at a code-unit
index without splitting a surrogate pair. It throws on an index that is not a
non-negative integer.

`utf16Decoder` exposes the shared `init` / `update(state, word)` / `end(state)`
protocol. Its state is a pending high surrogate or `null`, and updates emit
code points as they are decoded. `end` flushes an unpaired high surrogate as
one error unit and completes with a `null` summary. `toCodePointList` drives
this machine lazily through the shared list transducer driver.
