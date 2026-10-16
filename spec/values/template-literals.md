# Template Literals

**Status:** implemented

`sergey-shandar` approved the untagged-template design in
[#2822](https://github.com/functionalscript/functionalscript/pull/2822#issuecomment-6106236760),
as [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo) requires.

An untagged template is a backtick-delimited primary expression, with cooked
text chunks separated by `${expression}` substitutions:

```js
const name = "world";
export default `Hello, ${name}!`;
// "Hello, world!"
```

Each substitution uses the ordinary full expression grammar, including object
literals, function bodies and nested templates. A template can be an operand,
call argument or property-access base, as in `` `abc`.length ``. Empty templates
and adjacent substitutions are admitted too.

Text chunks accept JSON's escapes (`\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`,
`\t`, `\uXXXX`), escaped backticks and the escaped substitution opener `\${`.
Quotes stand raw. Only an unescaped `${` opens a substitution. Literal LF, CR
and CRLF are admitted; raw CR and CRLF cook to LF, while escaped `\r` or
`\u000D` stays CR. Raw U+2028 and U+2029 keep their values. Additional JavaScript
template escapes, other raw C0 controls and line continuations remain deferred
here and are refused. The quoted-string counterparts are tracked separately in
[js-string-literals](../todo/2460-js-string-literals.md), which excludes templates.
Malformed or unterminated templates and tagged templates such as `` tag`a${b}c` ``
are compilation errors.

The common escape set is uniform across single-quoted strings, double-quoted
strings and templates: changing the delimiter does not admit additional common
spellings such as `\0`, `\v`, `\xHH` or `\u{...}`. The template-specific
exceptions serve its syntax: escaped backticks and `${`, and literal line
terminators for multiline text. Any future widening of the common escape set
must be coordinated across quoted strings and templates.

| Refused template spelling | Admitted spelling with the same value |
| --- | --- |
| `` `\0${"key"}\0` `` | `` `\u0000${"key"}\u0000` `` |
| `` `\v` `` | `` `\u000b` `` |
| `` `\x41` `` | `` `A` `` or `` `\u0041` `` |
| `` `\u{1f600}` `` | `` `\ud83d\ude00` `` |

For a refused line continuation, join the lines without the continuation
sequence to preserve the value. Before marking a module compiler-compatible
with the `.f.js` extension, normalize any deferred spellings it uses. For
example, [`serializer/names`'s `_name`](../../fjs/compiler/serializer/names/module.f.mjs)
uses `` `\0${key}\0` ``; its supported equivalent is
`` `\u0000${key}\u0000` ``. Template support alone does not admit every existing
template spelling.

Every substitution is converted with [String](../conversions/string.md), and its
result is concatenated with the cooked chunks using left-associated binary
`+`. For example, `` `hello ${a}!` `` has the same meaning and EDAG as
`"hello " + String(a) + "!"`:

```js
['+', ['+', 'hello ', ['String', A]], '!']
```

Here `A` is the lowered expression for `a`. For chunks `s0` through `sn` and
substitutions `e1` through `en`, lowering starts with `r = s0`. In source order,
each substitution adds `r = ['+', r, ['String', lower(ei)]]`, then
`r = ['+', r, si]`. Every chunk, including an empty one, is retained, and
conversion is never folded away. Thus `` `${1}${2}` `` expands to
`"" + String(1) + "" + String(2) + ""`, producing `"12"`.

The result of a successful template evaluation is always a string. Evaluation
or conversion failure propagates under [failure is one outcome](../principles/README.md#failure-is-one-outcome):
the graph construction order does not impose evaluation-count or source-order
barriers on failing computations. Function conversion follows the existing
[function-source representation exception](../principles/README.md#function-source-representation-exception).

Explicit string conversion matters for objects: `String` tries `toString`
before `valueOf`, whereas raw `+` coercion tries them in the opposite order.

```js
const a = { valueOf: () => 7, toString: () => "a" };
export default ["hello " + a + "!", `hello ${a}!`];
// ["hello 7!", "hello a!"]
```

Some further examples:

```js
``;                      // ""
`abc`;                   // "abc"
`${1n}:${undefined}`;    // "1:undefined"
`sum: ${1 + 2}`;         // "sum: 3"
`${{ x: 1 }.x}`;         // "1"
`${`${1}`}!`;            // "1!"
`literal \${a}`;         // "literal ${a}"
`\``;                    // "`"
`\u0000${"key"}\u0000`;  // "\u0000key\u0000"
`line
break`;                  // "line\nbreak"
```

A template without substitutions lowers directly to its cooked string leaf,
so `` `abc` `` and `"abc"` have the same EDAG. Every template is FJS source
syntax, including this case; cooking does not classify it as JSON or DataJS.
FunctionalScript output writes a string or the explicit `String`/`+` expansion
instead of reconstructing template spelling. EDAG and Rust outputs use those
existing operations, and JSON and DataJS outputs evaluate them.

## Examples

The compiler demo offers the programs `templateLiterals` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [Template literals](https://tc39.es/ecma262/#sec-template-literals)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals>
