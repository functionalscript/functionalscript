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
General ASI and the `entry` matcher are not implemented.

### Proposal

```text
source and line-terminator information
    → JavaScript statement/expression AST
    → binding resolution and early-error validation
    → complete AST-pattern recognition and FJS admission
    → EDAG lowering
```

The phases may share a traversal; their contracts may not be bypassed.
Factor the current fold where name resolution and FJS-specific admission are
combined. A protected namespace such as `Object` may be resolved for matching
without exposing it as an ordinary value. Validate whole recognized subtrees
before rejecting their otherwise-prohibited components; every unmatched use
remains refused. This does not require implementing or admitting all JavaScript.
It does require syntactically understanding every construct inside a pattern.

**The matcher does not see whitespace, perform ASI or decide statement
boundaries.** It sees a parsed expression/function body with binding
relationships and control flow intact. Match the complete subtree, not just
the last expression in a body. Metadata stays separate. Binding placeholders
are not raw text substitution: repeated references must resolve to the same
binding, and a shadowed `Object` is not the intrinsic namespace.

These bodies are not the same AST:

```js
const first = (...a) => { return a[0]; };
const second = (...a) => { return
a[0]; };
```

JavaScript gives the second body a return without an expression followed by
an unreachable expression statement. If the subset does not admit that body,
reject it. Never attach the later expression to the return or recognize an
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
- [ ] **P1:** implement shared binding-aware AST recognition and FJS admission;
      require syntactic support for each pattern body before admitting it.
- [ ] **P1:** test source → tokens → AST → EDAG, not only token matches.
      Compare valid layouts with native JavaScript and verify rejected invalid
      layouts; distinguish different statements even when ordinary tokens agree.
- [ ] **P2:** implement JavaScript-compatible statement termination/ASI for
      admitted statement forms. Preserve refusal for unsupported constructs;
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
- [ECMAScript ASI](https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-automatic-semicolon-insertion).
