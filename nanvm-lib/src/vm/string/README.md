# `String` and `Number` built-ins

The member functions a string answers, reached from `string` in
[`../lambda/string.rs`](../lambda/string.rs), and a number's formatters,
from `number` in [`../lambda/number.rs`](../lambda/number.rs) with their
arithmetic in [`../number/format.rs`](../number/format.rs). Each is ECMAScript
2025's algorithm on every input a module can build, pinned by the shared corpus
in [`fjs/nanvm`](../../../../fjs/nanvm/README.md), and the completeness table in
[`fjs/nanvm/methods`](../../../../fjs/nanvm/methods/module.f.mjs) keeps this set
equal to what the compiler admits. The same arrangement for `Array` is
[`../array/README.md`](../array/README.md).

| file | built-ins |
|---|---|
| [`reads.rs`](reads.rs) | `at`, `charAt`, `charCodeAt`, `codePointAt`, `isWellFormed`, `toWellFormed` |
| [`search.rs`](search.rs) | `includes`, `indexOf`, `lastIndexOf`, `startsWith`, `endsWith` |
| [`building.rs`](building.rs) | `slice`, `substring`, `concat`, `repeat`, `padStart`, `padEnd`, `trim`, `trimStart`, `trimEnd` |
| [`patterns.rs`](patterns.rs) | `replace`, `replaceAll`, `split` |

## What is out, by design

The language refuses these names on a string
([`fjs/js/prototype/README.md`](../../../../fjs/js/prototype/README.md)), and
this crate grows no entry for any of them:

| names | why |
|---|---|
| `match`, `matchAll`, `search` | Coerce the argument to a `RegExp`, a type the language lacks. |
| `toLowerCase`, `toUpperCase`, `normalize` | Depend on the engine's Unicode version. |
| `toLocaleLowerCase`, `toLocaleUpperCase`, `localeCompare` | Read the host locale. |
| `substr`, `trimLeft`, `trimRight` | Annex B aliases. |
| `anchor`, `big`, `blink`, `bold`, `fixed`, `fontcolor`, `fontsize`, `italics`, `link`, `small`, `strike`, `sub`, `sup` | Annex B HTML wrappers. |
| `valueOf`, `constructor` | The coercion protocol, and a data property. |

Several branches of the algorithms have no input here, and the code does not
model them:

- **Regular expressions.** A module cannot spell a `RegExp` or a symbol, so every
  pattern `replace`, `replaceAll` and `split` see is a value converted by
  `ToString`, and `includes`, `startsWith` and `endsWith` never meet the
  `IsRegExp` throw.
- **Capture groups.** A string pattern has none, so `GetSubstitution`
  substitutes `$$`, `$&`, `` $` `` and `$'` and leaves `$1` and `$<name>` as
  written, as JavaScript does.

## Code units, not code points

Every position, length and index counts UTF-16 code units, as JavaScript does: a
surrogate pair is two positions, `"😀".split("")` is two lone surrogates. Only
`codePointAt`, `isWellFormed` and `toWellFormed` look at pairs. A lone surrogate
has no Rust `&str` spelling, so the corpus and `fjs compile` write such a string
as its code units, `string_any_utf16(&[…])`.

## When an argument is read

- `lastIndexOf` `ToNumber`s its position first and reads `NaN` — `undefined`
  included — as the end, unlike `Array`'s, which reads a passed `undefined` as
  `0`.
- `padStart` and `padEnd` convert the fill only when padding is needed.
- `split` reads its limit before its separator, and a limit of `0` answers `[]`
  before anything else.
- `replace` and `replaceAll` decide whether the replacement is a function, and
  convert a template, before any match is looked for.
- `toFixed` checks its digit range before the number, so `Infinity.toFixed(101)`
  throws. `toExponential` and `toPrecision` convert their argument first, so
  `NaN` is `0`, `"2.9"` is `2`, and a bigint throws even on `Infinity`; then
  they look at the number before the range, so `Infinity.toExponential(101)`
  is `"Infinity"`.

## Exact rounding

`toFixed`, `toExponential` and `toPrecision` round the double's exact binary
value, the larger digit string on a tie: `(2.5).toFixed(0)` is `"3"`, and
`(1.005).toFixed(2)` is `"1.00"` because the double nearest `1.005` is below it.
Rust's `format!("{:.0}", 2.5)` rounds half to even and answers `"2"`, so the
arithmetic is `BigInt<A>`'s.

## Implementation-defined results

- **The longest string.** `String<A>` holds at most `2³² − 1` code units, and
  `create.rs` refuses a longer result with the `RangeError` engines throw. V8's
  limit is far lower, so a length between the two answers here and throws there.
- **Radix digits of a fraction.** ECMAScript leaves `(0.5).toString(2)` to the
  engine, so NaNVM refuses a fraction with a radix other than ten. An integer,
  and every bigint, converts exactly.

`vm/number/format.rs` holds the formatters' arithmetic, and
[`../bigint/radix.rs`](../bigint/radix.rs) the radix digits.
