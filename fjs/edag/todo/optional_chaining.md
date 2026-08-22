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

Conceptually:

```text
a?.b
   |.c
```

An optional lambda (`|?.` or `|?.()`) short-circuits the remaining suffix of
its containing lambda array when its input is nullish. The lambda itself does
not need to own another continuation.

#### Optional-chain boundaries

The optional expression operators `?.`, `?.()`, and `this?.()` own lambda
arrays. An empty array means the optional HCF ends immediately after that
expression operation.

```js
// a?.b
['?.', a, b, []]

// f?.(...a)
['?.()', f, a, []]
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
This is unambiguous: an optional lambda means "jump to the end of the current
lambda array" on the nullish branch.

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

#### Receiver HCF inside lambda chains

Property steps establish receiver state for structural lambda evaluation.
For a successful full-form optional property with a non-empty lambda array,
that array starts with both the property value and its receiver:

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

The call lambda operators consume propagated receiver state when present:

```text
|()    call current value with propagated `this` if present
|?.()  optional call current value with propagated `this` if present
```

By contrast, non-lambda calls never consume propagated receiver state:

```text
()     call with no propagated `this`
?.()   optional call with no propagated `this`
```

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
this() / this?.()   call with the final receiver produced by their lambda
```

Ordinary explicit property values still do not carry receiver state as
independently shareable `Exp` values:

```text
.    -> ordinary property value, no this
?.   -> optional property value, no this after its lambda ends
|.   -> lambda property value + this
|?.  -> lambda optional property value + this
```

Thus `?` controls optional HCF only; receiver propagation comes from property
steps entering structural lambda evaluation, and only lambda calls consume
that propagated receiver.

#### Calls using the receiver produced by a lambda

Grouping can end an optional region while JavaScript still preserves the
receiver of the final property reference. Represent such calls with `this()` /
`this?.()`:

```js
['this()', input, lambda, args]
['this?.()', input, lambda, args, continuation]
```

Here `lambda` is the same `readonly LambdaOp[]` type used by optional
expression continuations. The first operand is only the initial input. The
whole lambda array is evaluated first, and the outer call uses the final
receiver produced by that lambda rather than the original input.

Examples:

```js
// a.b()
['this()', a, [
    ['|.', b],
], args]

// (a?.b)()
['this()', a, [
    ['|?.', b],
], args]

// a.b?.()
['this?.()', a, [
    ['|.', b],
], args, []]

// (a?.b)?.()
['this?.()', a, [
    ['|?.', b],
], args, []]
```

For a longer property chain, the final receiver comes from the final property
lambda in the same flat array:

```js
// (a?.b.c)(...d)
['this()',
    a,
    [
        ['|?.', b],
        ['|.', c],
    ],
    d,
]
```

Conceptually:

```text
input = a
|?.b  -> value = a.b,   this = a
|.c   -> value = a.b.c, this = a.b
this() -> call a.b.c with this = a.b
```

The lambda may start with a call as well:

```js
// (a?.(...b).c)(...d)
['this()',
    a,
    [
        ['|?.()', b],
        ['|.', c],
    ],
    d,
]
```

Here `|?.()` evaluates `a?.(...b)`; if it succeeds, `|.c` establishes the
final receiver used by the outer `this()`.

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
    ['|?.()', c],
    ['|.', d],
    ['|()', f],
]]
```

On the successful property branch, the first `?.` enters its lambda with
`value = a.b` and `this = a`. If `a.b` is nullish, `|?.()` skips the remaining
`.d(...f)` suffix.

Grouping moves the optional call outside the optional-property HCF while still
preserving the receiver produced by the grouped lambda:

```js
// (a?.b)?.(...c).d(...f)
['this?.()', a, [
    ['|?.', b],
], c, [
    ['|.', d],
    ['|()', f],
]]
```

This structural difference directly represents the parentheses.

### Operator forms

The ordinary and lambda-operation forms are:

|JS         |exp                           |lambda operation          |
|-----------|------------------------------|--------------------------|
|`a.b`      |`['.', a:exp, b:exp]`         |`['\|.', b:exp]`          |
|`a(...b)`  |`['()', a:exp, b:exp]`        |`['\|()', b:exp]`         |
|`a?.b`     |`['?.', a:exp, b:exp, lambda]`|`['\|?.', b:exp]`         |
|`a?.(...b)`|`['?.()', a:exp, b:exp, lambda]`|`['\|?.()', b:exp]`     |

`lambda` is `readonly LambdaOp[]`. Lambda operations themselves never carry
continuations.

The `this` call forms bridge an explicit input expression to a whole lambda:

|JS            |exp                                            |
|--------------|-----------------------------------------------|
|`(aO)(...b)`  |`['this()', a:exp, O:lambda, b:exp]`           |
|`(aO)?.(...b)`|`['this?.()', a:exp, O:lambda, b:exp, lambda]` |

### Why this is preferable to `it` / `.this`

- ordinary `Exp` nodes remain context-independent and safely shareable;
- lambda operations cannot escape as const computations, so their implicit
  input and receiver are structurally unambiguous;
- all four lambda operations are small, fixed-arity steps with no continuation;
- one flat lambda array represents the rest of an HCF region;
- optional lambdas short-circuit the remaining suffix of that same array;
- `this()` / `this?.()` reuse the same lambda-array representation and consume
  the final receiver produced by the whole chain;
- non-lambda `()` / `?.()` never receive propagated `this`;
- optional-chain boundaries are explicit expression-level lambda arrays;
- no placeholder binding or identity-aware `it` ownership is needed;
- no compiler lookahead is needed to decide whether a property node should
  carry `this`.

### Tasks

- [ ] Replace the previous `it` / `.this` proposal with `LambdaOp` and
      `Lambda = readonly LambdaOp[]`.
- [ ] Define exact RTTI shapes for all ten operators and enforce fixed arity.
      Lambda operations must not have continuation operands.
- [ ] Make `LambdaOp` a structural type that is not an `Exp` and cannot be
      independently shared/memoized as a computation node.
- [ ] Define execution semantics for optional lambdas: `|?.` / `|?.()` must
      short-circuit the remaining suffix of their containing lambda array on a
      nullish input.
- [ ] Define execution semantics for receiver propagation through `|.` / `|?.`
      and consumption by `|()` / `|?.()`; ordinary `()` / `?.()` must never
      consume propagated receiver state.
- [ ] Define `this()` / `this?.()` over a whole `Lambda` array, using the final
      receiver produced by that array rather than the initial input.
- [ ] Update existing EDAG/compiler/interpreter design documents to the new
      vocabulary after the shapes are settled.
  - [ ] Remove `fjs/edag/todo/operations.md` after the new vocabulary has been
        applied; the exploratory operations note will then be superseded.
- [ ] Cover grouping and HCF boundaries in lowering/execution tests, including
      `a?.b.c`, `a?.b.c?.d.e`, `a?.b.c(d)`, `(a.b.c)(d)`, `(a?.b)(d)`,
      `(a?.b.c)(d)`, `(a?.(b).c)(d)`, `a.b?.(d)`, `(a?.b)?.(d)`,
      `a?.b?.(c).d(f)`, `(a?.b)?.(c).d(f)`, and `(a?.c.d.e(f))(g)`.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  compiler lowering must follow the settled operation vocabulary here.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary and HCF design context.
