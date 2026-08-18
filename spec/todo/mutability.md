# 8. Mutable Objects and Ownership Tracking

Formerly §8 of the main [spec README](../README.md); the section numbers are
kept so older references such as "§8.1" still resolve.

The zero stage is to support [`let`](./3220-let.md).

The first stage is to support mutable objects only as a local variable:

```js
const my = () => {
   const map = new Map()
   map.set("hello", "world!") // we can change `map` here because we've never pass `map` to anything else.
   f(map) // now `map` is immutable.
   return map // returns an immutable Map.
}
```

Other stages may include passing mutable objects as parameters.

Implementing IO using mutable objects with ownership tracking:

```ts
type Io<S> = {
    readonly consoleLog: (s: S, msg: string) => void
    // ...
}
```

Or immutable

```ts
type Io<S> = {
    readonly consoleLog: (s: S, msg: string) => S
    // ...
}
```

With class supports, mutability state can be encapsulate with methods into one class:

```ts
class VirtualIo {
   #buffer = []
   function log(s: string) {
      this.#buffer.push(s)
   }
   function reset(x: readonly string[]) {
      // note, that we have to do a deep clone.
      this.#buffer = []
      for (const i of x) {
         this.#buffer.push(i)
      }
   }
}
```

## 8.1. Local mutability

```ts
const ar = () => {
   const a = [] // a is mutable
   a.push('hello')
   return a // now it's immutable
}
```

## 8.2. Pass Mutability

```ts
const ar = a => { // a is marked as mutable because we don't use the object anywhere else.
   a.push('hello')
}

const f = () => {
   const a = []
   ar(a)
   return a
}
```

Here we consider an object is mutable if it has only one path.

```ts
const f = a => { // a is not mutable because we return a
   return a
}

const f1 = a => {
   const x = () => {
      // a is mutable
      a.push('x')
   }
   x()
}

const f2 = a => {
   const x = () => {
      a.push('x')
   }
   return x // compilation error.
}
```

Should we have a global analysis?

## 8.3. Async in Tests

**Superseded for I/O by [io-effects](./io-effects.md).** This section asks how
a test supplies a fake, stateful `Fs` when the state has to be mutated and the
interface is promise-based. With effects neither half of the problem arises: a
test runs the same effect against the `mock` / virtual runner, which threads
its state explicitly — `(state, effect) => [state, result]` — so there is no
mutation to own and no promise to await. The sketch below remains of interest
only for host-side APIs that are promise-based to begin with, and for the
general question of `let` inside `async` functions.

```ts
type Fs = {
   readonly readFile: (name: string) => Promise<string>
   readonly writeFile: (name: string, text: string) => Promise<void>
}

// Should every test receive a state object, similar to Map?

type AsyncMap<K, V> = {
   readonly asyncGet: (k: K) => Promise<V|undefined>
   readonly asyncSet: (k: K, v: V|undefined) => Promise<void>
}

const fs = (state: AsyncMap<string, string>) => ({
   readFile: async(name: string): Promise<string> => { /* ? */ }
   writeFile: async(name: string, text: string): Promise<void> => { /* ? */ }
})

// Another option is to allow access to `let` in `async` functions.

const test = async(f: (fs: Fs) => Promise<void>): Promise<void> => {
    let x = new Map()
    const fs = {
        readFile: async() => {
            x.get() /* ... */
        }
        writeFile: async(k: string, v: string) => { // should writeFile
            x = new Map(concat(x, [[k, v]]))
        }
    }
    await f(fs)
}
```

## 8.4. Mutability Inference

```ts
const s = [] // mutable
const f = () => { // the function can be called only if s is mutable.
    s.push(3)     // s is mutable.
}
```

### Circular references

```ts
const s = [] //
const m = [] //
s.push(m)    // ok, but now `m` is immutable
m.push(s)    // error: `m` is immutable
```
