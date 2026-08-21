# Optional Chaining

## 3 Main Operations

### Chaining for `a.b`

|  |        |     |
|--|--------|-----|
|1.| `a .b` | `.` |
|2.| `a?.b` | `?` |

### Chaining for `a(b)`

|  |          |     |
|--|----------|-----|
|1.| `a  (b)` | `.` |
|2.| `a?.(b)` | `?` |

### Chaining for `a.b()`

```js
['.()', exp0, prop, args] // exp0.prop(args)
```

|  |             |      |
|--|-------------|------|
|1.| `a .b  (c)` | `..` |
|2.| `a?.b  (c)` | `?.` |
|3.| `a .b?.(c)` | `.?` |
|4.| `a?.b?.(c)` | `??` |

```js
['.()', exp0, prop, args] // exp0.prop(args)
```

## Unbind

### Chaining for `a.b`

|  |        |     |
|--|--------|-----|
|1.| `a .b` | `.` |
|2.| `a?.b` | `?` |

### Chaining for `a(b)`

|  |          |     |
|--|----------|-----|
|1.| `a  (b)` | `.` |
|2.| `a?.(b)` | `?` |

### Unbind

`['unbind', exp]`

## Examples

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

