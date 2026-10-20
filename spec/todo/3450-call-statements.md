## Call statements

**Priority:** P2
**Status:** open — language-design approval pending

```js
import { assert } from '../asserts/module.f.js'
export const at = (a, i) => {
    assert(i < a.length, 'out of range');
    return a.at(i);
};
```

A statement that is a call, `f(x);`, evaluated for its failure and its
value discarded, as in JavaScript. It is sugar over what the language
already has: the call is a `const` no name reads, anchored where the
block's other unread `const`s are, so the EDAG gets the `,` node a
discarded comma operand gets. No new node, executor or output work.

### Problem

The compiler refuses every expression statement
([refused constructs](./refused-constructs.md): `st.expression`), the call
`assert(a);` included. That is JavaScript's most common way to write an
assertion. The language has two other spellings of the same graph, and a
module must use one of them:

```js
const _ = assert(i < a.length, 'out of range');   // an unused const
return (assert(i < a.length, 'out of range'), a.at(i));   // the comma
```

**The refusal prevents no mistake.** Both spellings above discard a result
just as the statement does. All the refusal does is make a deliberate
discard look different from a forgotten one, and it does that by refusing
the deliberate one. [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
asks each restriction for the guarantee it protects or the mistake it
prevents, and the register's link for `st.expression`,
[functions](../functions/README.md), gives none.

**It is the largest blocker of the `.f.js` migration.** At `b164561`, the
parser's first refusal stands at a call statement in 218 of the 307 proofs
and in 31 of the 278 other authored `.f.mjs` modules. Among them are
[`fjs/types/function/compare`](../../fjs/types/function/compare/module.f.mjs)
and [`fjs/zlib/bits`](../../fjs/zlib/bits/module.f.mjs), two of the leaves
of the
[migration](../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point).
[CONVERTING.md rule 10](../../doc/CONVERTING.md#10-a-call-made-for-its-failure)
rewrites each such call through the comma, which is mechanical but changes
the source a module was reviewed in. A call statement would let it stay as
it is.

### Proposal

#### Syntax

A **call statement** is an expression statement whose expression is a call,
ended as every statement is, by `;` or where JavaScript inserts one
([module structure](../modules/README.md)):

- a call of any value the language reads, `f(x);`, `a.b(x);`, `f(x)(y);`,
  `entry(o, k);` and `(0, o.f)(x);`;
- a guarded call, and a chain whose last step is a call, `f?.(x);` and
  `a?.b.c(x);`;
- a group around one of those, `(f(x));`, since a group changes nothing
  about the call it holds ([grouping](../operators/grouping.md)).

It stands wherever a `const` stands: at the module level, in a function
body, in a guard's block, in a loop's block and in a `switch` case's block.

One other expression statement is already in the language and stays as it
is: the assignment to a loop's variable in the loop's block, `x = value;`
([loops](../control-flow/loops.md)). Every other expression statement stays
refused, as today:

- **an operator's result**, `x;`, `a.b;`, `a + f(x);`, `!f(x);` and
  `typeof f(x);`, which is almost always a mistake. A read made only for
  its failure is spelled as a `const` or a comma operand;
- **a conversion**, `Number(x);` and `String(x);`. Each is an operator,
  not a call ([operators and functions](../principles/README.md#operators-and-functions));
- **a string literal**, `"use strict";`, which JavaScript reads as a
  directive, not as an expression.

#### Semantics, by lowering

`f(x);` and the statements after it in its block are `const _ = f(x);` and
those statements, where `_` is a name nothing can read. Everything follows
from rules the language already has:

- **The call is evaluated where it stands, and its value is discarded**, as
  in JavaScript. Its one observable effect is its failure, which fails the
  block ([failure is one outcome](../principles/README.md#failure-is-one-outcome)).
- **The call is anchored as an unused `const` is**, at the nearest block
  root: the module's, a function body's, a guard's arm or a loop's block
  ([the anchoring rule](../operators/README.md),
  [bodies and guards](../control-flow/guards.md),
  [loops](../control-flow/loops.md)). In the EDAG that is the `,` node,
  the same graph as the comma and the unused `const`, so the three
  spellings hash alike.
- **Order is JavaScript's**, a statement before the ones after it. Under
  the failure contract an executor may still meet a later failure first.

`if (c) { assert(a); return 1; }` therefore establishes `assert(a)` only
where `c` is truthy, as JavaScript does, because the guard's block is a
block root of its own.

#### Outputs

None changes:

- **EDAG, Rust, JSON and DataJS:** the graph is the one an unused `const`
  already makes.
- **The FunctionalScript writer:** it spells the anchor as a `const` of
  its block, as it spells every anchor, so `assert(a);` comes back as
  `const $1=assert($0);`. Read back, that is the same graph. Writing the
  call statement back as a statement is a possible follow-up, not part of
  this proposal.

#### Discarded results

A call whose result was meant to be used, `xs.concat(ys);` written for
`return xs.concat(ys);`, compiles silently. The compiler has no warnings,
and **this proposal leaves the warning to linters**. The meaning is
JavaScript's, so it is a style question, not a wrong value
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
The same mistake is already possible through the comma and an unused
`const`.

No linter flags it by default. ESLint's `no-unused-expressions` exempts
calls on purpose, and TypeScript has no such check. A rule that did would
come from a plugin, `eslint-plugin-functional`'s
`no-expression-statements` for example, and adding one is a tool decision
of its own ([AGENTS.md §6](../../AGENTS.md#6-external-tools)). In a pure
language a forgotten result shows up as a value that never arrives, not as
a silent wrong one.

#### Implementation shape

- **Grammar.** A statement alternative for an expression, in every block
  that takes a `const`. The tokenizer hands every keyword over as an `id`,
  so the alternative has to be read where the keyword statements
  (`const`, `let`, `if`, `while`, `switch`, `return`, `throw`, `import`,
  `export`) are not. In a loop's block it shares its start with the loop
  variable's assignment, `x = value;`, which stays the statement it is.
- **Fold.** An expression statement whose node is a call, a guarded call
  or a chain ending in one, read through groups, enters as a `const` that
  binds no name. Any other expression is refused at its first token, as
  `st.expression` is now.
- **JavaScript's line rules come with it.** A statement may now begin with
  `(` or `[`, and JavaScript joins such a line to the one before when no
  `;` ends it: `const a = b` followed by `(0, f)(x)` on the next line is
  `const a = b(0, f)(x)`. The parser follows JavaScript there, so the
  meaning is JavaScript's. It is a familiar JavaScript trap, not a new one.

#### Benefits and drawbacks

**Benefits.**
- It preserves JavaScript's most common assertion idiom, with JavaScript's
  meaning.
- TypeScript's `asserts` signatures narrow after the call statement, the
  form they are written for.
- About two thirds of the proofs, and tens of modules, lose their first
  refusal, and a conversion leaves those calls as written.
- There is no new node, schema, executor or output work: only the grammar
  and the fold change.

**Drawbacks.**
- It adds a third spelling of one graph, beside the comma and the unused
  `const`.
- A forgotten result compiles without a warning, and is left to linters,
  which by default do not warn.
- The writer's output spells the call as a `const`, not as the statement
  written, as it already spells `if` and destructuring differently from
  their source.
- Statements may begin with `(` or `[`, which brings in JavaScript's
  line-joining rule for them.

### Tasks

- [ ] Language-design approval of the syntax, the lowering and the
      refusals above, recorded here with its link, as
      [DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
      requires.
- [ ] Grammar and fold, with proofs in every block that takes a `const`,
      for each call shape above, and for each refusal: an operator's
      result, a conversion, a string literal.
- [ ] The specification:
      - [functions](../functions/README.md), [module structure](../modules/README.md),
        [bodies and guards](../control-flow/guards.md),
        [loops](../control-flow/loops.md) and [switch](../control-flow/switch.md)
        take the statement;
      - the [register](./refused-constructs.md)'s `st.call` row is deleted,
        and `st.expression` is left with the other expression statements;
      - an example program in the compiler demo.
- [ ] [CONVERTING.md rule 10](../../doc/CONVERTING.md#10-a-call-made-for-its-failure)
      becomes "a call statement converts as written", and the comma rewrite
      is kept for expression bodies, `x => (assert(x), x + 1)`.
- [ ] [`fjs/AGENTS.md`](../../fjs/AGENTS.md), the
      [compiler README](../../fjs/compiler/README.md) and
      [default parameters](./3125-default-parameters.md) no longer give
      assertion statements as what keeps a proof `.f.mjs`.
- [ ] Rerun the
      [leaf migration](../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point)
      and convert the leaves it frees.

### Related

- [Comma](../operators/comma.md) — the expression form of the same graph,
  which an expression body still needs.
- [The anchoring rule](../operators/README.md) — where an unread `const`,
  and so a call statement, is anchored.
- [Refused constructs](./refused-constructs.md) — `st.call` and
  `st.expression`.
- [CONVERTING.md rule 10](../../doc/CONVERTING.md#10-a-call-made-for-its-failure)
  — the rewrite this makes unnecessary for statements.
