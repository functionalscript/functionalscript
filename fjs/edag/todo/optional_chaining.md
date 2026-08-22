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

#### Recursive lambda continuations

A lambda operation takes the previous chain value implicitly, so it does not
need a placeholder such as `['it']`. Every lambda operation also owns the next
lambda operation in the chain. The continuation is therefore a linked list of
lambda nodes rather than an array of sibling operations.

```js
// a?.b.c
['?.', a, b,
    ['|.', c, null],
]
```

Conceptually:

```text
a?.b
   |.c -> null
```

Lambda operations are structural continuation nodes, not independently
shareable EDAG computations:

```text
Exp    = ordinary EDAG computation; may be shared and memoized by identity
Lambda = continuation node; not Exp; cannot be extracted/shared as const
Cont   = Lambda | null
```

All four lambda forms have a continuation edge:

```js
['|.', property, cont]
['|()', args, cont]
['|?.', property, cont]
['|?.()', args, cont]
```

This matches the EDAG model: a node references the nodes needed to continue its
computation. A lambda chain is structurally:

```text
Lambda -> Lambda -> Lambda -> null
```

There are no sibling lambda operations, so there is no separate rule such as
"an optional lambda must be the last element of an array." The continuation
edge is exactly the rest of the chain.

#### Optional-chain boundaries

The optional expression operators `?.`, `?.()`, and `this?.()` have a `Cont`
operand. The optional lambda operators `|?.` and `|?.()` likewise use their
normal lambda continuation edge as the region they own. `null` means the HCF
ends immediately after that operation.

```js
// a?.b
['?.', a, b, null]

// f?.(...a)
['?.()', f, a, null]

// lambda ?.b
['|?.', b, null]

// lambda ?.(...a)
['|?.()', a, null]
```

Nested optional chains own nested continuation links. This makes the HCF
boundary structural rather than inferred from neighboring operations.

```js
// a?.b.c?.d.e
['?.', a, b,
    ['|.', c,
        ['|?.', d,
            ['|.', e, null],
        ],
    ],
]
```

Here `.e` is skipped when the value before `?.d` is nullish.

If grouping terminates that optional chain, the optional operation gets
`null`; subsequent computation is outside that HCF region. The general
distinction is:

```js
['|?.', d,
    ['|.', e, null],
] // ?.d.e

['|?.', d, null] // (?.d), optional HCF ends here
```

#### Receiver HCF inside lambda chains

Property steps establish receiver state for structural lambda evaluation.
For a successful full-form optional property with a non-null continuation,
that continuation starts with both the property value and its receiver:

```text
['?.', object, property, cont]

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

Their continuation, when present, receives the call result as the new current
value after that receiver has been consumed.

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
['?.', a, b,
    ['|?.()', c, null],
]
```

On the successful branch, `?.` enters its continuation with `value = a.b` and
`this = a`, so `|?.()` calls `a.b` with `this = a`.

A longer chain works the same way:

```js
// a?.b.c(...d)
['?.', a, b,
    ['|.', c,
        ['|()', d, null],
    ],
]
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
['this?.()', input, lambda, args, cont]
```

The first operand is the initial input to `lambda`; it is not necessarily the
receiver of the final call. `lambda` can start with any of the four lambda
forms, each of which can recursively continue with another lambda:

```js
['|.', property, cont]
['|?.', property, cont]
['|()', args, cont]
['|?.()', args, cont]
```

`this()` / `this?.()` evaluate the whole lambda chain. If that evaluation
reaches a final property reference, the outer call uses the final receiver
propagated by the lambda rather than the original `input`.

Examples:

```js
// a.b()
['this()', a, ['|.', b, null], args]

// (a?.b)()
['this()', a, ['|?.', b, null], args]

// a.b?.()
['this?.()', a, ['|.', b, null], args, null]

// (a?.b)?.()
['this?.()', a, ['|?.', b, null], args, null]
```

For a longer property chain, the final receiver comes from the continuation:

```js
// (a?.b.c)(...d)
['this()',
    a,
    ['|?.', b,
        ['|.', c, null],
    ],
    d,
]
```

Conceptually:

```text
input = a
|?.b   -> value = a.b,   this = a
|.c    -> value = a.b.c, this = a.b
this() -> call a.b.c with this = a.b
```

The root lambda does not have to be a property operation. For example, an
optional call can own a continuation that eventually produces the property
reference used by the outer `this()` call:

