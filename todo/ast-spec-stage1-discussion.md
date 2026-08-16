# AST stage 1: discussion

**Status:** open — working document for designing the stage 1 function AST.
Each subject below is resolved separately; once all are **decided**, the
result is distilled into a concrete design in [ast-spec.md](./ast-spec.md)
and this document is deleted.

## Baseline proposal

A function body is an array of sequential operations (no branches yet). An
interpreter iterates through the array, executes each operation, and stores
the result at the same index in a result array. An operation can reference
the result of any previous operation by index. The last result is the
function's return value.

Operation format:

- **non-object, non-array value** — a constant, copied to the result array:
  `"hello world"`, `2.5`, `false`, `undefined`, `null`, `34n`.
- **object** — an object constructor; each property value is an operation
  that builds the property's value.
- **array** — a tagged tuple `[command, ...parameters]`:
  - `["array", ...operations]` — array constructor,
  - `["local", number]` — reference to a previously computed result;
    the number must be smaller than the current index; `-1` means the
    array of arguments passed to the function,
  - `["at", operation0, operation1]` — `operation0[operation1]`,
  - `["call", operation0, operation1]` — `operation0(...operation1)`,
  - `["bindCall", operation0, operation1, operation2]` —
    `operation0[operation1](...operation2)`.

Agreed strengths (not under discussion):

- Host-value reuse follows [DESIGN.md §8](../DESIGN.md): constants describe
  themselves; tags only where the host value is ambiguous. `["array", ...]`
  is a complete escape hatch — any constant array is expressible.
- The flat sequence + `local` mirrors DJS module structure
  (`const` + `const_ref`): a function body is a module in miniature, and
  sharing (a DAG, not a tree) works the same way at both levels.
- "Reference only smaller indices" gives one-pass validation:
  acyclicity and evaluate-before-use, no forward patching.
- `bindCall` is semantically required, not an optimization:
  [property-accessor](../spec/todo/2330-property-accessor.md) shows
  `a.indexOf(x)` and `const p = a.indexOf; p(x)` differ observably.
- `call`'s arguments are a single operation yielding an array (usually
  `["array", ...]`): handles spread `f(...xs)` for free, unlike a variadic
  form. Same for `bindCall`'s third operand.

## Subjects

### 1. Nested operations vs. the result array (canonical form)

**Status:** open

Operand positions accept full operations, so operands can nest arbitrarily;
but only top-level operations get result-array slots. Consequence: the same
function has many spellings (nested vs. flattened), and CAVM hashing wants
"one AST, one byte sequence, one hash" ([ast-spec](./ast-spec.md)).

Options:

1. Canonical form = fully flattened: operands are constants or `["local", i]`
   only; nesting is a validation error.
2. Canonical form = maximally nested: `local` appears only at genuine sharing
   points (a result referenced more than once); single-use intermediates must
   be nested.
3. Both spellings valid; hash identity is spelling-sensitive; canonicalization
   is a later, separate concern.

To decide now even if stage 1 does not enforce it.

### 2. Arguments reference: `["local", -1]` vs. a separate command

**Status:** open

`-1` as "the arguments array" is a sentinel inside the `local` index space.
Closures are coming ([function-frame](../spec/todo/3111-function-frame.md)
already designs a separate captured-consts frame), inviting `-2` for
captures — sentinel creep, the special-casing [DESIGN.md §1](../DESIGN.md)
warns about.

Options:

1. Keep `["local", -1]`.
2. Zero-parameter `["args"]` command; `local` stays non-negative, validation
   is "integer in `[0, currentIndex)`", nothing else. Closures later become
   `["capture", i]` — a new tag, not a new magic number.
3. `["arg", i]` — direct access to a single argument (the whole arguments
   array is then not reified in stage 1).

### 3. Lazy operators and the branch extension path

**Status:** open

`?:`, `&&`, `||`, `??` ([operators](../spec/todo/2340-operators.md)) are
lazy. Operations can throw (e.g. `at` on `null`) and will eventually recurse,
so eager evaluation of both sides is observably wrong — the extension
pressure arrives with the first lazy operator, not with `if`.

The natural extension is an operand position holding a *sub-sequence* (an
operation array) instead of an operation, e.g.
`["cond", op, thenOps, elseOps]`. Stage 1 must not close this path — e.g. by
specifying "an array in operand position is always a tagged operation".

To decide: the wording stage 1 uses to keep this open, and whether the
sub-sequence's locals share the outer index space or open a nested scope.

### 4. Object constructor: key order and duplicate keys

**Status:** open

Property values are operations; operations can throw; so evaluation order is
observable. JS semantics evaluate in insertion order, but `fjs compile`
emits sorted key order ([spec/README.md](../spec/README.md)) for
canonicalization — reordering constructor keys reorders evaluation.

Options:

1. AST constructor keys must already be sorted (canonical); the compiler is
   responsible for hoisting effects-ordering into the operation sequence.
2. Key order is semantic; hashing takes it as-is.

Also to decide: duplicate keys — validation error (proposed).

### 5. Constant and index validation

**Status:** open

"Non-object, non-array value" needs a negative list, since the AST is an
`Any`:

- function values in constant position: validation error in stage 1 (later
  representable as a `["function", ...]` node per
  [function](../spec/todo/3110-function.md));
- `local`'s number: must be an integer (the data model has only f64);
  non-integer or out-of-range is a validation error, not runtime coercion;
- empty body `[]`: proposed as a validation error — "the last result" must
  always exist;
- unknown command tag: validation error.

### 6. Command vocabulary vs. the existing spec names

**Status:** open

[property-accessor](../spec/todo/2330-property-accessor.md) already names
commands: `at`, `at_call`, `instance_property`, `instance_method_call`,
`own_property`. This proposal's `at` = its `at`; `bindCall` = its `at_call`.

Options:

1. Adopt the existing names in the AST.
2. AST keeps only the general layer (`at`, `bindCall`); 2330's
   `instance_property` / `instance_method_call` are noted as compile-time
   specializations of the VM's internal bytecode, not AST-level distinctions.

Leaning toward 2 (minimal AST; bytecode is where performance distinctions
live per [serialization](../spec/todo/serialization.md)). Consequence: the
AST interpreter carries the safety burden 2330 assigns to compile-time
checks — `["at", obj, "constructor"]`, `__proto__`, and other prohibited
names must be rejected at *runtime*, because the AST is the `Function`
constructor's public input and will see shapes the FJS compiler would never
emit.

### 7. Top-level shape of a function

**Status:** open

A function body is a *bare* array of operations: array means "sequence" at
body position and "tagged tuple" at operation position. Intentional, but must
be stated explicitly; it also matches the eventual `["function", body]` node.

To decide: whether stage 1's `Function` constructor input is the bare body
array or a wrapper carrying metadata (e.g. parameter count / `length`).
