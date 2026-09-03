# Template Literals

```js
const name = "world"
export default `Hello, ${name}!`
```

Untagged template literals: backtick-delimited strings with `${expression}`
substitutions, the `` \` `` and `\${` escapes, and literal line terminators
normalized to `\n`.

Depends on [expression](./3410-expression.md): a substitution embeds a full
expression, so this is an FJS-level feature, not the lexical sugar that
[js-string-literals](./2460-js-string-literals.md) describes — which is why
that document excludes it.

## Semantics

A template literal is sugar for concatenating its cooked string parts with its
substitutions. `` `a${x}b` `` denotes the same value as `"a" + x + "b"` once
`x` is a string.

## Open questions

1. **Substitution type.** ECMAScript applies `ToString` to every substitution,
   so `` `${1n}` `` is `"1"`, `` `${undefined}` `` is `"undefined"`, and
   `` `${obj}` `` calls `obj.toString()`. Implicit coercion of this kind is
   what FunctionalScript avoids elsewhere (see the `bigint`/`number` mixing
   rule in [new-pl.md](../../todo/new-pl.md)). The alternatives are to require
   substitutions to be `string` already, to permit the primitives with an
   unambiguous spelling, or to follow ECMAScript exactly for interop. This
   should be settled before the feature is implemented, since each choice
   makes a different set of programs valid.

2. **Tagged templates.** `` tag`a${b}c` `` is a function call receiving the
   cooked strings, a `raw` property, and the substitutions. It is a separate
   feature with its own grammar and a mutable-array-shaped argument; it is not
   assumed to be in scope here.

3. **Canonical form.** Content addressing wants one spelling per value. A
   template literal with no substitutions denotes exactly what a JSON string
   denotes, so — as with single-quoted strings — the parser has to record which
   sub-language a literal stayed within, or normalize on the way in.

## Rationale for deferring

Template literals add no values that JSON string syntax cannot already express;
they add a spelling, and — unlike the rest of the JS string forms — an
expression form as well. By the design rule in
[js-string-literals](./2460-js-string-literals.md), alternative spellings of
expressible values are syntactic sugar and get the lowest priority.

Until implemented, a template literal is mechanically rewritable as
concatenation: `` `a${x}b` `` → `"a" + x + "b"`, and a substitution-free
`` `abc` `` → `"abc"`.

That rewrite is not free in this repository: 202 of the 260 `.mjs` files use
template literals, with 494 substitutions between them. Like single-quoted
strings, they have to be normalized before the parser accepts the repository's
own sources — a precondition of the
[stage-2](../../fjs/fsc/README.md#stage-2-mark-compiler-compatible-functionalscript)
`.f.mjs` -> `.f.js` rename, which commits that the compiler in the same revision
accepts the complete module.

See
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals>
