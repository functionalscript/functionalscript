## Optional chaining and hidden control flow

**Priority:** P4
**Status:** open

### Problem

Property access and optional chaining have two different kinds of hidden
control flow (HCF) that ordinary expression values do not represent.

A property access can carry its receiver into an immediately following call:

```js
[42].at(0)             // 42
([42].at)(0)           // 42

const at = [42].at
at(0)                   // throws
```

Optional chaining can skip the rest of the syntactic chain, but grouping ends
that chain:

```js
undefined?.a.b          // undefined
(undefined?.a).b        // throws
```

The rules are independent: parentheses preserve the receiver needed by a
call, but terminate optional-chain short-circuiting.

The current EDAG vocabulary has `.` for property access, `()` for calls, and
`.()` for property calls. Extending `.()` with a combined operator for every
plain/optional property and plain/optional call combination does not scale.
Naively nesting single-step optional operations does not work either, because
it would make `a?.b.c` behave like `(a?.b).c`.

### Proposal

#### Receiver HCF: `.this`

Make ordinary property access return an ordinary value with no receiver HCF:

```js
['.', object, property]
```

Add `.this` for the exceptional case where the property result must carry
`this = object` into an immediately following call computation:

```js
['.this', object, property]
```

Grouping parentheses are transparent for this rule. The relevant question is
whether the property result is immediately consumed as the callee of `()` or
`?.()` in the same source expression, not whether the source tokens are
textually adjacent.

Examples:

```js
// a.b
['.', a, b]

// a.b(...c)
['()', ['.this', a, b], c]

// (a.b)(...c)
['()', ['.this', a, b], c]

// const x = a.b; x(...c)
const x = ['.', a, b]
['()', x, c]

// a.b?.(...c)
['?.()', ['.this', a, b], c]
```

This retires `.()` as a breaking EDAG vocabulary change:

```js
// old
['.()', a, b, c]

// proposed
['()', ['.this', a, b], c]
```

The compiler rule is local, but it is also an EDAG validity rule. Public EDAG
input must not be able to keep receiver HCF alive accidentally through DAG
sharing. A `.this` node must therefore have exactly one consumer, and that
consumer must use it as the callee operand of `()` or `?.()`. A terminal
`?.this` node follows the same rule. A `?.this` continuation binds `['it']`
with receiver HCF, and that HCF-bearing result must likewise be consumed once
as the callee of `()` or `?.()` rather than used as an ordinary value.

This makes hidden `this` deliberately short-lived: ordinary `.`/`?.` values
never carry it, while `.this`/`?.this` mark the exact source location where an
immediately following call needs it.

#### Optional-chain HCF: continuation + `it`

A terminal optional property access is:

```js
// a?.b
['?.', a, b]
```

If the optional chain continues, the optional operation owns the remainder of
the chain as a continuation:

```js
['?.', object, property, continuation]
```

Introduce the contextual zero-operand operation:

```js
['it']
```

Inside the continuation, `it` is the value produced by the optional
operation. `['it']` has no default meaning outside such a continuation;
using it without an enclosing continuation binding is invalid EDAG. Nested
continuations introduce nested `it` bindings and shadow the outer binding.

This keeps the property operand in its existing special `index` type instead
of pretending that the property name is an `exp`.

For example:

```js
// a.b.c
['.', ['.', a, b], c]

// a?.b.c
['?.', a, b,
    ['.', ['it'], c],
]

// (a?.b).c
['.', ['?.', a, b], c]
```

The continuation is the optional-chain boundary. If `a` is nullish in the
second example, the continuation is not evaluated. In the third example the
terminal `?.` produces ordinary `undefined`, so the outer `.` throws.

Add `?.this` when an optional property result must also carry its receiver
into a call:

```js
['?.this', object, property]
['?.this', object, property, continuation]
```

On success, `it` in a `?.this` continuation denotes `object[property]` with
`this = object` HCF attached.

```js
// a?.b(...c)
['?.this', a, b,
    ['()', ['it'], c],
]

// a?.b?.(...c)
['?.this', a, b,
    ['?.()', ['it'], c],
]
```

If `a` is nullish, neither the arguments nor the continuation are evaluated.

A terminal `?.this` handles grouping correctly:

```js
// (a?.b)(...c)
['()', ['?.this', a, b], c]
```

If `a` is nullish, terminal `?.this` returns ordinary `undefined`; the outer
normal call evaluates `c` and throws. If `a` is non-nullish, the result still
carries `this = a` into the call.

`?.()` follows the same continuation rule when an optional chain continues
after a call:

