## A block whose end is reachable

**Priority:** P2
**Status:** wip — generic branch syntax and the approved one-outer-binding
normal-completion profile are implemented; broader conditional completion and
joins remain open, while function bodies still need explicit terminators

### Problem

A FunctionalScript function body ends in an explicit terminating statement,
while a normally completing conditional branch continues after its `if`
([bodies and guards](../control-flow/guards/README.md)). The first admitted
ordinary-function branch profile joins at most one assigned outer binding;
the broader mixed-return and multi-binding forms remain open. JavaScript also
lets a function run off its end and return `undefined`; FunctionalScript keeps
that case separate and refuses it. This issue tracks the branch extensions
and source rewrites needed by function bodies without explicit terminators.

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

The three shapes take three different answers. The inventory above is pinned
to its original commit; it has not been recounted after the bounded branch
admission below.

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

The generic syntax AST now represents these ordinary conditional branches
independently of FunctionalScript admission and FAST or EDAG compilation.
This lets the module dependency check parse the source without requiring it
to compile. The first FJS admission increment uses the existing FAST branch
results: both arms complete normally and may assign at most one outer
binding, with an omitted `else` retaining its incoming value. Branch-local
writes do not count toward that bound. The surrounding function keeps its
explicit terminator.

Nested normal conditionals and loops retain their lexical scopes and local
loop transfers. An owning-function return or explicit throw inside a normal
arm, including in its loops, remains refused; a nested ordinary function has
its own return owner. Broader joins and partly returning arms are separate
increments under the
[control-flow contract](../../fjs/todo/compiler-vocabulary-and-modularization.md#control-flow-contract-review).

The language designer `sergey-shandar` approved the contract and this bounded
case 6 increment in the
[working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006),
by instructing implementation after the case 6 proposal. This records approval
for that increment, not for every form described by the general model.

**A `switch`:** [3230](./3230-switch.md)'s follow-ups. A `switch` with no
`default` is the function-body shape once more, rewritten the same way: the
cases stay as they are and a terminator follows the `switch` — `return
undefined`, the result an unmatched value reaches in JavaScript, or a `throw`
where no other value can arrive. Turning the last `case` into the `default`
would not do: it gives an unmatched value that case's result instead.

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

The source spelling is now admitted, and the existing FAST-to-EDAG converter
represents its normalized FAST as the following graph:

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

The alternative that needs no approval is a rewrite here too: a guard's block
can end in the `return` or `throw` the code after it would reach, at the cost
of repeating that code in the arm.

### Tasks

- [ ] Rewrite the function bodies with no terminator, `return undefined` or a
      `throw`, and a terminator after each `switch` with no `default`; no
      approval needed.
- [x] Parse non-terminating `if` branches into the generic syntax AST without
      requiring FunctionalScript admission or FAST/EDAG compilation.
- [x] Record formal language-design approval for the bounded case 6 profile,
      with a link, under
      [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions).
- [x] Admit and normalize normal arms with optional `else` and at most one
      assigned outer binding, using existing FAST results and normal `yield`
      exits under the
      [variable contract](../bindings/variables/README.md#normalization).
      Update the guard page and [refused constructs](./refused-constructs.md).
- [ ] Extend ordinary-function admission to partly returning branches and
      broader joins under the completion and ownership contract, preserving
      one shared normal continuation and explicit function terminators.
- [ ] Recount the modules this unblocks and rename those that then compile.

### Related

- [bodies and guards](../control-flow/guards/README.md) — the terminator rule
  and the guard's follow-ups.
- [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  — why a function body keeps its explicit result.
- [3230 switch](./3230-switch.md) — `break` and the brace-less case.
- [Variables](../bindings/variables/README.md) — general bindings and their branch results.
- [MVP roadmap](../../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands)
  — what self-hosting waits on.
