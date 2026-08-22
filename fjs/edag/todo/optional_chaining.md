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
context-independent and represent chain-local computation with structural
lambda operations.

### Proposal

#### Lambda arrays

A lambda operation takes the previous chain value implicitly, so it does not
need a placeholder such as `['it']`. Lambda operations are structural steps,
not independently shareable EDAG computations.

```text
Exp      = ordinary EDAG computation; may be shared and memoized by identity
LambdaOp = structural step; not Exp; cannot be extracted/shared as const
Lambda   = readonly LambdaOp[]
```

A core invariant is that evaluating an `Exp` produces only its ordinary value:

```text
Exp -> Value
```

No `Exp` produces `this`, optional-chain state, or any other HCF result. HCF is
created, transformed, consumed, and discarded only by an operator while it
interprets a structural `Lambda`.

All four lambda operations are simple fixed-arity steps and **none of them has
a continuation operand**:

```js
['|.', property]
['|()', args]
['|?.', property]
['|?.()', args]
```

An optional expression operator owns a `Lambda` array representing the rest of
its optional HCF region:

```js
// a?.b.c
['?.', a, b, [
    ['|.', c],
]]
```

An optional lambda (`|?.` or `|?.()`) short-circuits the remaining suffix of
its containing lambda array when its input is nullish. The lambda itself does
not own another continuation.

#### Optional-chain boundaries

The optional expression operators `?.` and `?.()` own lambda arrays. An empty
array means the optional HCF ends immediately after that expression operation.

```js
// a?.b
['?.', a, b, []]

// f?.(...a)
['?.()', f, [], a, []]
```

Optional lambda operations use the array that already contains them:

```js
// a?.b?.c.d
['?.', a, b, [
    ['|?.', c],
    ['|.', d],
]]
```

If the input to `|?.c` is nullish, the remaining suffix (`|.d`) is skipped.
Grouping ends the current HCF region and therefore produces a new
expression-level optional operator:

```js
// (a?.b)?.c
['?.',
    ['?.', a, b, []],
    c,
    [],
]
```

A longer chain stays flat even when it contains more than one optional step:

```js
// a?.b.c?.d.e
['?.', a, b, [
    ['|.', c],
    ['|?.', d],
    ['|.', e],
]]
```

If `a` is nullish, the outer `?.` skips the whole array. If the input to
`|?.d` is nullish, that lambda skips only the remaining suffix `|.e`.

#### Receiver HCF inside lambda evaluation

Property steps establish receiver state for structural lambda evaluation. For
a successful full-form optional property with a non-empty lambda array, that
array starts with both the property value and its receiver:

```text
['?.', object, property, lambda]

value = object[property]
this  = object
```

The receiver exists only while evaluating the structural lambda. The final
ordinary value produced by `?.` does not carry receiver HCF outside it.

The property lambda operators establish receiver state:

```text
|.   property access + receiver
|?.  optional property access + receiver
```

The call lambda operators consume receiver state when present:

```text
|()    call current value with current `this` if present
|?.()  optional call current value with current `this` if present
```

After a call lambda, its result becomes the current ordinary value and the
receiver is cleared. A later property lambda can establish a new receiver.

For example:

```js
// a?.b?.(...c)
['?.', a, b, [
    ['|?.()', c],
]]
```

On the successful branch, `?.` enters its lambda with `value = a.b` and
`this = a`, so `|?.()` calls `a.b` with `this = a`.

A longer chain works the same way:

```js
// a?.b.c(...d)
['?.', a, b, [
    ['|.', c],
    ['|()', d],
]]
```

Conceptually:

```text
current = a.b, this = a
|.c     -> value = current.c, this = current
|() d   -> call value with this, then clear this
```

Another property step replaces the receiver with its own input:

```text
a
|.b -> value = a.b,   this = a
|.c -> value = a.b.c, this = a.b
|() -> call a.b.c with this = a.b
```

