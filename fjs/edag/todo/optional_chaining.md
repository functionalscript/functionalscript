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
`this = object` into an immediately following `()` or `?.()`:

```js
['.this', object, property]
```

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

This replaces `.()`:

```js
// old
['.()', a, b, c]

// proposed
['()', ['.this', a, b], c]
```

The compiler rule is local: use `.this` only when the member expression is
immediately followed by `()` or `?.()` in the same source expression.
Otherwise use `.`. Hidden `this` therefore does not leak through ordinary
property nodes or arbitrary DAG sharing.

#### Optional-chain HCF: continuation + `%`

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
['%']
```

Inside the continuation, `%` is the value produced by the optional operation.
Nested continuations shadow the outer `%`.

This keeps the property operand in its existing special `index` type instead
of pretending that the property name is an `exp`.

For example:

```js
// a.b.c
['.', ['.', a, b], c]

// a?.b.c
['?.', a, b,
    ['.', ['%'], c],
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

On success, `%` in a `?.this` continuation denotes `object[property]` with
`this = object` HCF attached.

```js
// a?.b(...c)
['?.this', a, b,
    ['()', ['%'], c],
]

// a?.b?.(...c)
['?.this', a, b,
    ['?.()', ['%'], c],
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
    ['.', ['%'], 'x'],
]

// a?.b?.(...c).d
['?.this', a, b,
    ['?.()', ['%'], c,
        ['.', ['%'], d],
    ],
]
```

The inner continuation shadows `%` with the optional call result.

The same local `.this` rule works even when the called property is not near
the root of the expression:

```js
// a?.b().c.d
['?.this', a, b,
    ['.',
        ['.', ['()', ['%'], args], c],
        d,
    ],
]

// a?.b.c(...d)
['?.', a, b,
    ['()', ['.this', ['%'], c], d],
]
```

Here `args` denotes the complete argument-array operand for `b()`.

#### `%` as the current value

Make `%` a general contextual EDAG value rather than a placeholder specific to
optional chaining.

At the beginning of an EDAG evaluation scope:

```js
['%']
```

has the value of:

```js
['.', ['args'], 0]
```

An optional continuation shadows that default with its result. A nested
function body starts a new evaluation scope, so its `%` again denotes that
function's first argument; an enclosing `%` must be captured explicitly if
needed.

This is also useful for curried FunctionalScript code, where unary functions
are common. The `%` spelling follows the placeholder convention used by Hack
pipes and the TC39 pipeline-operator proposal:
https://github.com/tc39/proposal-pipeline-operator.

Add `%` to the `op0` vocabulary alongside `args` and `frame`.

### Operation summary

| EDAG operation | Meaning |
|---|---|
| `['.', object, property]` | property value, no receiver HCF |
| `['.this', object, property]` | property value carrying `this = object` for an immediate call |
| `['?.', object, property]` | terminal optional property value |
| `['?.', object, property, cont]` | optional property; `% = object[property]` inside `cont` |
| `['?.this', object, property]` | terminal optional property carrying `this = object` on success |
| `['?.this', object, property, cont]` | optional property; `% = object[property]` with `this = object` inside `cont` |
| `['()', callee, args]` | normal call, consuming receiver HCF when present |
| `['?.()', callee, args]` | terminal optional call, consuming receiver HCF when present |
| `['?.()', callee, args, cont]` | optional call; `% = call result` inside `cont` |
| `['%']` | current value; initially `args[0]`, shadowed by optional continuations |

Under this design `.()` is removed. Normal and optional method calls are
compositions of receiver HCF (`.this` / `?.this`) with `()` / `?.()`.

### Tasks

- [ ] Settle the exact RTTI/type shapes for terminal and continuation forms of
      `?.`, `?.this`, and `?.()`.
- [ ] Add `%` to `op0` and define its scope/default-value semantics.
- [ ] Replace `.()` with `.this` + `()` in the EDAG design and update the
      compiler/interpreter plans that currently reference `.()`.
- [ ] Add `?.`, `?.this`, and `?.()` to the EDAG vocabulary.
- [ ] Specify canonicality rules for receiver HCF, including that `.this` is
      emitted only for an immediately called property result.
- [ ] Cover at least these cases in lowering/execution tests:
      `a.b(c)`, `const x = a.b; x(c)`, `(a.b)(c)`, `a?.b.c`, `(a?.b).c`,
      `a?.b(c)`, `(a?.b)(c)`, `a.b?.(c)`, `a?.b?.(c)`, continued optional
      calls, nested `%` scopes, and argument evaluation across chain/grouping
      boundaries.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  currently introduces unconditional `.`/`()`/`.()` and should follow the
  settled operation vocabulary here.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary and HCF design context.
