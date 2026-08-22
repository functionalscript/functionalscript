## Optional chaining and hidden control flow

**Priority:** P4
**Status:** open

### Problem

Property access and optional chaining have two independent kinds of hidden
control flow (HCF):

1. optional chaining can skip the rest of a syntactic chain;
2. a property reference can carry its receiver into a following call as
   `this`.

Parentheses affect them differently:

```js
undefined?.a.b          // undefined
(undefined?.a).b        // throws

[42].at(0)              // 42
([42].at)(0)            // 42
const at = [42].at
at(0)                    // throws
```

The previous proposal represented these with contextual `it` and `.this`
operations. That makes ordinary EDAG nodes context-sensitive and introduces
extra identity/sharing constraints. Instead, keep ordinary `Exp` nodes
context-independent and represent the inside of an optional chain with
non-`Exp` lambda operators.

### Proposal

#### Lambda continuations

An optional operator owns a continuation: an ordered array of lambda
operations. A lambda operation takes the previous chain value implicitly,
so it does not need a placeholder such as `['it']`.

```js
// a?.b.c
['?.', a, b, [
    ['|.', c],
]]
```

Conceptually:

```text
a?.b
   |.c
```

Lambda operations are structural continuation steps, not independently
shareable EDAG computations:

```text
Exp       = ordinary EDAG computation; may be shared and memoized by identity
LambdaOp  = continuation step; not Exp; cannot be extracted/shared as const
Continuation = readonly LambdaOp[]
```

This distinction is important for HCF. A lambda step has one structural input
from its owning chain, so receiver state never has to live in an independently
shareable node.

#### Optional-chain boundaries

Every operator whose operation starts with `?` or `|?` has a continuation
operand. An empty continuation means the optional HCF ends immediately after
that operation.

```js
// a?.b
['?.', a, b, []]

// f?.(...a)
['?.()', f, a, []]

// lambda ?.b
['|?.', b, []]

// lambda ?.(...a)
['|?.()', a, []]
```

Nested optional chains own nested continuations. This makes the HCF boundary
structural rather than inferred from neighboring operations.

```js
// a?.b.c?.d.e
['?.', a, b, [
    ['|.', c],
    ['|?.', d, [
        ['|.', e],
    ]],
]]
```

Here `.e` is skipped when the value before `?.d` is nullish.

If grouping terminates that optional chain, the inner optional operation gets
an empty continuation and subsequent computation is outside that HCF region.
For example, the general distinction is:

```js
['|?.', d, [
    ['|.', e],
]] // ?.d.e

['|?.', d, []] // (?.d), continuation ends here
```

#### Receiver HCF inside lambda chains

Property steps establish receiver state for structural lambda evaluation.
For a successful full-form optional property with a non-empty continuation,
that continuation starts with both the property value and its receiver:

```text
['?.', object, property, continuation]

value = object[property]
this  = object
```

The receiver exists only inside the structural continuation. The final result
of `?.` does not carry receiver HCF outside that continuation.

The property lambda operators likewise always establish receiver state:

```text
|.   property access + receiver
|?.  optional property access + receiver
```

The call lambda operators consume propagated receiver state when present:

```text
|()    call current value with propagated `this` if present
|?.()  optional call current value with propagated `this` if present
```

By contrast, the non-lambda call operators never consume propagated receiver
state:

```text
()     call with no propagated `this`
?.()   optional call with no propagated `this`
```

No lookahead or lookbehind is required. The call family itself determines
whether propagated receiver state may be consumed.

For example:

```js
// a?.b?.(...c)
['?.', a, b, [
    ['|?.()', c, []],
]]
```

On the successful branch, `?.` enters its continuation with `value = a.b` and
`this = a`, so `|?.()` calls `a.b` with `this = a`.

A longer chain works the same way:

```js
// a?.b.c(...d)
['?.', a, b, [
    ['|.', c],
    ['|()', d],
]]
```

Evaluation is conceptually:

```text
current = a.b, this = a
|.c     -> value = current.c, this = current
|() d   -> call value with the propagated this
```

Another property step replaces the receiver with its own input:

```text
a
|.b -> value = a.b,   this = a
|.c -> value = a.b.c, this = a.b
|() -> call a.b.c with this = a.b
```

The three call families therefore have distinct receiver behavior:

```text
() / ?.()           never receive propagated `this`
|() / |?.()         receive propagated `this` when present
this() / this?.()   use their explicit receiver semantics
```

Ordinary explicit property values still do not carry receiver state as
independently shareable `Exp` values:

```text
.    -> ordinary property value, no this
?.   -> optional property value, no this after its continuation ends
|.   -> lambda property value + this
|?.  -> lambda optional property value + this
```

Thus `?` controls optional HCF only; receiver propagation comes from property
steps entering structural lambda evaluation, and only lambda calls consume
that propagated receiver.

#### Calls with an explicit receiver

Grouping can end a lambda/optional region while JavaScript still preserves the
receiver of the final property reference. Represent such calls with explicit
receiver call operators:

```js
['this()', receiver, propertyLambda, args]
['this?.()', receiver, propertyLambda, args, continuation]
```

`propertyLambda` is intentionally restricted to the two property lambda
forms:

```js
['|.', property]
['|?.', property, continuation]
```

