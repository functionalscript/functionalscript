# Types for FunctionalScript

TypeScript has a fundamental flow in its type system for analyzing mutable types.

A typical example that shows the problem:

```ts
type A = { p: number }

const f = (a: A) => { a.p = 42 }

//
type A5 = { p: 5 }

const a: A5 = { p: 5 }

f(a) // a.p === 42 // :-(
```

## How is should work

```ts
type A = { p: number }

const f = (a: A) => { a.p = 42 }

//
type A5 = { p: 5 }

const a: A5 = { p: 5 }

f(a) // it should be a compilation error, because A5 can't be converted to A
```

Ok:

```ts
type A = { readonly p: number }

const f = (a: A) => a.p

//
type A5 = { p: 5 }

const a: A5 = { p: 5 }

f(a) // no compilation errors.
```

Mixed:

```ts
type A = {
    p: number
    readonly x: number
}

const f = (a: A) => a.p

//

type AX = {
    p: number
    readonly x: 5 | 6
}

const ax: A5 = { p: 5, x: 5 }

f(ax) // ok

//

type AP = {
    p: 5 | 6
    readonly x: number
}

const ap: A5 = { p: 5, x: 6 }

f(ap) // compilation error.
```

We may have a special version of TypeScript and it should have a run-time description, similar to [RTTI](../fs/types/rtti/README.md)

## Benefits

- **Use `.js` files.** Type annotations are written in comments, so the code stays plain JavaScript and runs as-is, with no additional compilation step. This could be very attractive for projects which don't accept TypeScript because of the additional compilation step. The syntax could be similar to JSDoc:

  ```js
  /** @type {RTTI-TYPE} */
  const x = ...
  ```

  or even simpler:

  ```js
  const x = //: RTTI-TYPE
      ...
  ```
