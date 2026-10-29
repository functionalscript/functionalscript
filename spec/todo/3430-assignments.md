## Additional Assignment Operators

**Priority:** P4
**Status:** wip — proposing identifier-target `>>=` desugaring; implementation
awaits explicit language-design approval

### Problem

The compiler admits variable assignment and binary right shift, but refuses
their compound spelling. `repeat` in
[`fjs/common/monoid`](../../fjs/common/monoid/module.f.mjs) uses `ni >>= 1n`:
the equivalent `ni = ni >> 1n` expresses the same immutable state transition.
The refusal adds a source rewrite without protecting purity or binding safety.

### Proposal

#### First increment: right-shift assignment to a variable

Admit `name >>= expression;` wherever an ordinary assignment statement is
admitted, including module and function bodies and the blocks of guards and
loops. The target is one identifier naming a mutable binding: an initialized
`let` or a parameter, under all the existing
[variable rules](../bindings/variables/README.md).

```js
let n = 8n;
n >>= 1n;
return n;
```

Desugar this statement to:

```js
let n = 8n;
n = n >> 1n;
return n;
```

Read the current target value before evaluating the right operand, evaluate
that operand once, apply the existing `>>`, then establish the new value of
the binding. Both Number and BigInt retain JavaScript's existing right-shift
semantics and failure behavior; mixing numeric kinds is no new conversion.
Statement termination follows the ordinary assignment rule.

The source syntax retains the assignment operator and its location. Name
resolution and admission record the implicit target read before the operand's
events and one write after them. The same const/import, declaration-order and
reassigned-capture restrictions apply before lowering. In particular, a held
closure that captures a binding assigned through `>>=` is refused just as one
assigned through `=` is; a compound spelling cannot bypass the source rules.

[`js/ast/sugar`](../../fjs/js/ast/sugar/module.f.mjs) owns expansion to an
ordinary write with a binary `>>` value, preserving the target's binding
identity and evaluation order. The normalized FAST, EDAG and VM use their
existing operations. Serializers may emit `name = name >> expression;`;
recovering the compound spelling is not required.

This increment admits neither property mutation (`object.key >>= value`)
nor assignment expressions (`f(n >>= 1)`, chained assignment, or a compound
assignment in an initializer). Those are already outside the ordinary
assignment statement contract. Other compound operators and updates remain
separate increments below; logical assignments require short-circuiting and
cannot use the eager binary rewrite unchanged.

**Benefits.** Preserve a familiar JavaScript spelling with no new run-time
operation, remove one migration obstacle in the monoid helper, and reuse the
existing shift, variable and capture semantics. This construct alone does not
promise that the complete monoid module or its dependencies compile.

**Drawbacks.** Add a source assignment variant and implicit read/write facts
to parse and prove. The implementation must preserve source admission evidence
before expansion; treating the token as a text replacement would lose it.
Implementing only `>>=` leaves the other compound spellings for later steps.

### Approval

Pending formal, explicit approval from **sergey-shandar**, distinct from the
proposer, as required by
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
Record the approving designer and a link to the approval here before compiler
implementation. The question proposing the feature is not itself recorded as
approval of this concrete design.

### Tasks

- [ ] Record explicit language-design approval of the first increment.
- [ ] Parse identifier-target `>>=` statements with the operator's diagnostic
  location, preserving ordinary statement termination.
- [ ] Resolve the implicit read and final write under existing binding and
  capture rules, and lower through source desugaring to assignment plus `>>`.
- [ ] Prove Number and BigInt agreement with the expanded spelling, including
  negative Number operands and shift-count behavior, operand evaluation once
  and in order, and assignments in module, function, guard and loop bodies.
- [ ] Prove refusals for const/import targets, undeclared or premature names,
  reassigned captures, property mutation and expression-position assignment.
- [ ] Update the implemented variable specification, examples and the
  refused-construct inventory after the feature lands; retain this issue for
  the operators still open.

### Further increments

These operators are candidates for source desugaring, not new VM instructions.
They are listed here for planning; this proposal requests approval only for
identifier-target `>>=` statements.

|Type       |Operator|Priority|
|-----------|--------|--------|
|Assignment |`+=`    |2       |
|           |`-=`    |2       |
|           |`*=`    |2       |
|           |`/=`    |2       |
|           |`%=`    |2       |
|           |`**=`   |2       |
|           |`<<=`   |2       |
|           |`>>=`   |2       |
|           |`>>>=`  |2       |
|           |`&=`    |2       |
|           |`^=`    |2       |
|           |`\|=`   |2       |
|           |`&&=`   |2       |
|           |`\|\|=` |2       |
|           |`??=`   |2       |
|Arithmetic |`++`    |3       |
|           |`--`    |3       |
