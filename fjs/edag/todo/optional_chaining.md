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

An optional expression operator owns a continuation: an ordered array of
lambda operations. A lambda operation takes the previous chain value
implicitly, so it does not need a placeholder such as `['it']`.

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
Exp          = ordinary EDAG computation; may be shared and memoized by identity
Lambda       = continuation step; not Exp; cannot be extracted/shared as const
Continuation = readonly Lambda[]
```

All four lambda forms are simple steps and do not own continuations:

```js
['|.', property]
['|()', args]
['|?.', property]
['|?.()', args]
```

The continuation array itself is the HCF region. An optional lambda (`|?.` or
`|?.()`) short-circuits the remaining suffix of its containing continuation
array when its input is nullish. Therefore an optional lambda does not need a
nested continuation of its own.

#### Optional-chain boundaries

The optional expression operators `?.`, `?.()`, and `this?.()` own continuation
arrays. An empty continuation means the optional HCF ends immediately after
that expression operation.

```js
// a?.b
['?.', a, b, []]

// f?.(...a)
['?.()', f, a, []]
```

Optional lambda operations use the continuation array that contains them:

```js
// a?.b?.c.d
['?.', a, b, [
    ['|?.', c],
    ['|.', d],
]]
```

If the input to `|?.c` is nullish, the remaining suffix (`|.d`) is skipped.
If grouping terminates an optional chain, a new expression-level optional
operation starts outside the old continuation:

```js
// (a?.b)?.c
['?.',
    ['?.', a, b, []],
    c,
    [],
]
```

Thus both optional expression operations and optional lambda operations can
represent optional chaining without lambda-local continuations: expression
operators define HCF regions, while optional lambdas jump to the end of the
region that already contains them.

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

The property lambda operators likewise establish receiver state:

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
    ['|?.()', c],
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
this() / this?.()   call with the final receiver produced by their lambda
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

#### Calls using the receiver produced by a lambda

Grouping can end a lambda/optional region while JavaScript still preserves the
receiver of the final property reference. Represent such calls with `this()` /
`this?.()`:

```js
['this()', input, lambda, args]
['this?.()', input, lambda, args, continuation]
```

The first operand is the initial input to `lambda`; it is not necessarily the
receiver of the final call. `lambda` can be any of the four lambda forms:

```js
['|.', property]
['|?.', property]
['|()', args]
['|?.()', args]
```

`this()` / `this?.()` evaluate the lambda step. When the lambda itself needs a
longer chain, that chain is represented by the continuation owned by the
surrounding optional expression rather than by the lambda node.

Examples:

```js
// a.b()
['this()', a, ['|.', b], args]

// (a?.b)()
['this()', a, ['|?.', b], args]

// a.b?.()
['this?.()', a, ['|.', b], args, []]

// (a?.b)?.()
['this?.()', a, ['|?.', b], args, []]
```

For a longer property chain whose final receiver must survive grouping, the
optional expression continuation carries the intermediate lambda steps before
the outer `this()` call is formed.

```js
// (a?.b.c)(...d)
['this()',
    a,
    ['|?.', b],
    d,
]
```

Conceptually, lowering of the grouped callee must preserve the final receiver
produced by the whole property chain (`a.b` for `.c`) before `this()` performs
the outer call. The exact RTTI shape for carrying a multi-step grouped lambda
into `this()` remains part of the implementation task below; lambda-local
continuations are intentionally not used for it.

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

On the successful property branch, the first `?.` enters its continuation
with `value = a.b` and `this = a`. The optional lambda call consumes that
receiver. If `a.b` is nullish, `|?.()` skips the remaining `.d(...f)` suffix.

Grouping moves the optional call outside the optional-property HCF while still
preserving the receiver produced by the grouped lambda:

```js
// (a?.b)?.(...c).d(...f)
['this?.()', a, ['|?.', b], c, [
    ['|.', d],
    ['|()', f],
]]
```

This structural difference directly represents the parentheses.

### Operator forms

The ordinary and lambda forms are:

|JS         |exp                           |lambda                   |
|-----------|------------------------------|-------------------------|
|`a.b`      |`['.', a:exp, b:exp]`         |`['\|.', b:exp]`         |
|`a(...b)`  |`['()', a:exp, b:exp]`        |`['\|()', b:exp]`        |
|`a?.b`     |`['?.', a:exp, b:exp, cont]`  |`['\|?.', b:exp]`        |
|`a?.(...b)`|`['?.()', a:exp, b:exp, cont]`|`['\|?.()', b:exp]`      |

Here `cont` is `readonly lambda[]` and belongs only to optional expression
operators, not to lambda operators.

The `this` call forms bridge an explicit input expression to a lambda:

|JS            |exp                                         |
|--------------|--------------------------------------------|
|`(aO)(...b)`  |`['this()', a:exp, O:lambda, b:exp]`        |
|`(aO)?.(...b)`|`['this?.()', a:exp, O:lambda, b:exp, cont]`|

### Why this is preferable to `it` / `.this`

- ordinary `Exp` nodes remain context-independent and safely shareable;
- lambda operators cannot escape as const computations, so their implicit
  input and receiver are structurally unambiguous;
- lambda nodes stay small: none of the four lambda forms owns a continuation;
- optional expression operators define HCF regions as flat lambda arrays;
- optional lambdas short-circuit the remaining suffix of their containing
  continuation array, so no nested lambda continuation is needed;
- `this` propagation and consumption are determined by the operator family;
- non-lambda `()` / `?.()` never receive propagated `this`;
- optional-chain boundaries are explicit expression-level continuation arrays;
- no placeholder binding or identity-aware `it` ownership is needed;
- no compiler lookahead is needed to decide whether a property node should
  carry `this`.

### Tasks

- [ ] Replace the previous `it` / `.this` proposal with the lambda-operation
      type model: `Lambda` plus expression-level `Continuation = readonly Lambda[]`.
- [ ] Define exact RTTI shapes for all ten operators and enforce fixed arity.
      Lambda forms must not have continuation operands.
- [ ] Make `Lambda` a structural type that is not an `Exp` and cannot be
      independently shared/memoized as a computation node.
- [ ] Define execution semantics for optional lambdas: `|?.` / `|?.()` must
      short-circuit the remaining suffix of their containing continuation
      array on a nullish input.
- [ ] Define execution semantics for receiver propagation into continuations,
      through `|.` / `|?.`, and consumption by `|()` / `|?.()`; ordinary
      `()` / `?.()` must never consume propagated receiver state.
- [ ] Define the exact multi-step grouped-lambda representation used by
      `this()` / `this?.()` so they consume the final receiver produced by the
      whole grouped lambda chain without adding lambda-local continuations.
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
