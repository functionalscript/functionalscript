## Optional chaining and hidden control flow

**Priority:** P4
**Status:** open

### Problem

Property access and optional chaining both have semantics that are not fully
represented by ordinary expression values.

JavaScript property access can carry a hidden receiver into an immediately
following call:

```js
[42].at(0)             // 42
([42].at)(0)           // 42

const at = [42].at
at(0)                   // throws
```

Optional chaining has a different hidden control flow: an optional step can
skip the rest of the syntactic chain, but grouping ends that chain:

```js
undefined?.a.b          // undefined
(undefined?.a).b        // throws
```

These are independent rules. Parentheses preserve the receiver/reference
needed by a call, but terminate optional-chain short-circuiting.

The current EDAG vocabulary has `.` for property access, `()` for calls, and
`.()` for property calls. Extending `.()` by multiplying combined operators
for every plain/optional property and plain/optional call combination does
not scale well. Naively nesting single-step optional operations does not work
either: it would make `a?.b.c` behave like `(a?.b).c`.

This proposal represents the two hidden control flows separately:

1. receiver (`this`) HCF is exceptional and explicitly marked on the property
   operation that is immediately consumed by a call;
2. optional-chain HCF is structural: the optional operation owns the rest of
   the chain as a continuation.

### Proposal

#### Property values are unbound by default

Change `.` to mean an ordinary property value with no receiver HCF:

```js
['.', object, property]
```

Add `.this` for the exceptional case where the property result must carry its
receiver into an immediately following `()` or `?.()`:

```js
['.this', object, property]
```

The source compiler uses `.this` only when that member expression is the
callee of an immediately following normal or optional call in the same
expression. Otherwise it uses `.`.

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

This removes the need for `.()`:

```js
// old
['.()', a, b, c]

// proposed
['()', ['.this', a, b], c]
```

The important invariant is that hidden `this` does not leak from an ordinary
property node and therefore cannot accidentally survive through EDAG sharing.
Only `.this` explicitly produces it, and the compiler emits `.this` only when
the receiver has a known immediate consumer.

This is preferable to putting an "unbind" flag on a later call: a property
node can have multiple consumers in a DAG, and every consumer should not have
to remember whether it is allowed to use a receiver left behind by some
producer.

#### Optional property access owns a continuation

A terminal optional property access remains compact:

```js
// a?.b
['?.', a, b]
```

But if the source optional chain continues, `?.` owns a continuation:

```js
['?.', object, property, continuation]
```

Its semantics are conceptually:

```js
const base = object
if (base === null || base === undefined) {
    return undefined
}
const value = base[property]
return continuation(value)
```

The continuation must be represented as EDAG without turning a property
`index` into an ordinary `exp`. Introduce a contextual zero-operand operation:

```js
['%']
```

Inside an optional continuation, `%` is the value produced by the optional
operation. Nested continuations shadow the outer `%`.

For example:

```js
// a?.b.c
['?.', a, b,
    ['.', ['%'], c],
]

// (a?.b).c
['.', ['?.', a, b], c]
```

The first form keeps `.c` inside the optional-chain HCF, so it is skipped when
`a` is nullish. The second form uses the terminal `?.`; the outer `.` sees the
ordinary `undefined` result and throws.

This structural continuation is the optional-chain boundary. No optional HCF
has to escape from one evaluated EDAG node and be rediscovered by a later
consumer.

#### Optional property access with `this`

Add `?.this` for an optional property step whose resulting property reference
must carry its receiver into a call:

```js
['?.this', object, property]
['?.this', object, property, continuation]
```

On a successful property access, `%` in the continuation denotes the property
value with `this = object` HCF attached. A following `()` or `?.()` consumes
that receiver.

Examples:

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

If `a` is nullish, neither call arguments nor any later continuation nodes are
evaluated.

A terminal `?.this` is useful when grouping ends the optional chain but the
result is still immediately called:

```js
// (a?.b)(...c)
['()', ['?.this', a, b], c]
```

If `a` is nullish, terminal `?.this` returns ordinary `undefined`; the outer
normal call evaluates `c` and then throws. If `a` is non-nullish, the result
carries `this = a`, so the call has the same receiver as JavaScript.

This is the key distinction between the two HCFs: grouping terminates the
optional continuation but does not unbind a member reference.

#### Optional calls can also own continuations

