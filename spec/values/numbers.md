# Numbers

**Status:** implemented

A number is written with JSON number syntax less its sign: an integer part, an
optional fraction, an optional exponent. A leading `-` is not part of the
literal but the [unary minus](README.md) applied to it, which is
why `- 42.5` is the same value written with a space.

```js
export default [0, -42.5, 3e2, 1E-7];
```

A literal denotes the IEEE 754 double nearest its decimal value, as it does in
JavaScript and in `JSON.parse`: digits beyond a double's precision round away,
so `9007199254740993` is `9007199254740992`; a literal too large for a double
is `Infinity` (`1e400`); and one too small is `0` (`1e-400`), which is why
`-1e-400` is `-0`. A `.json` input reads its numbers the same way. An
overflowed literal is an `Infinity` like any other, written as the word where
a format has one and refused by a `.json` output ([output](../command-line/output.md)).

A number may also be written in binary, as JavaScript writes it: `0b` or
`0B` followed by one or more `0` or `1` digits. `0b101010` is `42`;
conversion rounds to the nearest double, as for decimal and hexadecimal
literals. A binary literal has no fraction or exponent. Missing digits,
other digits or a word directly after the literal are errors. The `n`
suffix gives an exact bigint at any width: `0B101n` is `5n`. Outputs write
the value in decimal; unary negation also preserves `-0b0` as `-0`.
A single `_` may separate digits in decimal integer parts, fractions and
exponents, and in binary or hexadecimal digits: `1_000`, `1.2_5e1_0`,
`0b1010_0011`, `0xFF_FF`, and `1_000n`. Separators do not change the
value. Leading, trailing or repeated separators, separators next to a
radix prefix, decimal point, exponent marker or sign, or bigint suffix,
and separators after a leading decimal zero are errors.

A number may also be written in hexadecimal, as JavaScript writes it: `0x`
or `0X`, then one or more digits `0`–`9`, `a`–`f` or `A`–`F`. It denotes the
double nearest the integer its digits spell, as a decimal literal does, so
`0xFF` is `255` and `0x20000000000001` is `9007199254740992`. It has no
fraction and no exponent: after `0x`, `e` is a digit, so `0x10e1` is `4321`,
and a `.` after the digits is the next token, so `0x10.length` is an access,
as in JavaScript. `0x` with no digit, and a word or a digit standing directly
after the literal (`0xg`, `0x1g`), are errors in both languages. The spelling
is the source's and not the value's: every output writes `0xFF` exactly as
it writes `255` — `255` in the `.js`, DataJS, JSON and EDAG outputs, and
the double's bits in `.rs` — as it writes a single-quoted string between
double quotes, and two modules that differ only in it are one graph.

```js
export default [0xFF, 0XfF, 0x10e1];
```

Otherwise the syntax is JSON's, so the other JavaScript spellings JSON
leaves out are not recognized: no octal (`0o7`) prefix, no
leading `+`, no leading decimal point (`.5`), and no trailing decimal point
without a fractional digit (`1.`). The three numbers JSON cannot spell
are written as the words JavaScript gives them — `NaN`, `Infinity` and
`-Infinity` — exactly as [DataJS](../datajs/README.md) writes them:

```js
export default [NaN, Infinity, -Infinity];
```

`NaN` and `Infinity` are reserved words, like `undefined`: a module cannot
bind or shadow them, so each denotes its value wherever a value stands.
`Array` is reserved the same way, for a different reason: it denotes no
value here, and is the one word the right side of `instanceof` may be
([operators](../operators/README.md)), so a module that could bind it would mean
something else by it.

They still name a property, as every reserved word does: `{ NaN: 1 }` and
`a.NaN` are a key and an access, and mean the string `"NaN"`, exactly as in
JavaScript, where a property is named by an `IdentifierName` and a value by
an `IdentifierReference`. `-Infinity` names nothing in either language: it is
two tokens in both — the operator and the word — which no property name may
be.

