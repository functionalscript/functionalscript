# Function Parameters

Support ordinary named arrow parameters while preserving JavaScript behavior:

```js
export const one = a => [a, a];
export const pair = (a, b) => [a, b];
```

The language already supports empty and rest-only parameter lists
([functions](../README.md#functions)). Sergey approved implementing `a => …`,
`(a) => …`, and `(a, b) => …` on 2026-09-19, following #2131.

**Benefit:** familiar JavaScript syntax and compiling existing modules unchanged.
**Cost:** parameter/group disambiguation, binding logic, and preservation of the
observable parameter count across compiler outputs and executors.

## Compatibility blocker found by the prototype

The existing function EDAG, `['=>', frame, body]`, does not record declared
parameter count. Both its JavaScript executor and FSC's source writer create
rest-parameter functions, whose `length` is zero. Lowering named parameters
only to indexed `['args']` reads therefore silently changes successful results:

```js
const f = (a, b) => a;
export default f.length; // JavaScript: 2
```

A local parser/lowering prototype compiled this to:

```js
const $0 = (...$a) => $a[0];
export default $0.length; // 0
```

The memo executor over the same compiled EDAG also returned `0`. This is an
observed mismatch, not a hypothetical reflection extension: constant-key
`length` access is already admitted. It also affects consumers inspecting an
exported function. The [function-text exception](./serialization.md#function-text-and-serialization)
explicitly does not permit changing arity.

The prototype's single/multiple parameter binding agreed with native Node for
missing and extra arguments, and its grammar builds as LL(1). Type checking
still reports unfinished prototype types. This is prototype evidence only;
the implementation is not published or ready to land.

## Proposed decision: preserve declared parameter count

Pending language-designer approval, extend function EDAG to carry an explicit
nonnegative integer parameter count:

```js
['=>', parameterCount, frame, body]
```

`parameterCount` is metadata, not an expression operand. Empty and rest-only
lists record `0`; a list of `n` plain named parameters records `n`, including
unused parameters. Parameter names remain erased. The count participates in
canonical function identity because `length` can distinguish the values.

AST lowering, schema validation, analysis, executors and source serialization
must agree on this representation. This changes the stable EDAG format and
requires a coordinated breaking change with updated consumers and examples.
Existing three-element function nodes must not be silently misinterpreted.
Executors must produce callable values with the recorded `length`; source
serialization must reproduce it too. `['args']` continues to mean the complete
actual argument list, including the distinction between omitted arguments and
explicit `undefined`, irrespective of the declared count.

This expands the originally proposed parser/binding change into the function
representation and runtime APIs. Approve that scope before implementing it,
per [SESSION.md](../../doc/SESSION.md#what-is-a-decision). Prohibiting function
`length` instead would be a separate source restriction requiring its own
justification and approval; normalizing it silently is incompatible.

## Implementation tasks after that decision

- [ ] Add named parameter parsing with JavaScript's grouping distinction and
  no line terminator before `=>`. Allow an ordinary trailing parameter comma.
  Reject expressions, nested groups and property accesses as binding names.
- [ ] Bind parameters by position; missing arguments are `undefined`, extra
  arguments are permitted, and duplicate/reserved names are rejected. Retain
  block/return syntax and existing scope rules. Captures remain the separate
  [function-frame](./3111-function-frame.md) task.
- [ ] Carry declared arity through the approved function representation,
  validation, execution and serialization. Update the function specification
  and all affected consumers, and declare the format/API break.
- [ ] Prove argument behavior, sharing, scope boundaries and source/EDAG round
  trips. Compare `f.length`, including unused parameters and functions passed
  through other functions, with native JavaScript. Preserve empty/rest-only
  behavior and reject unsupported default, destructuring and mixed-rest forms.
- [ ] Run generation and the required checks, then retry the original range
  module and record its next diagnostic before expanding scope.

## Repository migration candidate

The unchanged dependency-free `fjs/types/range/module.f.mjs` is the first
candidate. After #2131, FSC stops at `10:27`, the comma in `(b, e)`:

```js
export const contains = (b, e) => i => b <= i && i <= e
```

The local named-parameter prototype advances to `10:42`, the `<` token. Operator
support is tracked separately in [operators](./2340-operators.md); captures and
statement terminators may still block the file after that. The source remains
unchanged and unrenamed. This diagnostic does not authorize those later steps.