```js
// f?.(...args)
['?.()', f, args]

// f?.(...args).x
['?.()', f, args,
    ['.', ['it'], 'x'],
]

// a?.b?.(...c).d
['?.this', a, b,
    ['?.()', ['it'], c,
        ['.', ['it'], d],
    ],
]
```

The inner continuation shadows `it` with the optional-call result.

The same local `.this` rule works even when the called property is not near
the root of the expression:

```js
// a?.b().c.d
['?.this', a, b,
    ['.',
        ['.', ['()', ['it'], args], c],
        d,
    ],
]

// a?.b.c(...d)
['?.', a, b,
    ['()', ['.this', ['it'], c], d],
]
```

Here `args` denotes the complete argument-array operand for `b()`.

#### Continuation scope and DAG identity

`it` is contextual, while EDAG evaluation memoizes operation nodes by identity.
The continuation binding must therefore be lexical rather than a dynamic
property of whichever consumer happens to evaluate a shared node.

Each continuation owns its `it` binding. A particular `['it']` node identity
must resolve to exactly one continuation binding. More generally, an
operation-node subgraph whose value depends on that `it` binding must not be
shared into a context where the same node would resolve under another `it`
binding or with no binding. Such ambiguous sharing is invalid EDAG and must be
rejected by the identity-aware validator.

Ordinary outer nodes that do not depend on `it` may still be referenced from a
continuation; the continuation is not a function boundary and does not require
capturing every outer value. The exact ownership algorithm belongs with the
identity-aware validation work, but the semantic invariant is fixed here: one
operation-node identity cannot acquire different values merely because it is
reached through different continuation bindings.

This is analogous to the existing function-scope rule for contextual
`['args']`/`['frame']`, but continuations introduce a narrower lexical binding
inside one function body.

### Operation summary

| EDAG operation | Meaning |
|---|---|
| `['.', object, property]` | property value, no receiver HCF |
| `['.this', object, property]` | property value carrying `this = object` for one immediate call |
| `['?.', object, property]` | terminal optional property value |
| `['?.', object, property, cont]` | optional property; `it = object[property]` inside `cont` |
| `['?.this', object, property]` | terminal optional property carrying `this = object` for one immediate call |
| `['?.this', object, property, cont]` | optional property; `it = object[property]` with `this = object` inside `cont` |
| `['()', callee, args]` | normal call, consuming receiver HCF when present |
| `['?.()', callee, args]` | terminal optional call, consuming receiver HCF when present |
| `['?.()', callee, args, cont]` | optional call; `it = call result` inside `cont` |
| `['it']` | result bound by the nearest owning optional continuation; invalid outside one |

Under this design `.()` is retired. Normal and optional method calls are
compositions of receiver HCF (`.this` / `?.this`) with `()` / `?.()`.
Because `.()` is already part of the documented EDAG vocabulary, removing it
is a breaking change rather than an internal refactor.

### Tasks

- [ ] Settle the exact RTTI/type shapes for terminal and continuation forms of
      `?.`, `?.this`, and `?.()` and add `it` to the contextual operation
      vocabulary.
- [ ] Define identity-aware continuation ownership: reject `it`-dependent
      operation-node sharing that would give one node identity more than one
      continuation binding.
- [ ] Enforce receiver-HCF canonicality in public EDAG validation: `.this`,
      terminal `?.this`, and an HCF-bearing `it` from `?.this` must each have
      one immediate call consumer and no non-call consumer.
- [ ] Retire `.()` as a breaking EDAG change and replace it with `.this` +
      `()` throughout the existing design and implementation plans, including
      `fjs/edag/README.md`, `fjs/djs/todo/interpret-edag.md`,
      `fjs/djs/todo/compile-modules-to-edag.md`, `todo/edag-spec.md`, and
      `todo/edag-stage1-discussion.md`.
- [ ] Add `?.`, `?.this`, and `?.()` to the EDAG vocabulary.
- [ ] Cover at least these cases in lowering/execution/validation tests:
      `a.b(c)`, `const x = a.b; x(c)`, `(a.b)(c)`, invalid shared `.this`,
      `a?.b.c`, `(a?.b).c`, `a?.b(c)`, `(a?.b)(c)`, `a.b?.(c)`,
      `a?.b?.(c)`, continued optional calls, nested `it` scopes, invalid
      cross-binding `it` sharing, and argument evaluation across
      chain/grouping boundaries.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  currently introduces unconditional `.`/`()`/`.()` and should follow the
  settled operation vocabulary here.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary and HCF design context.