**FunctionalScript has one `NaN`.** IEEE 754 gives a `NaN` a sign and a
payload, and a JavaScript program can read them — through a typed array or a
`DataView`, which FunctionalScript has none of. Nothing else tells two `NaN`s
apart: every operator, coercion and comparison treats each the same,
`Object.is` included, and each is written as the word `NaN`. So a `NaN`'s
bits are not serializable data, hence not an observation and not a
compatibility question ([principles](../principles/README.md)): every `NaN` is the one
value, and a writer may spell them all as one — the Rust writer spells each
as the quiet `NaN` with an empty payload.

The `-` is the **unary minus operator** ([operators](../todo/2340-operators.md)),
the first operator the language had; `~`, the **bitwise not operator**, `!`,
the **logical not operator**, and `typeof` are the other prefixes — `~`
Stage A of the same operators document, `!` and `typeof` the rows admitted
after both stages. None is part of the literal after it: `-42.5` is the
negation of `42.5`, `- 42.5` is the same value written with a space, and
`-NaN` and `-Infinity` are values as JavaScript has them. Each binds looser
than a property access or a call, as in JavaScript, so `-1 .x` is `-(1 .x)`
and `-1()` is `-(1())`. What any of them takes is JavaScript's
`UnaryExpression`, which an arrow function is not, so `-(...a) => 1`,
`~(...a) => 1`, `!(...a) => 1` and `typeof (...a) => 1` are syntax errors in
both, and none stands immediately before `**` — `-2 ** 2` is refused,
matching JavaScript, where `(-2) ** 2` and `-(2 ** 2)` are the parenthesized
readings — though
either may stand right after it, as in JavaScript: `2 ** -2` is `2 ** (-2)`
and `2 ** ~2` is `2 ** (~2)`. Two adjacent `-` characters are the decrement
operator, which the language has no rule for, so a negation of a negation is
spaced, `- -1`, or grouped, `-(-1)`. `~` and `!` have no such token, in
JavaScript or here, so `~~1` is two bitwise nots, the same as `~ ~1`, and
`!!1` two logical nots.
[Operators](../operators/README.md) has the rest of them.

A negative number is therefore an expression rather than a literal *in the
syntax*. The graph is another matter: lowering folds a negation into a leaf
when its operand lowers to a number or a `bigint`, since negating one is exact
arithmetic, so the EDAG of `-1` is the leaf `-1` and not an operation. The
operand is judged as lowered, not as written: a numeric literal, `NaN` or
`Infinity`, a `const` holding a number or a `bigint` — a captured one
included — and another folded negation all fold, so
`const a = 1; export default - -a;` is the leaf `1`, and its FunctionalScript
output is `export default 1;`. An import of a number or a `bigint` folds too
where it lowers to that value, which it does from a module that computes
nothing but its default export, as a JSON document does; from any other
module it lowers to that module's computation — its statement sequence, or
a read of its export object when the module exports more than `default` —
and stays an operation. A negation of anything else stays one too: of a string, a
boolean, `null`, `undefined` or a container, since folding it would mean
saying what that value converts to, and of an access, a parameter or a call,
whose value lowering does not compute. No other operator folds, even over
numbers: `~1` and `1 + 2` stay nodes, and `-1 * 2` multiplies the leaf `-1`.

A `.json` or DataJS output computes a negation that survives lowering,
using JavaScript's coercion rules. For a primitive, a
`bigint` stays a `bigint`, and any other primitive converts to a number —
`-"2"` is `-2`, `-true` is `-1`, `-null` and `-""` are `-0`, and `-undefined`
and `-"abc"` are `NaN`, which a `.json` output then has no spelling for. A
negation of an array or an object first uses `ToPrimitive`: `-[5]` is `-5`
and `-{}` is `NaN`. Own `valueOf` or `toString` functions participate in that
conversion and can fail. JSON then refuses a result such as `NaN` that it
cannot represent; DataJS writes it. The EDAG and FunctionalScript outputs
keep an unfolded negation as code ([output](../command-line/output.md)).

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Numeric literals](https://tc39.es/ecma262/#sec-literals-numeric-literals), [The Number type](https://tc39.es/ecma262/#sec-ecmascript-language-types-number-type)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#numeric_literals>
