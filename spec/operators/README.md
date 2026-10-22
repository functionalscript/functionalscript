# Operators

**Status:** implemented

```js
export default 1 + 2 * 3;
```

Beyond unary `-` ([supported value types](../values/README.md)), the
language has arithmetic (`+ - * / % **`), comparison
(`=== !== > >= < <=`), and bitwise (`& | ^ ~ << >> >>>`) — Stage A, the
first the language had — and, above them, the lazy operators
(`&& || ??`) and the conditional (`?:`), Stage B — and `!` and `typeof`, the
logical not and the type tag, the prefixes neither stage had — and
`instanceof Array`, the one instance check ([below](instanceof.md)) — and
the comma operator, written in parentheses ([below](comma/README.md)).
`==`/`!=` stay refused, since neither language reads them the same way
twice, and so does `in` ([below](in.md)). Unary `+` is not in the language:
the conversion to a number is `Number(x)`
([number conversion](../conversions/number.md)). The EDAG admits every pure
operation, unary `+` among them, and the language spells a subset of them;
which is the language's decision, made on these pages, not the EDAG's.

Precedence and associativity follow JavaScript's own. From the tightest, the
levels are the prefixes `-`, `~`, `!` and `typeof`; `**`; `* / %`; `+ -`;
the shifts `<< >> >>>`; `< <= > >=` and `instanceof`; `=== !==`; `&`; `^`;
`|`; `&&`; `||`,
with `??` a chain of its own at the same level; the conditional above
them; and the comma above them all, in its parentheses. The shifts therefore sit between arithmetic and comparison, unlike
`& ^ |`:
`1 << 2 + 3` is `1 << (2 + 3)` and `1 << 2 < 5` is `(1 << 2) < 5`. `**` is
right-associative (`2 ** 3 ** 2` is `2 ** (3 ** 2)`), the conditional nests
to the right (`a ? b : c ? d : e` is `a ? b : (c ? d : e)`), and every other
operator here is left-associative; a group overrides both
([grouping](grouping.md)). A prefix immediately before `**` is refused,
matching JavaScript exactly: `-2 ** 2`, `~2 ** 2`, `!2 ** 2` and
`typeof 2 ** 2` are syntax errors here as there, at any depth of prefix
nesting, and parentheses are the only way to write either reading —
`(-2) ** 2` raises the negation, `-(2 ** 2)` negates the power. Immediately
after `**` a prefix needs no parentheses, since JavaScript reads the right
operand of `**` as another power or a
`UnaryExpression`: `2 ** -2` is `2 ** (-2)` and `2 ** ~2` is `2 ** (~2)`.
The refusal holds inside that operand too, so `2 ** -2 ** 2` is a syntax
error in both languages, as its right side `-2 ** 2` is. `??` mixes with
`&&`/`||` only under parentheses, as in JavaScript: `a ?? b || c` and
`a && b ?? c` are syntax errors in both, and `(a ?? b) || c` is the one
spelling of that reading.

