# ASCII

Named code points and the small character classes a lexer needs, so a parser
writes `digit0` or `isDigit` instead of `48` or a range test of its own.

## Names

Every printable ASCII character a parser uses has a constant named after its
Unicode name: `space`, `quotationMark`, `solidus`, `digit0`, `colon`,
`latinCapitalLetterA`, `leftCurlyBracket`, and so on, along with the control
characters `nul`, `ht`, `lf`, `cr`, `ff` and `backspace`. Ranges such as
`digitRange` and `latinSmallLetterRange` are inclusive pairs.

```js
import { one, codePoints, range, digit0 } from './module.f.js'

one('A')          // 65
codePoints('ab')  // [97, 98]
range('az')       // [97, 122]
digit0            // 48
```

## Classes

`isDigit`, `isLatinSmallLetter`, `isLatinCapitalLetter` and `isLatinLetter`
take a code point. `charIs` asks the same of a one-character string, and
answers `false` for anything that is not exactly one code unit.

```js
charIs(isDigit)('7')   // true
charIs(isDigit)('12')  // false
```

## Digits

This module owns the hexadecimal digit codec and the digit-run readers, so no
consumer rederives them.

| Function | Answers |
|---|---|
| `hexDigitValue` | `0..15` for `0-9`, `a-f`, `A-F`, or `null` |
| `lowerHexDigitValue` | the same without `A-F` |
| `hexDigitCodePoint` | the lowercase digit for a value `0..15` |
| `isDigits` | whether a string is one or more `0-9` and nothing else |
| `isCanonicalDigits` | whether a run of code points is decimal with no leading zero, except `0` itself |
| `digitsValue(radix)` | the `bigint` a run of digits spells, or `null`; `radix` is `2n` to `10n`, and anything else throws |
| `decimalValue` | `digitsValue(10n)` |
| `hexDigitsValue` | the same for hexadecimal digits, which `digitsValue` does not read |

```js
decimalValue(codePoints('042'))        // 42n: a leading zero is read
isCanonicalDigits(codePoints('042'))   // false: but it is not canonical
hexDigitsValue(codePoints('ff'))       // 255n
decimalValue(codePoints('4x'))         // null
```