Here `+ this` describes temporary evaluator state while interpreting `Lambda`;
it is not part of the value returned by an EDAG expression.

#### Unified call operators

There are only two expression-level call operators:

```js
['()', input, lambda, args]
['?.()', input, lambda, args, continuation]
```

Both always receive an explicit `Lambda`. The call operator first evaluates
`input`, interprets `lambda`, and then calls the resulting current value.

If lambda evaluation ends with receiver state, the outer call uses that
receiver as `this`. If it ends without receiver state, the outer call is an
ordinary function call with no propagated receiver.

An empty lambda therefore represents an ordinary call:

```js
// f(...a)
['()', f, [], a]

// f?.(...a)
['?.()', f, [], a, []]
```

A property lambda produces the receiver for a method-style call:

```js
// a.b(...c)
['()', a, [
    ['|.', b],
], c]
```

Conceptually:

```text
input = a
|.b   -> value = a.b, this = a
()    -> call a.b with this = a
```

The lambda can be an arbitrary chain; there is no separate `this()` operator.
For example:

```js
// (a?.b.c)(...d)
['()',
    a,
    [
        ['|?.', b],
        ['|.', c],
    ],
    d,
]
```

The final receiver is `a.b`, so the outer `()` calls `a.b.c` with
`this = a.b`.

A more general example can contain calls before the final receiver-producing
property:

```js
// (a?.(...b)?.c)(...d)
['()',
    a,
    [
        ['|?.()', b],
        ['|?.', c],
    ],
    d,
]
```

Here `|?.()` first performs an optional call. If it succeeds, `|?.c` can
establish the receiver used by the outer `()`.

A lambda that ends without a receiver is also well-defined:

```js
['()', f, [
    ['|()', a],
], b]
```

The inner `|()` consumes any receiver and leaves only its ordinary result, so
the outer `()` performs an ordinary call of that result.

A later property step can establish a receiver again:

```js
['()', f, [
    ['|()', a],
    ['|.', b],
], c]
```

Thus the call operators do not encode "with this" versus "without this" in
their tag. That distinction is entirely determined by the structural lambda
state at the point of the call.

#### Larger examples

```js
// a?.b?.(...c).d(...f)
['?.', a, b, [
    ['|?.()', c],
    ['|.', d],
    ['|()', f],
]]
```

If `a` is nullish, the outer `?.` skips the whole lambda. If `a.b` is nullish,
`|?.()` skips the remaining `.d(...f)` suffix.

Grouping moves the optional call outside the optional-property HCF while still
preserving receiver state through the call's own lambda:

```js
// (a?.b)?.(...c).d(...f)
['?.()', a, [
    ['|?.', b],
], c, [
    ['|.', d],
    ['|()', f],
]]
```

This structural difference directly represents the parentheses.

By contrast, a call result is an ordinary value because the call consumes the
receiver:

```js
// (a?.c.d.e(...f))(...g)
['()',
    ['?.', a, c, [
        ['|.', d],
        ['|.', e],
        ['|()', f],
    ]],
    [],
    g,
]
```

The outer call has an empty lambda because the inner call already consumed the
receiver of `.e`.

### Operator forms

The ordinary and lambda-operation forms are:

|JS         |exp                                      |lambda operation     |
|-----------|-----------------------------------------|---------------------|
|`a.b`      |`['.', a:exp, b:exp]`                    |`['\|.', b:exp]`     |
|`a(...b)`  |`['()', a:exp, lambda, b:exp]`           |`['\|()', b:exp]`    |
|`a?.b`     |`['?.', a:exp, b:exp, lambda]`           |`['\|?.', b:exp]`    |
|`a?.(...b)`|`['?.()', a:exp, lambda, b:exp, lambda]` |`['\|?.()', b:exp]` |

`lambda` is `readonly LambdaOp[]`. Lambda operations themselves never carry
continuations.

For expression calls, the first lambda is evaluated before the call and may
produce receiver state for that call. For `?.()`, the final lambda is the
optional-call continuation executed after the call succeeds.

