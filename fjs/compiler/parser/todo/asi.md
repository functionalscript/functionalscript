## Automatic semicolon insertion

**Priority:** P2
**Status:** open

### Problem

A statement ends only at an explicit `;`
([module structure](../../../../spec/README.md#module-structure)), so a module
written in the repository's own style, which leaves `;` out, is refused at its
first statement boundary. JavaScript accepts the same text and reads it by its
automatic semicolon insertion (ASI) rules. Refusing it is compatible: the
accepted language stays a subset of JavaScript, and requiring `;` is not a
defect ([compatibility](../../../../todo/fjs-javascript-compatibility.md)).
The cost is reach. Every module written in that style meets it: a missing
`;` stands at the first statement boundary of each, is the first thing the
compiler reports in half of the refused ones, and hides whatever the module
does next.

At `0802ecda`, every tracked `.f.mjs` module with no `import` statement, no
`export … from` and no `import()` outside a comment — twenty-eight of them —
was compiled to
`.edag.data.js`, the output that refuses least: the `.js` writer refuses
every operator but unary `-` and every call, and the Rust one a `bigint`
past `i64`, so either would count the writer's limits along with the
parser's. Seven compiled, `fjs/compiler/examples/m` and the six DataJS
vector modules; twenty-one were refused. In ten of those the first thing
the compiler reports is the missing `;` after the first statement. In the
other eleven a token the language does not have — a template literal, a `\v`
escape, a hex number — or a construct inside the first statement is
reported first, since a lexical error is reported wherever it sits, and the
missing `;` shows only once that is fixed. With a `;` added after every
statement and nothing else changed, five compile to `.edag.data.js` and to
`.rs`: `fjs/ci/config`, `fjs/js/prototype`, `fjs/nanvm/constructors`,
`fjs/types/btree/types` and `fjs/types/range` — the last two not to `.js`,
whose writer refuses their `&&` and `?:`. For two more, `fjs/js/keywords`
and `fjs/website/style`, one other construct remains, a spread and a
template literal.

### Drawbacks

Every drawback is JavaScript's own, inherited exactly, and none is new to a
reader of JavaScript; they are listed so that the trade is a choice.

- **Two spellings of one module.** With the `;` optional, a module written
  with and without it is the same program, so a canonical form has to
  choose: the compiler's `.js` output keeps writing every `;`, and DataJS
  keeps requiring it, so a DataJS document stays one spelling. Nothing is
  gained by admitting the second spelling into those.
- **The hazards ASI is known for.** `a` followed by `(b)` on the next line
  is the call `a(b)`, and `a` followed by `[0]` is the index `a[0]`, in
  JavaScript and so here: a newline never ends a statement the parser can
  continue. A reader who leaves the `;` out has to know that, exactly as
  in JavaScript. The language has no `++`, `throw`, `break` or `yield`, so
  the other restricted productions do not arise; the two it has, `return`
  and `=>`, refuse a line break already.
- **A worse message for one mistake.** Two statements on one line without
  a `;` between them are refused at the second statement's first token,
  `unexpected token`, as today; but where the second statement is itself
  malformed, the grammar's failure inside it is reported first, and the
  missing `;` not at all, since a match that fails builds no module for
  the fold to check. That is the existing order of syntax before names,
  not a new one.
- **One more place the newline is read.** The newline is already kept — the
  tokenizer emits it as an `nl` token — and already read, in the two places
  JavaScript forbids one, after `return` and before `=>` (`sameLine` in the
  grammar). ASI adds a third reading, at every statement boundary, and a
  different one: not a refusal where a newline stands, but a permission
  where one does. That check, one per statement, is the whole incremental
  cost; the machinery it reads is paid for.

The benefit is reach, above: the repository's own modules, and JavaScript
written in the common style, stop being refused for a token that carries
no meaning.

### Proposal

Grow the shared syntactic front end to accept an omitted `;` where
ECMAScript's ASI rules permit one, and nowhere else. **A newline is not a
separator by itself**:

```js
const f = (...a) => a[0]
const x = f
(7)
export default x
```

This initializes `x` by calling `f(7)`; it does not end the initializer at `f`.
Likewise `[1]` followed by `[0]` on the next line is an index access, and a
newline inside `return (…)` does not end the return. `return` followed by a
newline is different, and a newline before `=>` remains invalid. Cover
expression continuation before inserting a terminator, including continuations
using operators not yet admitted by FunctionalScript: "unsupported" is not a
reason to invent an earlier statement boundary. Do not mechanically make every
`;` optional or insert one at every newline.

Centralize ECMAScript's restricted productions, including line breaks in
comments, and the insertion rules at a line break, `}` and end of input.
`sameLine` in [`grammar/module.f.mjs`](../grammar/module.f.mjs) already
enforces the two restrictions the language reaches today, after `return` and
before `=>`. When constructs such as `for` or `throw` are added, their own
grammar and ASI restrictions apply too.

**LL(1) first.** The [compiler README](../../README.md) lists ASI as one of
the reasons a full ECMAScript parser isn't LL(1). The first step is to show
whether the subset's grammar can still express it. The insertion point is
where no production continues the statement. An LL(1) parser already sees
that point in the next token, together with whether a newline preceded it, so
the rule may be a terminator production rather than a second parse. If the
current LL(1) representation cannot express the boundary rule, extend the
shared parser rather than giving each construct a miniature parser, and keep
the explicit-stack parsing approach.

Canonical output keeps emitting `;`. DataJS's separate syntax keeps requiring
it ([DataJS](../../../../spec/datajs/README.md)).

### Tasks

- [ ] Show whether the LL(1) grammar can express ASI for the supported
      syntax, or which extension the shared parser needs.
- [ ] Implement JavaScript-compatible statement termination for supported
      syntax. Preserve refusal for unsupported constructs.
- [ ] Cover LF, CR, CRLF, line and block comments, newline before `=>`,
      newline after `return`, a return with a parenthesized multiline
      expression, call/index/member continuation, insertion at end of input
      and before `}`, and same-line missing semicolons. Preserve the existing
      Unicode-separator refusal unless support is added through the shared
      tokenizer/parser contract.
- [ ] Update [module structure](../../../../spec/README.md#module-structure),
      which names ASI among what FunctionalScript refuses.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [statement-aware-intrinsics](./statement-aware-intrinsics.md) — where this
  task was filed. Its P1 requirement, that no pattern bypass statement and
  expression recognition, holds before and after this expansion.
- [Compatibility epic](../../../../todo/fjs-javascript-compatibility.md).
- [ECMAScript ASI](https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-automatic-semicolon-insertion).