```js
// (a?.(...b).c)(...d)
['this()',
    a,
    ['|?.()', b,
        ['|.', c, null],
    ],
    d,
]
```

Here `|?.()` evaluates `a?.(...b)`; on its successful branch `|.c` establishes
the final receiver, and the outer `this()` calls that `.c` value with the
receiver produced by `|.c`.

By contrast, a call result is an ordinary value. The receiver HCF has already
been consumed:

```js
// (a?.c.d.e(...f))(...g)
['()',
    ['?.', a, c,
        ['|.', d,
            ['|.', e,
                ['|()', f, null],
            ],
        ],
    ],
    g,
]
```

The outer call is `()`, not `this()`, because `|()` consumed the receiver of
`.e`. As a non-lambda call, `()` never receives propagated receiver state.

#### Larger examples

```js
// a?.b?.(...c).d(...f)
['?.', a, b,
    ['|?.()', c,
        ['|.', d,
            ['|()', f, null],
        ],
    ],
]
```

On the successful property branch, the first `?.` enters its continuation
with `value = a.b` and `this = a`. The optional lambda call consumes that
receiver. It also owns `.d(...f)`, so when `a.b` is nullish, `c`, `.d`, and
`f` are skipped.

Grouping moves the optional call outside the optional-property HCF while still
preserving the receiver produced by the lambda:

```js
// (a?.b)?.(...c).d(...f)
['this?.()', a, ['|?.', b, null], c,
    ['|.', d,
        ['|()', f, null],
    ],
]
```

This structural difference directly represents the parentheses.

### Operator forms

The ordinary and lambda forms are:

|JS         |exp                           |lambda                         |
|-----------|------------------------------|-------------------------------|
|`a.b`      |`['.', a:exp, b:exp]`         |`['\|.', b:exp, cont]`         |
|`a(...b)`  |`['()', a:exp, b:exp]`        |`['\|()', b:exp, cont]`        |
|`a?.b`     |`['?.', a:exp, b:exp, cont]`  |`['\|?.', b:exp, cont]`        |
|`a?.(...b)`|`['?.()', a:exp, b:exp, cont]`|`['\|?.()', b:exp, cont]`      |

Here `cont` is `lambda | null`. Unlike the expression forms, **all four lambda
forms always have a continuation operand**, including `|.` and `|()`.

The `this` call forms bridge an explicit input expression to a lambda:

|JS            |exp                                         |
|--------------|--------------------------------------------|
|`(aO)(...b)`  |`['this()', a:exp, O:lambda, b:exp]`        |
|`(aO)?.(...b)`|`['this?.()', a:exp, O:lambda, b:exp, cont]`|

### Why this is preferable to `it` / `.this`

- ordinary `Exp` nodes remain context-independent and safely shareable;
- lambda operators cannot escape as const computations, so their implicit
  input and receiver are structurally unambiguous;
- a lambda chain is represented by node references, matching the EDAG model;
- every lambda owns exactly one continuation edge, so optional HCF ownership
  requires no sibling-order validation rule;
- `this` propagation and consumption are determined by the operator family;
- non-lambda `()` / `?.()` never receive propagated `this`;
- `this()` / `this?.()` consume the final receiver produced by their lambda,
  independent of the lambda's root form or continuation depth;
- optional-chain boundaries are explicit recursive continuation links;
- no placeholder binding or identity-aware `it` ownership is needed;
- no compiler lookahead is needed to decide whether a property node should
  carry `this`.

### Tasks

- [ ] Replace the previous `it` / `.this` proposal with the recursive lambda
      type model: `Lambda` and `Cont = Lambda | null`.
- [ ] Define exact RTTI shapes for all ten operators and enforce fixed arity.
      Every lambda form must have its `Cont` operand.
- [ ] Make `Lambda` a structural type that is not an `Exp` and cannot be
      independently shared/memoized as a computation node.
- [ ] Define execution semantics for recursive lambda continuation links,
      including optional HCF ownership and `null` termination.
- [ ] Define execution semantics for receiver propagation into continuations,
      through `|.` / `|?.`, and consumption by `|()` / `|?.()`; ordinary
      `()` / `?.()` must never consume propagated receiver state.
- [ ] Define `this()` / `this?.()` for all four `Lambda` root forms, using the
      final receiver produced by the whole lambda chain rather than the
      initial input.
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
