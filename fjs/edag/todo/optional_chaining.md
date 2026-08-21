## Optional chaining and unbind

**Priority:** P4
**Status:** open

### Problem

The EDAG operation vocabulary (`.`, `()`, `.()`) has no representation for
JavaScript's optional chaining (`a?.b`, `a?.(b)`, and three of the four
`a.b(c)` variants that mix a plain/optional property step with a
plain/optional call step — the fourth, both-plain, is already `.()`) or for
unbinding a method reference from its receiver. Parenthesizing a
member expression does **not** unbind it — `(obj.method)(0)` still calls with
`obj` as `this`, same as `obj.method(0)`, since `()` is pure grouping. Only
*extracting* the method into a value unbinds it: `const x = obj.method; x(0)`
loses `this` and throws for a receiver-dependent method. Both chaining and
unbind are real ECMAScript semantics a `.`/`()`/`.()`-based EDAG needs once
source compilation covers general method-call chains, not just the
unconditional forms already in
[`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md).

### Scratches

Not a proposal — exploratory notes and behavior examples only, written while
poking at the problem. Nothing below is a settled operation shape; see
"Tasks" for what actually comes next.

#### 3 Main Operations

##### Chaining for `a.b`

|  |        |      |
|--|--------|------|
|1.| `a .b` | `.`  |
|2.| `a?.b` | `?.` |

##### Chaining for `a(b)`

|  |          |        |
|--|----------|--------|
|1.| `a  (b)` | `()`   |
|2.| `a?.(b)` | `?.()` |

##### Chaining for `a.b()`

```js
['.()', exp0, prop, args] // exp0.prop(args)
```

|  |             |          |
|--|-------------|----------|
|1.| `a .b  (c)` | `.()`    |
|2.| `a?.b  (c)` | `?.()`   |
|3.| `a .b?.(c)` | `.?.()`  |
|4.| `a?.b?.(c)` | `?.?.()` |

#### Unbind

##### Chaining for `a.b`

|  |        |      |
|--|--------|------|
|1.| `a .b` | `.`  |
|2.| `a?.b` | `?.` |

##### Chaining for `a(b)`

|  |          |        |
|--|----------|--------|
|1.| `a  (b)` | `()`   |
|2.| `a?.(b)` | `?.()` |

##### Unbind

`['unbind', exp]`

#### Examples

```js
[42].at(0)             // 42

([42].at)(0)           // 42

const x = [42].at
x(0)                   // throws

undefined.a            // throws

undefined?.a.b         // undefined

(undefined?.a).b       // throws

const y = undefined?.a
y.b                    // throws
```

|                      |      |                          |           |
|----------------------|------|--------------------------|-----------|
|`[42].at(0)`          |`42`  |`undefined?.a.b`          |`undefined`|
|`([42].at)(0)`        |`42`  |`(undefined?.a).b`        |throws     |
|`const x=[42].at;x(0)`|throws|`const x=undefined?.a;x.b`|throws     |

**Open question: parens mean opposite things in the two columns above, and
that's not a table-formatting accident — it's two different ECMAScript
rules.** For unbind (left column), `()` is pure grouping: `(obj.method)`
denotes the exact same reference as `obj.method`, so calling it preserves
`this` either way — parens are transparent. For optional chaining (right
column), `?.` short-circuits the *entire syntactic chain it heads*, not just
its own operand: `undefined?.a.b` never evaluates `.b` at all and the whole
expression is `undefined`, but `(undefined?.a).b` evaluates `undefined?.a` to
`undefined` *inside* the parens, closing off the chain, and then applies a
plain `.b` to that `undefined` *outside* it — which throws. Parens are a hard
boundary for optional chaining, unlike for unbind.

This matters for how multi-step chains compile, not just for parenthesized
ones: representing `a?.b.c` by nesting single-step nodes the way `.()`/`()`
already nest (a `.c` node wrapping a `?.b` node, each evaluated and applied in
turn) would evaluate `?.b` down to a concrete `undefined` value *before* the
outer `.c` node ever runs — which is exactly the parenthesized `(a?.b).c`
behavior (throws), not the correct unparenthesized `a?.b.c` behavior
(`undefined`, no throw). Naive per-step nesting cannot represent chain-wide
short-circuit propagation; whatever operation shape lands for `?.` needs to
address this before implementation, not assume single-step nesting composes
the way `.`/`()` already do.

### Tasks

The scratches above surfaced real edge cases faster than they surfaced a
design — the next step is investigation, not implementation.

- [ ] Investigate optional chaining and unbind thoroughly: enumerate the
      edge cases (chain-wide short-circuit propagation past multiple steps,
      see "Open question" above; parens as a hard boundary for chaining vs.
      pure grouping for unbind; interaction with `??`/other operators;
      anything else the scratches above didn't cover) and come up with a
      concrete proposal for the EDAG operation shape(s) — not assuming
      single-step nesting composes the way `.`/`()` already do.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  Stage 2's unconditional `.`/`()`/`.()` call/method-call work this extends.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary this joins.
