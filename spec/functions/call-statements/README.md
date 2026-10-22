# Call Statements

**Status:** implemented

```js
const assert = (...a) => a[0] ? undefined : (() => { throw a[1]; })();
const at = (a, i) => {
    assert(i < a.length, "out of range");
    return a.at(i);
};
export default at([1, 2, 3], 2);
```

A call written as a statement, `f(x);`, is evaluated where it stands and its
value discarded, as in JavaScript. In a pure language the one thing a
discarded call can do is fail, which makes the statement the assertion
form: `assert(i < a.length, "out of range");` is nothing where the
assertion holds, and the assertion's failure where it does not.
**sergey-shandar** approved the design in
[#3095](https://github.com/functionalscript/functionalscript/pull/3095#issuecomment-6296293233),
as [DESIGN.md §12](../../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires.

It stands wherever a `const` does: at the module level, before the exports
and among the exported `const`s, in a function's body, in a guard's block,
in a loop's block and in a case's block. It is ended as every statement is,
by `;` or where JavaScript inserts one
([module structure](../../modules/README.md)), so `f(1) f(2)` on one line is
refused at the second `f`, as JavaScript refuses it.

**It is a `const` nothing can read.** `f(x);` is `const _ = f(x);`, where `_`
is a name no statement can read: the two are one AST, and the call is
anchored as an unread `const` is, at the root of its block
([the anchoring rule](../../operators/README.md)). In the EDAG that is the `,`
node, the graph the comma operator makes of a discarded operand
([comma](../../operators/comma/README.md)), so `f(x); return y;` and
`return (f(x), y);` are one graph. A guard's block and a case's block are
block roots of their own, so `if (c) { assert(a); return 1; }` establishes
`assert(a)` only where `c` is truthy, as JavaScript does
([bodies and guards](../../control-flow/guards/README.md)). The FunctionalScript
writer spells the anchor as a `const` of its block, as it spells every
anchor: `assert(a);` comes back as `const $1=assert($0);`.

The value is any call: of a name, `f(x);`; of a member, `o.f(x);`; a
guarded call, `f?.(x);` and `o.f?.(x);`; a chain whose last step is a call,
`o?.f(x).g(y);`; a call of a call, `f(x)(y);`; and a static function's,
`Object.is(a, b);`. Any other value is refused at the statement's name
(`unexpected token`): an operator's result discarded, `x;`, `x.y;`,
`f(x).y;` or `f(x) + 1;`, is almost always a mistake, and a read made only
for its failure is spelled as a `const` or a comma operand. The
conversions, `Number(x);` and `String(x);`, are refused the same way: each
is an operator, not a call
([operators and functions](../../principles/README.md#operators-and-functions)).
A result meant to be used and forgotten, `xs.concat(ys);` written for
`return xs.concat(ys);`, compiles: the meaning is JavaScript's, and such a
warning is a linter's, which ESLint's `no-unused-expressions`, exempting
calls, does not give by default.

**The statement begins with a name**: an identifier, or `from` or `as`,
the words a statement may begin with where it is no keyword's. A statement
opening with anything else is not read. `(`, `[` and a backtick would
continue the statement before it where no `;` ends it — JavaScript reads
`f` on one line and `(g)(x)` on the next as `f(g)(x)`, and a backtick there
as the tagged template `` f`x` ``, which the grammar refuses at its head —
so the grammar could not tell them from a new statement with one symbol,
and `(0, o.f)(x);`, `(f(x));` and `` `a`.trim(); `` are refused, never
split into a statement JavaScript would not see. A prefix opens an
operator's result, refused as any is. A literal continues nothing before
it, so a call on one, `"a".trim();`, has no such hazard; it is left out
because no module calls a member of a constant for its failure, and
whether to admit it is open
([refused constructs](../../todo/refused-constructs.md): `st.literal-call`).
A reserved word, `var`, `for` or `else`, begins no statement either, and
is refused at the word. The design
first proposed admitting the two `(` spellings, and was amended for the
reason above; the comma spells the detached call where a value stands,
`const r = (0, o.f)(x);`.

`"use strict";`, JavaScript's directive, stays refused as it was: a module
is strict already, so it does nothing, and whether to admit it as the
nothing it is is a question of its own, open
([refused constructs](../../todo/refused-constructs.md): `st.directive`).

The one assignment the language has, to a loop's variable in its block,
`x = value;`, is the statement it was ([loops](../../control-flow/loops/README.md));
anywhere else an assignment is refused at its `=`.

## Examples

The compiler demo offers the programs `callStatements` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a call statement in a body: an
assertion that holds for `2` and fails for `5` — with every output `fjs
compile` makes of it: the expression graph (EDAG), the Rust and the
WebAssembly that Rust builds to. Its Run button calls the default export
with `2` and `5`, as JavaScript and as WebAssembly, and shows what each call
returned or threw.

```js
const assert = (...a) => a[0] ? undefined : (() => { throw a[1]; })();
const at = (a, i) => {
    assert(i < a.length, "out of range");
    return a.at(i);
};
export default (...a) => at([1, 2, 3], a[0]);
```

## Reference

- ECMA-262: [Expression statement](https://tc39.es/ecma262/#sec-expression-statement)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/Expression_statement>
