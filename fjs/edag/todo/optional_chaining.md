## Optional chaining and unbind

**Priority:** P3
**Status:** open

### Problem

The EDAG operation vocabulary (`.`, `()`, `.()`) has no representation for
JavaScript's optional chaining (`a?.b`, `a?.(b)`, and the four `a.b(c)`
variants that mix a plain/optional property step with a plain/optional call
step) or for unbinding a method reference from its receiver (`(obj.method)(0)`
loses `this`, unlike `obj.method(0)`). Both are real ECMAScript semantics a
`.`/`()`/`.()`-based EDAG needs once source compilation covers general
method-call chains, not just the unconditional forms already in
[`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md).

### Proposal

#### 3 Main Operations

##### Chaining for `a.b`

|  |        |     |
|--|--------|-----|
|1.| `a .b` | `.` |
|2.| `a?.b` | `?` |

##### Chaining for `a(b)`

|  |          |     |
|--|----------|-----|
|1.| `a  (b)` | `.` |
|2.| `a?.(b)` | `?` |

##### Chaining for `a.b()`

```js
['.()', exp0, prop, args] // exp0.prop(args)
```

|  |             |      |
|--|-------------|------|
|1.| `a .b  (c)` | `..` |
|2.| `a?.b  (c)` | `?.` |
|3.| `a .b?.(c)` | `.?` |
|4.| `a?.b?.(c)` | `??` |

#### Unbind

##### Chaining for `a.b`

|  |        |     |
|--|--------|-----|
|1.| `a .b` | `.` |
|2.| `a?.b` | `?` |

##### Chaining for `a(b)`

|  |          |     |
|--|----------|-----|
|1.| `a  (b)` | `.` |
|2.| `a?.(b)` | `?` |

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

### Tasks

- [ ] Introduce optional property access `a?.b` and optional call `a?.(b)`
      into the EDAG operation vocabulary.
- [ ] Introduce the four `a.b(c)`-shaped chaining variants (`..`, `?.`, `.?`,
      `??`) that mix a plain/optional property step with a plain/optional
      call step.
- [ ] Introduce `['unbind', exp]` for de-binding a method reference from its
      receiver.
- [ ] Add validation/proof coverage matching the `Examples` table's
      throw/no-throw semantics.

### Related

- [`compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md) —
  Stage 2's unconditional `.`/`()`/`.()` call/method-call work this extends.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) — the
  broader EDAG operation vocabulary this joins.
