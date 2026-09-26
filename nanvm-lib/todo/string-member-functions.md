## `String` and `Number` member functions

**Priority:** P2
**Status:** open

### Problem

After `Array`, the completeness table in
[`fjs/nanvm/methods`](../../fjs/nanvm/methods/module.f.mjs) still lists every
`String` member function the compiler admits as pending, as well as `Number`'s
`toExponential`, `toFixed` and `toPrecision`. `toString` refuses a radix on a
number or a bigint. So `s.startsWith("#")`, `name.padStart(4, "0")` and
`x.toFixed(2)` all compile and then throw on NaNVM. The compiler's own source
uses `slice`, `startsWith`, `split`, `indexOf`, `includes`, `repeat` and `trim`
throughout, so these stand between the MVP pipeline and self-hosting as `Array`
did ([mvp-roadmap](./mvp-roadmap.md)).

This file is the specification of that work, in the shape
[`vm/array/README.md`](../src/vm/array/README.md) records for `Array`: what each
built-in computes on this VM, what it deliberately does not, and the order it
lands in. The machinery is already in place — the call step, the per-type
tables in `vm/lambda/method.rs`, method groups and callbacks in the shared
corpus, and the two-way completeness test — and nothing here changes it.

### What is out, by design

The VM answers exactly `allowedCalls` ∩ each type's prototype and grows no entry
for anything else
([`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md)). Refused as a
call on a string:

| names | why |
|---|---|
| `match`, `matchAll`, `search` | Coerce the argument to a `RegExp`, a type the language lacks. |
| `toLowerCase`, `toUpperCase`, `normalize` | Depend on the engine's Unicode version. |
| `toLocaleLowerCase`, `toLocaleUpperCase`, `localeCompare` | Read the host locale. |
| `substr`, `trimLeft`, `trimRight` | Annex B aliases of `substring`/`slice`, `trimStart`, `trimEnd`. |
| `anchor`, `big`, `blink`, `bold`, `fixed`, `fontcolor`, `fontsize`, `italics`, `link`, `small`, `strike`, `sub`, `sup` | Annex B HTML wrappers. |
| `valueOf`, `constructor` | The coercion protocol, and a data property. |

On a number, `toLocaleString`, `valueOf` and `constructor` stay out.

Branches of the ECMAScript algorithms with no input in this language, which the
code does not model:

- **Regular expressions.** `replace`, `replaceAll` and `split` first ask whether
  their pattern has a `Symbol.replace` / `Symbol.split` method, and
  `includes`, `startsWith` and `endsWith` ask `IsRegExp` of their argument.
  A module cannot spell a symbol or a `RegExp`, so every pattern is a value
  converted by `ToString` — an object pattern is `"[object Object]"`, as
  JavaScript converts it — and the `IsRegExp` throw cannot happen.
- **Capture groups.** With a string pattern, `GetSubstitution` has no captures
  and no named groups, so `$1` and `$<name>` in a replacement stay literal, as
  JavaScript leaves them. `$$`, `$&`, `` $` `` and `$'` are substituted.
- **`this` coercion.** Each built-in is reached only on a string (or number)
  receiver, so `RequireObjectCoercible(this)` and `ToString(this)` are the
  receiver itself.

### Positions are UTF-16 code units

A string is a sequence of UTF-16 code units, as JavaScript's is, and every
position, length and index here counts code units, never code points. A
surrogate pair is two positions: `"😀".length` is `2`, `"😀".split("")` is two
lone surrogates, and `"😀".slice(1)` is the lone low surrogate. The exceptions
are the three code-point functions: `codePointAt` combines a pair starting at
its position, `isWellFormed` says whether any surrogate is unpaired, and
`toWellFormed` replaces each unpaired one with U+FFFD.

### The contracts

Positions reuse `relative` and `clamped` from `vm/array/relative.rs`: `at`
and `slice` count a negative position from the end with `relative`, while the
searches and `substring` clamp `ToIntegerOrInfinity` straight into range with
`clamped`, so `"abc".includes("a", -1)` is `true`. A result past the length
limit is refused (see the next section).

**Reads.**

| name | contract |
|---|---|
| `at(i)` | The code unit at a relative, unclamped position, as a one-unit string, else `undefined`. |
| `charAt(i)` | `ToIntegerOrInfinity(i)`, never counted from the end; the unit as a string, else `""`. |
| `charCodeAt(i)` | The same position; the unit as a number, else `NaN`. |
| `codePointAt(i)` | The same position; the code point of a pair starting there, else the unit, else `undefined`. |
| `isWellFormed()` | No unpaired surrogate. |
| `toWellFormed()` | Each unpaired surrogate replaced by U+FFFD. |

**Search.** The search string is `ToString(arg)`, so `"undefined".includes()` is
`true`.

| name | contract |
|---|---|
| `includes(s, pos)` | `s` occurs at or after `pos`, clamped into `[0, len]`, `0` when `undefined`. |
| `indexOf(s, pos)` | The first such position, else `-1`. An empty `s` is found at the clamped `pos`. |
| `lastIndexOf(s, pos)` | The last occurrence starting at or before `pos`, else `-1`. `pos` is `ToNumber`ed first and `NaN` — `undefined` included — means the end, so unlike `Array`'s, passing `undefined` and passing nothing agree. |
| `startsWith(s, pos)` | `s` occurs at `pos`, clamped, `0` when `undefined`. |
| `endsWith(s, end)` | `s` occurs ending at `end`, clamped, the length when `undefined`. |

**Building.**

| name | contract |
|---|---|
| `slice(start, end)` | As `Array`'s: relative positions clamped, `end` the length when `undefined`. |
| `substring(start, end)` | `ToIntegerOrInfinity` of each clamped into `[0, len]`, never counted from the end, swapped if `start > end`; `end` the length when `undefined`, and `NaN` is `0`. |
| `concat(...args)` | The receiver, then each argument's `ToString`, in order. |
| `repeat(n)` | `ToIntegerOrInfinity(n)`; below `0` or infinite is a `RangeError`, even on `""`. |
| `padStart(len, fill)` / `padEnd` | `ToLength(len)`; no padding when it is not above the length. `fill` is `" "` when `undefined`, else `ToString(fill)` — `null` pads with `"null"` — and an empty `fill` pads nothing. The fill repeats and is cut to fit. |
| `trim()`, `trimStart()`, `trimEnd()` | Remove ECMAScript `WhiteSpace` and `LineTerminator` from the ends: `is_ecma_whitespace` in `vm/ecma_whitespace.rs`, the set `Number("…")` already trims. |

**Patterns.**

| name | contract |
|---|---|
| `replace(p, r)` | The first occurrence of `ToString(p)` replaced; an empty `p` matches at `0`. `r` a function is called with `(matched, position, string)` and its `ToString` inserted; otherwise `ToString(r)` with `$$`, `$&`, `` $` ``, `$'` substituted. |
| `replaceAll(p, r)` | Every non-overlapping occurrence, left to right; an empty `p` matches between every two code units and at both ends. `r` as for `replace`, called once per occurrence in order. |
| `split(sep, limit)` | `limit` is `ToUint32`, `2³² − 1` when `undefined`; then `ToString(sep)`, as ECMAScript orders it, so a separator whose conversion throws throws even with a limit of `0`. Then `0` answers `[]`, `sep` `undefined` answers `[s]`, and an empty separator splits into code units. |

**`Number`.**

| name | contract |
|---|---|
| `toString(radix)` | `radix` `undefined` or `10`: as today. Otherwise `ToIntegerOrInfinity(radix)` in `[2, 36]`, else a `RangeError`. A finite integer-valued number converts exactly in that radix, digits `0-9a-z`, sign first; `NaN` and the infinities as with radix ten. A number with a fraction and a radix other than ten keeps throwing: ECMAScript leaves those digits to the engine. |
| `BigInt` `toString(radix)` | The same radix check; every bigint converts exactly. |
| `toFixed(f)` | `ToIntegerOrInfinity(f)` in `[0, 100]`, else a `RangeError`, checked **before** looking at the number, so `Infinity.toFixed(101)` throws. Then a non-finite number is its `ToString`; `|x| ≥ 10²¹` is its `ToString`; otherwise `n` is the integer closest to `x × 10^f`, **the larger on a tie**, so `(2.5).toFixed(0)` is `"3"` and `(1.005).toFixed(2)` is `"1.00"`, since the double nearest `1.005` is below it. A negative number is rounded by its magnitude and keeps its sign, so `(-2.5).toFixed(0)` is `"-3"` and `(-0.1).toFixed(0)` is `"-0"`; only `-0` itself is unsigned, `"0.00"`. |
| `toExponential(f)` | `ToIntegerOrInfinity(f)` first, so `NaN` is `0` and a bigint is a `TypeError` even on `Infinity`. Then a non-finite number is its `ToString`, checked **before** the range, so `Infinity.toExponential(101)` is `"Infinity"`. Then `[0, 100]`, else a `RangeError`. `f` `undefined` means as many digits as the shortest round-tripping representation, the digits `ToString` uses. Otherwise `f + 1` significant digits, the larger on a tie. Exponent written `e+N` / `e-N`. |
| `toPrecision(p)` | `p` `undefined` is `ToString`. Otherwise `ToIntegerOrInfinity(p)` first, so `"2.9"` is `2`; then a non-finite number is its `ToString`; then `[1, 100]`, else a `RangeError`. `p` significant digits, the larger on a tie; exponential notation when the exponent is below `-6` or at least `p`. |

The three formatters round on the exact binary value of the double, never on a
decimal approximation. Rust's `format!("{:.0}", x)` rounds half to even and so
answers `"2"` for `2.5` where JavaScript's `(2.5).toFixed(0)` answers `"3"`; the arithmetic is
`BigInt<A>`'s, as `round_tie_to_even` in `vm/string_coercion.rs` already does
for `Number::toString`.

### Implementation-defined results

- **The longest string.** ECMAScript allows strings up to `2⁵³ − 1` code units,
  and every engine refuses much shorter ones: V8 throws a `RangeError` for
  `"a".repeat(2 ** 30)`. NaNVM's `String<A>` is indexed by `u32`, so `repeat`,
  `padStart`, `padEnd`, `concat`, `replace`, `replaceAll` and `toWellFormed` refuse a
  result past `2³² − 1` units with the same `RangeError`, never wrapping it. A
  length between the two limits answers here and throws on V8; the corpus pins
  neither.
- **Radix digits of a fraction.** `(0.5).toString(2)` is `"0.1"` on V8, but
  ECMAScript leaves non-decimal fractions to the engine, so NaNVM refuses
  rather than pick an algorithm.

### Tests

As for `Array`: every built-in is a method group in the shared corpus, its cases
checked on a JavaScript engine and printed as Rust, and each pair leaves
`pending` in `fjs/nanvm/methods` in the PR that lands it. The `args` callback
pins what a `replace` function receives. The formatters' cases include exact
ties (`0.5`, `2.5`, `1.25`), doubles just below a decimal tie (`1.005`), `-0`,
the `10²¹` boundary, both ends of every range, and a bigint argument.

### Tasks

- [x] **Reads.** `at`, `charAt`, `charCodeAt`, `codePointAt`, `isWellFormed`,
      `toWellFormed`.
- [x] **Search.** `includes`, `indexOf`, `lastIndexOf`, `startsWith`,
      `endsWith`.
- [ ] **Building.** `slice`, `substring`, `concat`, `repeat`, `padStart`,
      `padEnd`, `trim`, `trimStart`, `trimEnd`, with the length limit.
- [ ] **Patterns.** `replace`, `replaceAll`, `split`, with `GetSubstitution`.
- [ ] **`Number`.** `toString` with a radix on a number and a bigint,
      `toFixed`, `toExponential`, `toPrecision`.
- [ ] Move what outlives this file into `vm/string/README.md` and delete it
      when the `String` and `Number` checklists of
      [member-functions](./member-functions.md) are ticked.

### Related

- [member-functions](./member-functions.md): the per-type checklists.
- [`vm/array/README.md`](../src/vm/array/README.md): the same work for
  `Array`, and the shared pieces reused here.
- [`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md): every
  prototype name, allowed or refused, with its reason.
