## A block whose end is reachable

**Priority:** P2
**Status:** open — braced non-terminating `if` branches are implemented;
function-body rewrites and final-`if` admission remain

### Problem

A FunctionalScript function body ends in a terminating statement — a
`return`, a `throw`, a terminating switch or a terminal unconditional loop —
and cannot complete normally
([bodies and guards](../control-flow/guards/README.md)). The original guard
subset required an `if` branch to terminate too. JavaScript distinguishes
the two: a function that runs off its end returns `undefined`, while an
`if` branch that runs off its end continues after the `if`.

This issue tracks normally completing conditional branches separately from
the source rewrites that make a function's result explicit.

At `442ea8f` a reachable block end is the first refusal of 26 modules, 11 of
them among the modules the self-hosting loader depends on
([where self-hosting stands](../../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands)),
in three shapes:

- **A function body with no terminator**, 14 modules, 5 of the loader's: a
  body whose statements are only calls or `const`s, which JavaScript answers
  with `undefined`.

  ```js
  // fjs/effects: the strict reading of an operation map
  command => { assert(false, command) }
  // fjs/mcp: a CLI handler
  casMcpServer: () => { casMcpServer('/') },
  ```

  Visitor callbacks in `fjs/dev`, `fjs/ebnf/data` and `fjs/ebnf/ll1` have the
  same shape. The `fjs/effects` site alone is the first refusal of ten
  modules, nine of them through an import.
- **An `if` block with no terminator**, `else` included, 5 modules, 2 of the
  loader's: the statements after the `if` run on both paths.

  ```js
  // fjs/compiler/edag `_moduleExports`
  if (module instanceof Array) {
      if (module[0] === ',') { return … }
      if (module[0] === 'throw') { return [] }
  }
  throw 'expected a module export object'
  ```

  `fjs/cli`, `fjs/edag/value/object` and `fjs/ebnf/byte` (its `} else if`)
  are the others.
- **A `switch` that can finish without terminating**, 7 modules, 4 of the
  loader's: no `default` although every case returns (`fjs/types/btree` and
  its playground), or a `break` (`fjs/emergent_testing`). That `break`, with
  the brace-less case, is [3230](./3230-switch.md)'s open follow-up; it is
  listed here for the count.

### Proposal and stages

The three shapes take three different answers.

