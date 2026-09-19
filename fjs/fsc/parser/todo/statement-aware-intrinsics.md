## Recognize instructions after statements

**Priority:** P1
**Status:** open

### Problem

**Every pattern instruction MUST be recognized at a level where statements
and expressions have already been recognized correctly.**

The former `entry` proposal matched a token shape before its internal syntax
was supported. That duplicates or bypasses the language parser: discarding
line breaks first can change `return` semantics or admit an invalid arrow.
A newline patch inside that matcher would leave the architectural problem.

This is a proposed-design correction, not a demonstrated current miscompile.
At `0944e91bcec22d1f41b372bbe4b20219a096ab04`,
[`grammar/module.f.mjs`](../grammar/module.f.mjs)'s `sameLine` is used after
`return` and before `=>`. The [JavaScript tokenizer](../../../js/tokenizer/module.f.mjs)
preserves `nl`, including CR/LF within a block comment, and
[`grammar/proof.f.mjs`](../grammar/proof.f.mjs) covers those refusals. Unicode
line/paragraph separators are rejected outside strings in the current subset.
General Automatic Semicolon Insertion (ASI) and the `entry` matcher are not
implemented.

### Proposal

```text
source and line-terminator information
    → JavaScript-subset AST
    → try to compile into EDAG
        resolve bindings and check const visibility
        validate JavaScript early errors
        recognize complete instruction patterns
        enforce FunctionalScript restrictions and lower computations
    → EDAG or compilation error
```

**The AST describes the JavaScript syntax we understand, not a program already
admitted as FunctionalScript.** Preserve ordered statement lists, declarations,
identifier references, parameter lists, block bodies and explicit returns
(with or without an expression). A block is not assumed to be constants plus
one final result. Keep source metadata separate; preserving source order in
this tree does not impose source-order execution barriers on the EDAG.

Evolve the earlier representation in [`parser/types.ts`](../types.ts) rather
than add another redundant source tree. The indexed `cref`/`aref` references,
`args` and implicit final-result bodies in [`ast/types.ts`](../../ast/types.ts)
already embody lowering decisions. They may be compiler-internal artifacts;
they must not determine which JavaScript syntax the source AST can represent.
No separately exposed, fully validated FJS AST is required between the source
AST and EDAG.

AST-to-EDAG compilation owns FJS admission, including const visibility,
supported captures and protected-operation patterns. It may use several
internal passes. Resolve each pattern's binding relationships before relying
on them, and discharge every JavaScript early error before reporting successful
compilation, including in syntax that lowering would otherwise discard.
Factor the current fold where resolution and FJS-specific admission are mixed.
A protected namespace such as `Object` may be resolved for matching without
exposing it as an ordinary value. Match complete subtrees before refusing their
otherwise-prohibited components; every unmatched protected use remains refused.

This does not require parsing all JavaScript immediately. It requires parsing
every construct inside a proposed pattern with JavaScript's interpretation.
For example, [named parameters](../../../../spec/todo/3120-parameters.md) must
be represented before recognizing the `entry` helper. General EDAG lowering
for every function using named parameters is not a prerequisite for that one
approved pattern. Parsing a descriptor call, mutation or unsupported capture
likewise does not grant permission to execute it.

**The matcher does not see whitespace, perform ASI or decide statement
boundaries.** It consumes the parsed subtree with binding relationships and
control flow intact, not merely the last expression in a body. Binding
placeholders are not text substitution: repeated references must resolve to
the same binding, and a shadowed `Object` is not the intrinsic namespace.

These bodies are not the same AST:

```js
const first = (...a) => { return a[0]; };
const second = (...a) => { return
a[0]; };
```

JavaScript gives the second body a return without an expression followed by
an unreachable expression statement. Once that syntax is represented, the
AST-to-EDAG compiler either implements its actual meaning or refuses it as
unsupported. Never attach the later expression to the return or recognize an
intrinsic by ignoring the different statement structure. Syntax-invalid text
such as a newline before `=>` cannot reach matching at all.

