## Call statements

**Priority:** P2
**Status:** open — approved, implementation pending

**Language-design approval.** **sergey-shandar** asked for the proposal in
[the LLM working session](https://claude.ai/code/session_01Hqrk4Np3kC1KXH2GHwRbwC)
and recorded "[The design is approved!](https://github.com/functionalscript/functionalscript/pull/3095#issuecomment-6296293233)"
on the pull request that proposed it, as
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
requires.

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

A **call statement** is an expression statement whose expression is a call
and which begins with a name, ended as every statement is, by `;` or where
JavaScript inserts one ([module structure](../modules/README.md)):

- a call of a name or of a member, `f(x);`, `a.b(x);`, `f(x)(y);` and
  `entry(o, k);`;
- a guarded call, and a chain whose last step is a call, `f?.(x);` and
  `a?.b.c(x);`.

**It begins with a name.** A statement opening with `(`, `[` or a template
literal would continue the statement before it where no `;` ends it:
JavaScript reads `const a = b` and, on the next line, `(0, f)(x)` as
`const a = b(0, f)(x)`, and a backtick there as a tagged template,
`` b`x` ``. So `(0, o.f)(x);`, `(f(x));` and `` `a`.trim(); `` are not
admitted: one symbol could not tell them from the continuation, and the
grammar already refuses a tagged template at its head, so such a line is
refused, never split into a statement JavaScript would not see. The comma
spells the detached call where a value stands, `const r = (0, o.f)(x);`.

A call on a literal, `"a".trim();` or `1 .toFixed(2);`, has no such hazard:
a literal continues nothing before it. It is left out because no module
calls a member of a constant for its failure, not for a guarantee it would
break, so admitting it is an open question of its own, under the register
row `st.literal-call`, and not a decision of this proposal.

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
  directive, and which in a module, strict already, does nothing. This
  proposal does not decide it: it stays refused as it is today, under a
  register row of its own, `st.directive`, whose question — admit the
  directive as the nothing it is, or refuse it for a reason — is open.

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
- **No line rule changes.** A statement begins with a name, and a name
  continues no value before it: on a new line it begins a statement, as
  JavaScript inserts the `;` there, and on the same line it is refused, as
  a statement after an omitted `;` is. A statement opening with `(`, `[` or
  a backtick is not read, for the reason above.

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
- A call statement opening with `(`, `[` or a backtick, valid JavaScript,
  stays refused: `(0, o.f)(x);` is written as a `const`, or with the comma
  where a value stands.

### Tasks

- [x] Language-design approval of the syntax, the lowering and the
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
      - [`todo/edag-stage1-discussion.md`](../../todo/edag-stage1-discussion.md),
        whose subject 8 says the bare call statement stays refused, says it
        compiles;
      - the [register](./refused-constructs.md)'s `st.call` row is deleted,
        `st.expression` is left with the other expression statements, and
        `st.let-while` no longer counts a call statement among what a
        loop's block may not hold;
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