Each operator means what JavaScript's means and takes any value as an
operand, converted exactly as JavaScript converts it — save a function's
string, which the
[function-source representation exception](../principles/README.md#function-source-representation-exception)
governs. Arithmetic and bitwise operators convert each operand to a number,
a `bigint` staying one: `"5" - 2` is `3`, `true + true` is `2`, `null + 1`
is `1`, and `undefined + 1` and `[1, 2] * 1` are `NaN`. `+` alone
concatenates instead when either operand, made primitive, is a string —
`"a" + 1` is `"a1"`, `1 + "2"` is `"12"`, `"x" + null` is `"xnull"` — and
an array or an object is made primitive as JavaScript's `ToPrimitive` makes
it: an array is its elements joined by `,`, `null` and `undefined` as empty
strings (`[1] + [2]` is `"12"`, `[1, [2, 3]] + ""` is `"1,2,3"`), and an
object is `"[object Object]"` unless it owns a `valueOf` or a `toString`,
which is called as JavaScript calls it. Left associativity decides the rest:
`1 + 2 + "3"` is `"33"` and `"1" + 2 + 3` is `"123"`. `< <= > >=` compare
by UTF-16 code unit when both operands, made primitive, are strings
(`"10" < "9"` is `true`), and numerically otherwise (`"10" < 9` is `false`,
`null >= 0` is `true`, `undefined < 1` is `false`); `===`/`!==` convert
nothing. `!` converts its operand as JavaScript's `ToBoolean` does and
negates it: `!0`, `!""`, `!null`, `!undefined` and `!NaN` are `true`, and
`![]` and `!{}` are `false`, an array or an object being truthy however
empty. `typeof` is the type tag of its operand, the string JavaScript gives:
`"undefined"`, `"boolean"`, `"number"`, `"bigint"`, `"string"`, `"object"`
for `null`, an array and an object alike, and `"function"`. `typeof` is a
reserved word, so it names no `const` and no parameter, while `{ typeof: 1 }`
and `a.typeof` are a key and a property name as in JavaScript; the
FunctionalScript writer spells it with a space after the word, `typeof 1`
and `typeof (1+2)`.
[`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs) owns each
node's meaning, and the [`fjs/nanvm`](../../fjs/nanvm/module.f.mjs) corpus
checks its cases against a JavaScript engine.

A `bigint` stays exact. Over two of them the arithmetic and bitwise
operators are integer operations of any size — `2n ** 64n` and `1n << 70n`
are exact, `7n / 2n` is `3n` and `-7n / 2n` is `-3n`, truncated toward zero,
`-7n % 2n` is `-1n` and `~5n` is `-6n` — and `< <= > >=` weigh a `bigint`
against a number by value (`1n < 2`, `3 > 2n` and `1n <= 1.5` are `true`),
while `===` never equates the two (`1n === 1` is `false`). Where JavaScript
throws, so does the operation here
([failure is one outcome](../principles/README.md#failure-is-one-outcome)): a `bigint` mixed with a
number in an arithmetic or bitwise operator (`1 + 1n`), `>>>` on a `bigint`,
`/` or `%` by `0n`, and a negative `bigint` exponent (`2n ** -1n`). A string
still concatenates: `"a" + 1n` is `"a1"`.

The lazy operators establish their right operand only when the left decides
nothing — `a && b`'s `b` when `a` is truthy, `a || b`'s when `a` is falsy,
`a ?? b`'s when `a` is `null` or `undefined` — and yield the last operand
they established, not a boolean (`0 && 2` is `0`, `1 && 2` is `2`); the
conditional establishes exactly one of its arms, as JavaScript does. A
`const` reached only through such a position is still evaluated when the
module loads, as its own statement:
`const c = null.x; export default [a && c, b && c];` throws at load in both
languages, whatever `a` and `b` are. The
[failure contract](../principles/README.md#failure-is-one-outcome) says what an implementation may
reorder around that; being reached only through a lazy position is not what
decides whether a `const` runs.

**The anchoring rule** says which computations a module or a body holds, and
is best read as a subtraction. Every `const` and every import starts as an
operand of a comma, in source order, with the result last; then each operand
is deleted that a later operand is guaranteed to evaluate through eager edges
alone — a container's item, an access's base, a call's callee and its
arguments, a prefix's operand, both operands of an eager binary operator and
the left one of a lazy one, a conditional's condition, and a comma's operand
([comma](comma/README.md)) — and never through a lazy one: the right operand of
`&&`, `||` or `??`, or a conditional's arm. `const c = null.x; export default
1 + c;` deletes `c`, the `+` evaluating it, where `1 && c` keeps it. A
function body is not lazy for this purpose, since constructing the function
evaluates its frame.
So `const c = null.x; export default [a && c, b && c];` keeps `c`,
`[',', [c, ['[]', [['&&', a, c], ['&&', b, c]]]]]`, and throws at load as
JavaScript does, where `[c, a && c]` deletes it, the array evaluating it
first. The rule holds one level down too: an operand another unreached
operand reaches only lazily is not deleted for it —
`const d = null.x; const c = a && d; export default b && c;` keeps both `d`
and `c`, since evaluating `a && d` as a root establishes `d` no more than
`b && c` established `c`. `anchors` in
[`fjs/compiler/ast`](../../fjs/compiler/ast/module.f.mjs) is the rule.

Unparenthesized, a function is no operand of these operators, the
conditional's condition included: `(...a) => body` reads everything to its
right as `body`, exactly as in JavaScript, so `1 * (...a) => 2` is refused
where `1 * (...a)` runs out of value to read, and `(...a) => 1 ? 2 : 3` is
one function whose body is the conditional. A group makes a function an
operand, the same way it does for `-`: `1 * ((...a) => 2)` is a value, `NaN`,
however little multiplying by a function is worth. The conditional's arms
are the exception: each is a whole value, as in JavaScript, so a function
stands in either bare, its body ending where `:` cannot continue it —
`1 ? () => 2 : 3` is the function and then the else arm, and
`0 ? 2 : () => 3 ? 4 : 5` is `0 ? 2 : () => (3 ? 4 : 5)`.

The front end computes none of these — it builds the operation and passes
it on. Unary `-` alone folds, over an operand that lowers to a number or a
`bigint`, exact and total arithmetic ([numbers](../values/numbers.md)); every other
operator here reaches the EDAG as a node, over numbers too (`1 + 2`, `~1`),
the lazy ones and the conditional included. `+` would need `ToPrimitive` to
decide number or string, and folding the rest while leaving `+` a node would
draw an inconsistent line: fold what is exact, and leave what needs an
assumption to the readers that want a value. Of the other outputs
([output](../command-line/output.md)), the Rust one spells every operator, running a lazy
operand or an arm only where JavaScript would, and calls an object's own
`valueOf` or `toString` when conversion requires it. JSON and DataJS output
evaluate these operators through the represented EDAG interpreter, then
check whether the selected result belongs to their data format. The
FunctionalScript writer, the `.js` output, spells every operator here, with
the parentheses its precedence and associativity ask for and no more —
`1 + 2 * 3` and `(1 + 2) * 3` come back as written, less the spaces, and
`(1 + 2) + 3` as `1+2+3`; `??` is never bare beside `&&` or `||`; a prefix
or a negative number on the left of `**` is grouped, `(-2)**2`; a `-`
before a text opening with `-` takes a space, `1- -2`; a function under an
operator, and an operator's text under an access, stand in a group,
`-(()=>1)` and `(1+2).x`; a value shared under one lazy operand
alone is written in a block of the operand's own ([functions](../functions/README.md));
and a comma's discarded operand is the `const` of the block it is anchored
in ([comma](comma/README.md)).
Read back, that text is the graph it was written from. Graph output retains
the operation, while value output retains its result: `export default 1 + 2 * 3;`
is `export default 1+2*3;` as FunctionalScript, `export default 7;` as DataJS
and `7` as JSON.

## Pages

- [Grouping](./grouping.md)
- [Comma](./comma/README.md)
- [`instanceof`](./instanceof.md)
- [`in` Is Refused](./in.md)

## Examples

The compiler demo offers the programs `index` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [ECMAScript language: expressions](https://tc39.es/ecma262/#sec-ecmascript-language-expressions)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators>