#### JavaScript statement boundaries, not newline splitting

Grow the shared syntactic front end to accept omitted `;` where ECMAScript's
ASI rules permit it. Newlines are not separators by themselves:

```js
const f = (...a) => a[0]
const x = f
(7)
export default x
```

This initializes `x` by calling `f(7)`; it does not end the initializer at `f`.
Likewise `[1]\n[0]` is an index access, and a newline inside `return (\n...\n)`
does not end the return. `return\nexpression` is different, while a newline
before `=>` remains invalid. Cover expression continuation before inserting a
terminator, including continuations using operators not yet admitted by FJS:
"unsupported" is not a reason to invent an earlier statement boundary.

Centralize ECMAScript's restricted productions, including line breaks in
comments, and the insertion rules at a line break, `}` and end of input.
Do not mechanically make every `;` optional or insert one at every newline.
When constructs such as `for` or `throw` are added, their own grammar and ASI
restrictions apply too. Keep the explicit-stack parsing approach; if the
current LL(1) representation cannot express the boundary rule, extend the
shared parser rather than giving each intrinsic a miniature parser.

Canonical output may continue emitting `;`, and DataJS's separate syntax
continues requiring it. The current mandatory-semicolon FJS subset is
compatible: optional-semicolon support is a **P2 syntax expansion**, not a
current P1 defect. The **P1 requirement** is that no pattern bypass correct
statement/expression recognition, before or after that expansion.

### Tasks

- [x] Replace the token-bypass proposal with the statement-aware AST boundary.
- [x] Clarify that the source AST is a JavaScript syntax subset; admission,
      visibility checks and pattern matching belong to AST-to-EDAG compilation.
- [x] Preserve blocks and explicit returns in the existing source tree, as
      ordered tagged declarations followed by a value-returning statement.
      Lowering retains the existing executable representation. Source-tree and
      EDAG proofs pin this first slice; accepted syntax is unchanged.
- [x] Support explicit bare `return;`. Keep its absent expression in the source
      AST and lower it to undefined, preserving preceding declarations and their
      checks. Source/EDAG proofs cover the distinction from `return undefined;`,
      execution and newline refusals. This syntax increment keeps the bare
      semicolon on the same line; general ASI and extra statements remain open.
- [ ] **P1:** implement this boundary before shipping pattern instructions.
      Preserve statements and binding syntax until their meaning is checked;
      do not require a second, fully validated FJS source AST.
- [ ] **P1:** test source → tokens → AST → EDAG, not only token matches.
      Compare valid layouts with native JavaScript and verify rejected invalid
      layouts; distinguish different statements even when ordinary tokens agree.
      Also test syntax that parses but is refused during EDAG compilation.
- [ ] **P2:** implement JavaScript-compatible statement termination/ASI for
      supported syntax. Preserve refusal for unsupported constructs;
      update the current-language specification when the implementation lands.
- [ ] Cover LF, CR, CRLF, line/block comments, newline before `=>`, newline
      after `return`, return with a parenthesized multiline expression,
      call/index/member continuation, EOF/`}` insertion, and same-line missing
      semicolons. Preserve existing Unicode-separator refusal unless support
      is added through the shared tokenizer/parser contract.
- [ ] Test matching with renamed bindings, shadowing, extra statements and
      escaped protected operations. A parsed descriptor used outside a whole
      approved pattern must not become an executable FJS value.
- [ ] Run the repository's required type, test and coverage checks when code
      changes land. A standalone JavaScript oracle is not an FJS pipeline test.

### Related

- [Language principles](../../../../spec/README.md#principles).
- [Compatibility epic](../../../../todo/fjs-javascript-compatibility.md).
- [Entry function](../../../edag/todo/entry.md).
- [Enumerable presence](../../../../spec/todo/2345-has-own-property.md).
- [Named parameters](../../../../spec/todo/3120-parameters.md).
- [ECMAScript ASI](https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-automatic-semicolon-insertion).