#### Why there is no `.()` operator

The existing EDAG has a direct `.()` form for ordinary method calls, but the
unified call shape makes it unnecessary:

```js
// a.b(...c)
['()', a, [
    ['|.', b],
], c]
```

This is not merely a verbose spelling of `.()`: the same `()` operator handles
arbitrary receiver-producing chains that no direct property-plus-call operator
could represent:

```js
// (a?.(...b)?.c)(...d)
['()', a, [
    ['|?.()', b],
    ['|?.', c],
], d]
```

It also avoids a naming collision in an optional `.()` family. The natural
optional counterpart of `a.b(...c)` would be `a?.b(...c)`, while `?.()` already
means the distinct operation `a?.(...b)`. Decomposition keeps `?.` as optional
property access and `?.()` as optional call.

### Why this is preferable to `it` / `.this`

- every `Exp` evaluates to an ordinary value only; HCF is never part of an
  expression result;
- ordinary `Exp` nodes remain context-independent and safely shareable;
- operators interpreting `Lambda` create and control HCF locally instead of
  receiving it from child expressions;
- lambda operations cannot escape as const computations, so their implicit
  input and receiver are structurally unambiguous;
- all four lambda operations are small, fixed-arity steps with no continuation;
- one flat lambda array represents the rest of an HCF region;
- optional lambdas short-circuit the remaining suffix of that same array;
- `()` / `?.()` use the same lambda representation for both ordinary calls and
  receiver-preserving calls;
- an empty lambda naturally means "no receiver";
- receiver state can be created, consumed, cleared, and recreated entirely
  inside structural lambda evaluation;
- optional-chain boundaries are explicit lambda arrays;
- no placeholder binding or identity-aware `it` ownership is needed;
- no dedicated `this()` / `this?.()` operation is needed.

### Tasks

- [ ] Replace the previous `it` / `.this` proposal with `LambdaOp` and
      `Lambda = readonly LambdaOp[]`.
- [ ] Define exact RTTI shapes for the eight operator forms (`.`, `?.`, `()`,
      `?.()`, and their four lambda-operation forms) and enforce fixed arity.
      Lambda operations must not have continuation operands.
- [ ] Preserve the invariant that every `Exp` evaluates to an ordinary value
      only; `this`, optional short-circuit state, and other HCF must remain
      local evaluator state of operators interpreting `Lambda`.
- [ ] Make `LambdaOp` a structural type that is not an `Exp` and cannot be
      independently shared/memoized as a computation node.
- [ ] Define execution semantics for optional lambdas: `|?.` / `|?.()` must
      short-circuit the remaining suffix of their containing lambda array on a
      nullish input.
- [ ] Define execution semantics for receiver propagation through `|.` / `|?.`,
      consumption by `|()` / `|?.()`, and final consumption by expression-level
      `()` / `?.()` when their input lambda ends with receiver state.
- [ ] Define ordinary calls as the same `()` / `?.()` forms with an empty input
      lambda; do not add separate `this()` / `this?.()` operators.
- [ ] Update existing EDAG/compiler/interpreter design documents to the new
      vocabulary after the shapes are settled.
  - [ ] Remove `fjs/edag/todo/operations.md` after the new vocabulary has been
        applied; the exploratory operations note will then be superseded.
- [ ] Cover grouping and HCF boundaries in lowering/execution tests, including
      `a?.b.c`, `a?.b.c?.d.e`, `a?.b.c(d)`, `(a.b.c)(d)`, `(a?.b)(d)`,
      `(a?.b.c)(d)`, `(a?.(b).c)(d)`, `a.b?.(d)`, `(a?.b)?.(d)`,
      `a?.b?.(c).d(f)`, `(a?.b)?.(c).d(f)`, `(a?.(...b)?.c)(d)`, and
      `(a?.c.d.e(f))(g)`.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  compiler lowering must follow the settled operation vocabulary here.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary and HCF design context.