It is not an arbitrary `LambdaOp`. These operators mean: derive a property
callee from `receiver`, then call it using the same `receiver` as `this`.

Examples:

```js
// a.b()
['this()', a, ['|.', b], args]

// (a?.b)()
['this()', a, ['|?.', b, []], args]

// a.b?.()
['this?.()', a, ['|.', b], args, []]

// (a?.b)?.()
['this?.()', a, ['|?.', b, []], args, []]
```

For a longer property chain:

```js
// (a.b.c)(...d)
['this()',
    ['.', a, b],
    ['|.', c],
    d,
]
```

The explicit receiver is `a.b`; the lambda property computes `.c`; the call
uses `a.b` as `this`.

By contrast, a call result is an ordinary value. The receiver HCF has already
been consumed:

```js
// (a?.c.d.e(...f))(...g)
['()',
    ['?.', a, c, [
        ['|.', d],
        ['|.', e],
        ['|()', f],
    ]],
    g,
]
```

The outer call is `()`, not `this()`, because `|()` consumed the receiver of
`.e`. As a non-lambda call, `()` never receives propagated receiver state.

#### Larger examples

```js
// a?.b?.(...c).d(...f)
['?.', a, b, [
    ['|?.()', c, [
        ['|.', d],
        ['|()', f],
    ]],
]]
```

On the successful property branch, the first `?.` enters its continuation
with `value = a.b` and `this = a`. The optional lambda call consumes that
receiver. It also owns `.d(...f)`, so when `a.b` is nullish, `c`, `.d`, and
`f` are skipped.

Grouping moves the optional call outside the optional-property HCF while still
preserving `this = a`:

```js
// (a?.b)?.(...c).d(...f)
['this?.()', a, ['|?.', b, []], c, [
    ['|.', d],
    ['|()', f],
]]
```

This structural difference directly represents the parentheses.

### Operator tensor

The vocabulary can be viewed as a sparse tensor of four dimensions:

```text
input       : explicit | lambda (`|`)
optional    : normal   | `?`
operation   : property (`.`) | call (`()`)
receiver    : normal   | explicit `this` call
```

Not every Cartesian-product cell is meaningful. The populated operators are:

| Operator | Shape | `this` | Optional HCF | Meaning |
|---|---|---|---|---|
| `.` | `['.', object, property]` | no | no | property access |
| `?.` | `['?.', object, property, continuation]` | seeds continuation receiver | yes | optional property access |
| `()` | `['()', callee, args]` | never | no | call |
| `?.()` | `['?.()', callee, args, continuation]` | never | yes | optional call |
| `this()` | `['this()', receiver, propertyLambda, args]` | explicit | no | property-derived call with explicit receiver |
| `this?.()` | `['this?.()', receiver, propertyLambda, args, continuation]` | explicit | yes | optional property-derived call with explicit receiver |
| `|.` | `['|.', property]` | propagated | no | lambda property access |
| `|?.` | `['|?.', property, continuation]` | propagated | yes | lambda optional property access |
| `|()` | `['|()', args]` | consumes propagated receiver if present | no | lambda call |
| `|?.()` | `['|?.()', args, continuation]` | consumes propagated receiver if present | yes | lambda optional call |

The continuation rule is uniform:

```text
?.        ?.()        this?.()
|?.       |?.()
```

have continuations, while:

```text
.         ()          this()
|.        |()
```

do not.

### Why this is preferable to `it` / `.this`

- ordinary `Exp` nodes remain context-independent and safely shareable;
- lambda operators cannot escape as const computations, so their implicit
  input and receiver are structurally unambiguous;
- `this` propagation and consumption are determined by the operator family;
- non-lambda `()` / `?.()` never receive propagated `this`;
- optional-chain boundaries are explicit nested continuation arrays;
- no placeholder binding or identity-aware `it` ownership is needed;
- no compiler lookahead is needed to decide whether a property node should
  carry `this`.

### Tasks

- [ ] Replace the previous `it` / `.this` proposal with the lambda-operation
      type model: `LambdaOp`, `Continuation`, and restricted `PropertyLambda`.
- [ ] Define exact RTTI shapes for all ten operators and enforce fixed arity.
- [ ] Make `LambdaOp` a structural type that is not an `Exp` and cannot be
      independently shared/memoized as a computation node.
- [ ] Define execution semantics for receiver propagation into continuations,
      through `|.` / `|?.`, and consumption by `|()` / `|?.()`; ordinary
      `()` / `?.()` must never consume propagated receiver state.
- [ ] Define `this()` / `this?.()` with `PropertyLambda` restricted to `|.` /
      `|?.`.
- [ ] Update existing EDAG/compiler/interpreter design documents to the new
      vocabulary after the shapes are settled.
- [ ] Cover grouping and HCF boundaries in lowering/execution tests, including
      `a?.b.c`, `a?.b.c?.d.e`, `a?.b.c(d)`, `(a.b.c)(d)`, `(a?.b)(d)`,
      `a.b?.(d)`, `(a?.b)?.(d)`, `a?.b?.(c).d(f)`,
      `(a?.b)?.(c).d(f)`, and `(a?.c.d.e(f))(g)`.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  compiler lowering must follow the settled operation vocabulary here.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary and HCF design context.