**A function body: keep the refusal, rewrite the source.**
[DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
names this very restriction as one that earns its place: "discourage falling
through the end of a function block without an explicit `return`: making the
intended result explicit helps expose accidental omissions." The terminator
rule is that guarantee, so the language keeps it and the modules state their
result: `return undefined` where `undefined` is what the body means, or a
`throw` where the body exists to fail, as the `fjs/effects` one does. Both
compile today. A body of calls then reads as one whose result was chosen,
not forgotten.

**An `if` block: a language extension.** An `if` block whose end is reachable
continues with what follows the `if`, with or without an `else`, and adds no
EDAG node. The function still ends in its own terminator, so §12's guarantee
is untouched. Bindings assigned in either arm are the branch result
the [variable contract](../bindings/variables/README.md#normalization) specifies
for general bindings: the current values of the outer mutable bindings, an unchanged arm
supplying the value before it. What follows the `if` is one shared
continuation; it is not copied into both arms, which would double the code at
every `if` in a sequence.

A normally completing `if` branch does not return `undefined` from its
function. It continues with the statements after the `if`; inserting a
function return there would skip those statements. In particular, the
fall-through paths in `fjs/cli`'s `dispatchCommands` and
`fjs/compiler/edag`'s `_moduleExports` must still reach their following
return or throw.

The generic syntax AST represents non-terminating branches independently of
FunctionalScript admission and FAST or EDAG compilation. The dependency
check can form that tree without requiring the module to compile. Source
admission and normalization then use the existing FAST branch results and
shared EDAG continuation.

**A `switch`:** [3230](./3230-switch.md)'s follow-ups. A `switch` with no
`default` is the function-body shape once more, rewritten the same way: the
cases stay as they are and a terminator follows the `switch` — `return
undefined`, the result an unmatched value reaches in JavaScript, or a `throw`
where no other value can arrive. Turning the last `case` into the `default`
would not do: it gives an unmatched value that case's result instead.

### Implementation scope and approval

The user explicitly requested implementation in the
[working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
The scope is braced normally completing `if` and `else` branches, including
`else if` chains, before the function body's own terminating statement.
Bare branches, module-level `if`, and an `if` used as the function body's
final terminator remain follow-ups. In particular, a final `if` whose arms
both return still needs a following function-body terminator in this step.
Function-body fall-through remains refused; this work does not add an
implicit `return undefined`.

### FAST and EDAG representation

The current [FAST types](../../fjs/js/ast/types.ts) already distinguish a
normal region exit, `['yield', values]`, from a function return,
`['return', functionTarget, value]`. An `if` statement declares its result
bindings; each normally completing arm yields their selected values. An arm
that leaves a binding unchanged yields its incoming value. With no updated
outer bindings, the normal exit is `['yield', []]`. Branch-local bindings do
not escape, and a returning or throwing arm supplies no normal result.

For this source:

```js
export default (c, x) => {
    if (c) { x = 1; }
    return x + 2;
};
```

The normalized FAST function has parameters `c` and `x0`, and this body.
Here `c`, `x0` and `x1` denote binding IDs, and `fn` is the owning function
target:

```js
{
    statements: [
        ['if', [x1], ['ref', c],
            { statements: [], exit: ['yield', [1]] },
            { statements: [], exit: ['yield', [['ref', x0]]] }],
    ],
    exit: ['return', fn, ['+', ['ref', x1], 2]],
}
```

The existing FAST-to-EDAG converter represents this body as the following
graph, without a new IR operation:

```js
['=>', 2, [], ['+', ['?:', ['arg', 0], 1, ['arg', 1]], 2]]
```

The selected value feeds one following addition. More generally, only normal
paths enter the shared continuation; a function return or throw bypasses it.
Keep condition evaluation and required branch work in their original order
and conditional region. Reuse the existing control-flow lowering rather than
introducing a new EDAG operation or a function invocation for the branch.

### Benefits and drawbacks of the `if` extension

Benefits: an `if` that only sometimes acts — an assertion, a lookup that falls
back to the code after it — is ordinary JavaScript, and five modules stop at
one; unlike a body that runs off its end, it hides no result, because the
function's own terminator still states it.

Drawbacks: the branch-result lowering and a shared continuation, where the
guard needed neither; and a reader of a guard can no longer assume that the
code after it runs only when the condition is false.

The earlier source workaround made a guard's block end in the `return` or
`throw` the code after it would reach, at the cost of repeating that code in
the arm. Shared continuations avoid that duplication.

### Tasks

- [ ] Rewrite the function bodies with no terminator, `return undefined` or a
      `throw`, and a terminator after each `switch` with no `default`; no
      approval needed.
- [x] Parse non-terminating `if` branches into the generic syntax AST without
      requiring FunctionalScript admission or FAST/EDAG compilation.
- [x] Record the user's explicit implementation approval and the initial
      braced-branch scope in the working session linked above.
- [x] Admit and normalize an `if` block whose end is reachable, and `else`,
      using existing FAST branch results and normal `yield` exits under the
      [variable contract](../bindings/variables/README.md#normalization), with
      a shared continuation through every output; the guard page and
      [refused constructs](./refused-constructs.md) updated.
- [ ] Admit an `if` as the function body's final terminating statement when
      every path terminates, without admitting function-body fall-through.
- [x] Check repository AST formation and newly admitted modules; rename any
      that become compilable.

### Related

- [bodies and guards](../control-flow/guards/README.md) — the terminator rule
  and the guard's follow-ups.
- [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  — why a function body keeps its explicit result.
- [3230 switch](./3230-switch.md) — `break` and the brace-less case.
- [Variables](../bindings/variables/README.md) — general bindings and their branch results.
- [MVP roadmap](../../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands)
  — what self-hosting waits on.
