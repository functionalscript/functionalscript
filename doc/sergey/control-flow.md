## Case 1. `if` expression

```ts
const r = c ? a : b
```

## Case 2. Expression Block

```ts
const r0 = c
    ? (() => { const x = 5; return x * x; })()
    : (() => { const y = 6; return y * y; })()
```

## Case 3. Terminated `if`

```ts
if (a) {
        return f()
}
return g()
```

As expression:

```ts
return a ? f() : g()
```

## Case 4. Partly-Terminated `if`

```ts
if (a) {
    const x = f()
    if (x.a()) {
        return x.b()
    }
}
return c()
```

As expression:

```ts
const shared = () => c()
return a
    ? (() => {
        const x = f()
        return x.a()
            ? x.b()
            : shared()
    })()
    : shared()
```

## Case 5. Let

```ts
let a = 0
const x = f(a)
a = a + 1
return g(a) + x
```

As expression:

```ts
const a0 = 0
const x = f(a0)
const a1 = a0 + 1
return g(a1) + x
```

## Case 6. Let in non-terminated `if`

```ts
let a = 0
if (b) { a = a + 2 }
return f(a)
```

As a set of statements:

```ts
const a0 = 0
const a1 = b ? a0 + 2 : a0
return f(a1)
```

Alternative

```ts
const a0 = 0
const shared = f
return b ? shared(a0 + 2) : shared(a0)
```

## Case 7. Let in Partly-Terminated `if`

```ts
let z = 0
if (a) {
    const x = f()
    if (x.a()) {
        return x.b()
    }
    z += x.c()
}
return c(z + 5)
```

As expression:

```ts
const z0 = 0
const shared = z => c(z + 5)
return a
    ? (() => {
        const x = f()
        return x.a()
            ? x.b()
            : (() => {
                const z1 = z0 + x.c()
                return shared(z1)
            })()
    })()
    : shared(z0)
```

## Case 8. `while (true)`

```ts
let a = 0
let b = 1
while (true) {
    if (x(b)) {
        b += 1
        break
    }
    if (x(a)) {
        a += 2
        continue
    }
    a += b
    b += 1
}
return c(b, a)
```

```ts
const loop0 = (a, b) =>
    x(b)
    ? [a, b]
    : x(a)
        ? loop0(a + 2, b)
        : loop0(a + b, b + 1)
const r = loop0(0, 1)
return c(r[1], r[0])
```

## Case 9. `while (true)` with `return`

```ts
let a = 0
while (true) {
    a += 1
    if (x(a)) { break }
    a += 1
    if (x(a)) {
        return m(a)
    }
    a += 1
}
return c(a)
```

In this case, we use everything after `while() {}` is used as a part of a loop

```ts
const loop0 = a0 => {
    const a1 = a0 + 1
    return x(a1)
        ? c(a1)
        : (() => {
            const a2 = a1 + 1
            return x(a2)
                ? m(a2)
                : loop0(a2 + 1)
        })()
}
```

## The Main Principles

- reassignment of mutable variable `let` makes a new `const`.
- while uses external mutable reassignments as parameters for recursion.
- `return` in `if` or `while` makes the code outside of `if`/`while` block as a part of an expression. Sometimes, we need to create `shared` object for the continuation.
