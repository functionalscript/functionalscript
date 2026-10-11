# Template Literals

**Priority:** P5
**Status:** open — proposal; language-design approval pending

## Problem

The compiler does not accept template literals, although the repository uses
them throughout its `.f.mjs` sources. They must be supported or rewritten before
those modules can make the
[stage-2](../../fjs/compiler/README.md#stage-2-mark-compiler-compatible-functionalscript)
`.f.mjs` → `.f.js` rename, which commits that the compiler in the same revision
accepts the complete module.

```js
const name = "world";
export default `Hello, ${name}!`;
```

## Proposal

### Scope

Admit untagged, backtick-delimited template literals with `${expression}`
substitutions. Each substitution uses FJS's full expression grammar, including
object literals and nested templates admitted by this proposal. The whole
template is a primary expression, usable in an operand, call argument or
property-access base.

Cook each text chunk before lowering: accept JSON's escapes plus escaped
backticks and the escaped substitution opener `\${`. Allow literal line
terminators, normalizing raw CR and CRLF to LF, as JavaScript does; raw LF,
U+2028 and U+2029 keep their values. An escaped `\r` stays CR. Additional JS
escapes, other raw C0 control characters and line continuations remain deferred
under [js-string-literals](./2460-js-string-literals.md).

Tagged templates, such as `` tag`a${b}c` ``, remain a separate feature and must
be refused. This proposal does not add a tag call, a `raw` array, or any new
values to DataJS. Even a substitution-free template is FJS syntax, not JSON or
DataJS syntax; normalization into a string does not change that classification.

### Substitution conversion

Convert every substitution with the existing
[String conversion](../README.md#string-conversion), then concatenate the cooked
chunks and converted strings with `+`. For example:

```js
// Proposed source:
`hello ${a}!`;

// Equivalent FJS:
"hello " + String(a) + "!";
```

Evaluate each substitution once, from left to right, and convert it before
evaluating the next substitution. A failure during evaluation or conversion
propagates without evaluating later substitutions. The result is always a
string. Function conversion follows FJS's existing
[function-source representation exception](../README.md#function-source-representation-exception).

This is consistent with current FJS, whose
[operators](../README.md#operators) already use JavaScript's coercion rules.
Requiring strings only, or allowing primitives only, would reject values the
existing `String` conversion handles and would diverge from JavaScript.

The `String` operation cannot be replaced with raw `+` coercion. `+` tries an
ordinary object's `valueOf` before its `toString`; string conversion tries them
in the opposite order. These own functions are valid FJS, and the current
compiler and evaluator already distinguish the results:

```js
const a = { valueOf: () => 7, toString: () => "a" };
export default [
    "hello " + a + "!",
    "hello " + String(a) + "!"
];
// Result: ["hello 7!", "hello a!"]
```

The proposed template `` `hello ${a}!` `` therefore produces `"hello a!"`.

### EDAG lowering and normalization

Reuse the existing binary `+` and unary `String` nodes in
[EDAG](../../fjs/edag/types.ts); no new EDAG operation or VM instruction is
needed. If `A` is the lowered expression for `a`, the example becomes:

```js
['+', ['+', 'hello ', ['String', A]], '!']
```

For cooked chunks `s0` through `sn` and substitutions `e1` through `en`, start
with `r = s0`. For each substitution in source order, set
`r = ['+', r, ['String', lower(ei)]]`, then `r = ['+', r, si]`.
Keep every chunk, including empty chunks, in this initial lowering. These are
left-associated binary nodes, not a variadic `+` or an eagerly evaluated list.
Do not fold away a substitution's conversion.

A template with no substitutions lowers directly to its cooked string value:
`` `abc` `` and `"abc"` have the same EDAG string leaf. Templates with
substitutions have the same graph as their explicit, left-associated
`String`/`+` expansion. The existing FJS writer can emit that expansion; it
does not need to reconstruct the original template spelling.

The tokenizer and parser must retain that the source used template syntax
until its language and escape policy have been checked. In particular, cooked
text alone cannot distinguish `A` from the deferred escape `\x41`. Coordinate
that provenance with the
[template lexing proposal](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md),
which currently specifies only chunk text. Its token payload must also
distinguish admitted escapes from deferred ones. Reuse its head/middle/tail
token boundaries and nesting contexts rather than defining a competing token
stream here.

### Examples

These are proposed template forms and their values after cooking and conversion:

```js
``;                      // ""
`abc`;                   // "abc"
`${1}`;                  // "1"
`${1}${2}`;              // "12"
`a${""}b`;               // "ab"
`${1n}:${undefined}`;    // "1:undefined"
`sum: ${1 + 2}`;         // "sum: 3"
`${{ x: 1 }.x}`;         // "1"
`${`${1}`}!`;            // "1!"
`literal \${a}`;         // "literal ${a}"
`\``;                    // "`"
`line\nbreak`;           // "line\nbreak"
```

Adjacent substitutions must remain string concatenation:
`` `${1}${2}` `` expands to `"" + String(1) + "" + String(2) + ""`, never
numeric `1 + 2`. A single substitution similarly expands to
`"" + String(a) + ""`, preserving conversion and a string result even when both
surrounding chunks are empty.

Literal newlines are cooked as text, too:

```js
`line
break`;                  // "line\nbreak"
```

### Benefits and drawbacks

This admits a familiar JavaScript expression form used by the repository and
keeps substitution behavior consistent with existing FJS conversions. Lowering
to existing EDAG nodes reuses their evaluators, Rust output and source writers.

The added complexity is in parsing: text chunks alternate with full expressions,
and nested templates and object or function braces need the lexer's context
stack. Object conversion can call user-defined pure functions and fail, so
interpolation is not merely concatenating literal text. The initial escape
subset and refusal of tagged templates remain JavaScript compatibility limits.
The explicit conversion and concatenation nodes also make the graph larger than
a dedicated template node would; a new node is not needed to implement the
semantics.

## Tasks

- [ ] Obtain and record the approving language designer and approval link under
      [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
      before implementation.
- [ ] Complete or reuse the shared template lexing work, retaining enough
      source provenance to check the accepted escape subset before cooking
      discards its spelling.
- [ ] Admit untagged templates as primary expressions, parse each substitution
      through the existing expression grammar, and refuse tagged templates,
      unsupported escapes and malformed or unterminated templates with a
      located error.
- [ ] Lower to the existing `String`/binary `+` forms above, preserving
      substitution order, failure propagation, empty chunks and nested forms.
- [ ] Prove parsing, cooking and lowering for the examples, raw CR/CRLF versus
      escaped `\r`, U+2028/U+2029, object and function braces, precedence, and
      malformed or refused forms.
- [ ] Prove the own-method conversion distinction, nonprimitive or throwing
      conversion results, and failure before a later substitution; compare
      values with JavaScript and the explicit FJS expansion.
- [ ] Prove source round trips and existing EDAG, value and Rust output routes;
      update the specification with the approved semantics and remove this TODO
      when the feature ships.

## Related

- [Template lexing](../../fjs/ebnf/lib/js/todo/single-quote-and-template-lexing.md)
  — shared token boundaries, cooking and nesting context.
- [JS string literals](./2460-js-string-literals.md) — other escapes and
  spellings remain deferred.
- [FJS/NaNVM integration](../../todo/fjs-nanvm-integration.md) — compiler
  compatibility and the `.f.mjs` → `.f.js` migration.
- [String conversion](../README.md#string-conversion) — the operation each
  substitution uses.
- [Compiler EDAG lowering](../../fjs/compiler/edag/module.f.mjs) — existing
  binary and conversion node lowering.
- [Template literals on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
  — JavaScript reference.