`?.()` is the optional-call analogue. The terminal form is:

```js
// f?.(...args)
['?.()', f, args]
```

If an optional chain continues after the call, `?.()` can own a continuation
and rebind `%` to the call result:

```js
['?.()', callee, args, continuation]
```

For example:

```js
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

In the second example, the outer `?.this` binds `%` to `a.b` with `this = a`.
The inner `?.()` consumes that receiver if `a.b` is callable and non-nullish,
then its continuation shadows `%` with the call result before evaluating
`.d`.

Longer chains need no special root rule. For example, in:

```js
a?.b().c.d
```

`b` is the only property immediately followed by a call, so it is the only
step that needs receiver HCF. Conceptually:

```js
['?.this', a, b,
    ['.',
        ['.', ['()', ['%'], args], c],
        d,
    ],
]
```

where `args` denotes the complete argument-array operand for `b()`.

Likewise:

```js
a?.b.c(...d)
```

needs receiver HCF only for `c`:

```js
['?.', a, b,
    ['()', ['.this', ['%'], c], d],
]
```

The compiler rule is therefore local: a property step uses `.this` or
`?.this` exactly when that step is immediately followed by `()` or `?.()` in
the same source expression. It does not need to discover where the complete
expression or optional chain ends.

### `%` as the current value

Rather than making `%` meaningful only inside optional chaining, make it a
general contextual EDAG value.

At the beginning of an EDAG evaluation scope:

```js
['%']
```

has the value of:

```js
['.', ['args'], 0]
```

An optional continuation temporarily shadows that default with the result of
its optional property access or optional call. A nested function body starts
a new evaluation scope, so its `%` again denotes that function's first
argument; the enclosing `%` is available only if explicitly captured in the
function frame.

This is also useful for curried FunctionalScript code, where unary functions
are common. The `%` spelling follows the placeholder convention used by Hack
pipes and the TC39 pipeline-operator proposal:
https://github.com/tc39/proposal-pipeline-operator.

`%` should be added to the `op0` vocabulary alongside `args` and `frame`.

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

Under this design `.()` is removed; normal and optional method calls are
compositions of property-reference HCF with `()` / `?.()`.

### Alternatives considered

#### Explicit unbind/value operator

A separate operation could strip receiver HCF when a member value is stored:

```js
[',', ['.this', a, b]]
```

A unary comma is a plausible "materialize value" operation because JavaScript
already demonstrates the behavior with `(0, obj.method)()`. This is
semantically direct, but it adds nodes at every value boundary and can
redundantly clear `this` when no receiver exists.

#### `.;` / `?.;`

Another option is to make `.` / `?.` propagate receiver HCF and use `.;` /
`?.;` for the ordinary value forms. This keeps the choice at the producer,
but makes HCF propagation the default. The proposal above reverses that:
plain `.` / `?.` are safe ordinary values, while the exceptional forms are
visibly named `.this` / `?.this`.

#### `;()` / `;?.()`

Putting the unbind choice on call operators makes tracking less local. A
shared producer could still carry receiver HCF, and another consumer could
accidentally use it by forgetting the `;`. The proposal instead ensures that
ordinary property nodes never carry receiver HCF in the first place.

### Tasks

- [ ] Settle the exact RTTI/type shapes for terminal and continuation forms of
      `?.`, `?.this`, and `?.()`.
- [ ] Add `%` to `op0` and define its scope/default-value semantics.
- [ ] Replace `.()` with `.this` + `()` in the EDAG design and update the
      compiler/interpreter plans that currently reference `.()`.
- [ ] Add `?.`, `?.this`, and `?.()` to the EDAG vocabulary.
- [ ] Specify validation/canonicality rules for receiver HCF, including that
      `.this` is emitted only for an immediately called property result.
- [ ] Cover at least these lowering/execution cases:
      - `a.b(c)` vs `const x = a.b; x(c)` vs `(a.b)(c)`;
      - `a?.b.c` vs `(a?.b).c`;
      - `a?.b(c)` vs `(a?.b)(c)`;
      - `a.b?.(c)` and `a?.b?.(c)`;
      - optional calls followed by more property/call steps;
      - nested optional chains and `%` shadowing;
      - argument evaluation on short-circuited vs grouped optional calls.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  currently introduces unconditional `.`/`()`/`.()` and should follow the
  settled operation vocabulary here.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary and hidden-control-flow design context.
