## Additional Assignment Operators

**Priority:** P4
**Status:** wip — compound assignments implemented
([variables](../bindings/variables/README.md#compound-assignments)); prefix and
postfix updates remain open

### Problem

The compiler admits variable assignment and binary operations, but refuses
their compound spellings. `repeat` in
[`fjs/common/monoid`](../../fjs/common/monoid/module.f.mjs) uses `ni >>= 1n`:
the equivalent `ni = ni >> 1n` expresses the same immutable state transition.
The refusal adds a source rewrite without protecting purity or binding safety.

### Proposal

#### Compound assignments to a variable

Admit `name op= expression;` for every compound assignment operator below,
wherever an ordinary assignment statement is admitted, including module and
function bodies and the blocks of guards and
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

For an eager compound assignment, read the current target value before
evaluating the right operand, evaluate that operand once, apply the existing
binary operator, then establish the new value of the binding. Statement
termination follows the ordinary assignment rule.

| Compound operator | Existing binary operator |
| --- | --- |
| `+=` | `+` |
| `-=` | `-` |
| `*=` | `*` |
| `/=` | `/` |
| `%=` | `%` |
| `**=` | `**` |
| `<<=` | `<<` |
| `>>=` | `>>` |
| `>>>=` | `>>>` |
| `&=` | `&` |
| `^=` | `^` |
| `\|=` | `\|` |

Each operator retains the existing JavaScript-compatible value and failure
semantics, including string concatenation with `+=`, Number shift-count
conversion and BigInt arithmetic. Mixed numeric kinds and BigInt unsigned
right shift gain no new coercion or successful result.

#### Logical assignments

The remaining compound operators lower to conditional writes. Read the target
once to determine whether the right operand and write are reached:

| Operator | Evaluate the right operand and write when |
| --- | --- |
| `&&=` | The current target value is truthy |
| `\|\|=` | The current target value is falsy |
| `??=` | The current target value is `null` or `undefined` |

On that path, evaluate the right operand once and assign its value directly,
without converting it to a boolean. On the other path, perform no right-operand
evaluation and no write; preserve the target's current value and identity.
For example, `x &&= rhs` denotes `if (x) { x = rhs; }`, not an eager
evaluation of `rhs`. The nullish predicate uses strict tests against `null`
and the primitive `undefined`, as existing logical desugaring does.

These are normalized conditional regions with merged binding versions, not
new functions or calls. Source admission still checks the right operand even
when a constant target value makes that operand unreachable at run time.

#### Source analysis and lowering

The source syntax retains the assignment operator and its location. Name
resolution and admission record the implicit target read before the operand's
events and a possible write after them. Logical assignment records that write
in its conditional region. The same const/import, declaration-order and
reassigned-capture restrictions apply before lowering. In particular, a held
closure that captures a binding assigned through any compound operator is
refused just as one assigned through `=` is, even for a logical assignment
whose write is unreachable. All targets must be mutable, including logical
assignments with an untaken write; this retains the existing static refusal
of assignment to const/import bindings in unreachable code. A compound
spelling cannot bypass the source rules.

[`js/ast/sugar`](../../fjs/js/ast/sugar/module.f.mjs) owns expansion to
ordinary writes with binary values or conditional regions, preserving the
target's binding identity and evaluation order. Reuse the existing logical
normalization rather than introduce a second truthiness/nullishness policy.
The normalized FAST, EDAG and VM use their existing operations. Serializers
may emit the expanded spelling; recovering a compound spelling is not required.

This proposal admits neither property mutation (`object.key >>= value`)
nor assignment expressions (`f(n >>= 1)`, chained assignment, or a compound
assignment in an initializer). Those are already outside the ordinary
assignment statement contract. Prefix and postfix `++` and `--` are update
operators, with separate numeric conversion and result rules; they remain
separate work and are not compound assignments.

**Benefits.** Preserve a familiar JavaScript spelling with no new run-time
operation, remove migration obstacles such as the monoid helper's shift, and
reuse the existing binary, logical, variable and capture semantics. Supporting
the complete compound-assignment family avoids an arbitrary subset of familiar
spellings. These constructs alone do not promise that the complete monoid
module or its dependencies compile.

**Drawbacks.** Add a source assignment variant and implicit read/write facts
to parse and prove. The implementation must preserve source admission evidence
before expansion; treating the token as a text replacement would lose it.
Logical assignments also require conditional writes and proof of both paths;
they cannot share an eager rewrite that always evaluates the right operand.

### Approval

Approved by **sergey-shandar**, distinct from the proposer, in the
[working session](https://chatgpt.com/local/01a18594-4211-744b-b07a-aaed2279400e):
after the proposal was broadened to all compound assignments, the designer
said, "ok, implement it on top of the proposal PR". This is the explicit
implementation approval required by
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
The approved scope covers all compound assignment operators in this proposal,
including logical assignments, with mutable identifier targets and
statement-only positions.

### Tasks

- [x] Record explicit language-design approval of all compound assignments.
- [x] Parse all identifier-target compound assignments with each operator's
  diagnostic location, preserving ordinary statement termination.
- [x] Resolve the implicit read and final write under existing binding and
  capture rules, and lower eager operators to assignment plus the existing
  binary operation and logical operators to conditional writes.
- [x] Prove every eager operator against the expanded spelling, covering
  string `+=`, Number and supported BigInt operations, negative Number
  operands, shift-count behavior and existing failure cases such as mixed
  numeric kinds and BigInt `>>>=`.
- [x] Prove both paths of each logical assignment: skipped throwing operands,
  selected operands evaluated once, preserved value identity and truthiness
  versus nullishness for `false`, zero, empty strings, `NaN`, `null` and
  `undefined`. Check source admission in an unreachable right operand and
  confirm that the skipped normalized branch performs no write.
- [x] Prove operand evaluation once and in order, and assignments in module,
  function, guard and loop bodies, with termination and precedence examples.
- [x] Prove refusals for const/import targets, undeclared or premature names,
  reassigned captures, property mutation and expression-position assignment.
- [x] Update the implemented variable specification, examples and the
  refused-construct inventory after the feature lands; retain this issue while
  update operators remain open.

### Further increments

Prefix and postfix `++` and `--` remain at priority 3 in this issue's original
operator breakdown; compound assignment was priority 2. Their proposal and
approval are separate from the compound-assignment scope above.
