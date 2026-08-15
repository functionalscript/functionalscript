# FunctionalScript Language

Two main FunctionalScript principles:

1. if FS code passes validation/compilation, then it doesn't have side-effects,
2. the code that passed validation/compilation should behave on FunctionalScript VM the same way as on any other modern JavaScript engine.

FunctionalScript does not whitelist individual JavaScript operations in isolation. It whitelists complete semantic patterns. Some otherwise-forbidden JavaScript constructs may appear only as components of recognized patterns that lower to FunctionalScript primitives.

When we implement features of FunctionalScript, the first priority is a simplification of the VM.

This directory is the language specification. A feature document lives here in
`spec/` once the `fjs` parser recognizes the feature (checked items below);
documents for features not yet recognized live in [`spec/todo/`](./todo/README.md)
and move here when implemented.

File Types:

|File Type|Extension|Notes|
|---------|---------|-----|
|JSON|`.json`|Tree.|
|FJS source|`.f.mjs`|Graph with functions. Authored ESM JavaScript with JSDoc types; the extension does **not** imply that the current FunctionalScript parser/compiler accepts the module.|
|FJS source|`.f.js`|Generated output; must not be authored.|

Once authored `.f.js` package support is complete, compiler-supported `.f.mjs`
modules may move to authored `.f.js`, making `.f.js` the
compiler-compatibility marker. This migration grows incrementally as compiler
support grows. See [`fjs/fsc/README.md`](../fjs/fsc/README.md) for the
authoritative extension contract and
[`todo/migrate-typescript-to-mjs.md`](../todo/migrate-typescript-to-mjs.md) for the
repository migration plan.

**Note**: An FJS value can't be serialized without additional run-time infrastructure.

## 1. JSON

- [x] [JSON](./1000-json.md).
- [ ] [undefined-property](./todo/1010-undefined-property.md).

String literals at every level use JSON string syntax; full JS string
spellings are a deferred feature, see
[js-string-literals](./todo/2460-js-string-literals.md).

**VM**:
We are introducing new commands in such a way that every new command depends only on previous commands.

|format|any           |          |
|------|--------------|----------|
|JSON  |undefined     |          |
|      |null          |          |
|      |false         |          |
|      |true          |          |
|      |number        |u64       |
|      |string        |String    |
|      |array         |Array<Any>|
|      |object        |Object    |

## 2. DJS

The DJS form a graph of values. It can be serialized without additional run-time information.

|format|any                     |          |Notes                                           |
|------|------------------------|----------|------------------------------------------------|
|DJS   |const_ref               |u32       |[const](./2120-const.md)                        |
|      |bigint_plus             |Array<u64>|[bigint](./2320-bigint.md)                      |
|      |bigint_minus            |Array<u64>|[bigint](./2320-bigint.md)                      |
|      |undefined               |          |[undefined](./2310-undefined.md)                |
|      |own_property            |          |[property-accessor](./todo/2330-property-accessor.md)|
|      |instance_property       |          |[property-accessor](./todo/2330-property-accessor.md)|
|      |instance_method_call    |          |[property-accessor](./todo/2330-property-accessor.md)|
|      |at                      |          |[property-accessor](./todo/2330-property-accessor.md)|
|      |operators               |          |[operators](./todo/2340-operators.md)                |

### 2.1. Required

1. [x] [default-export](./2110-default-export.md),
2. [x] [const](./2120-const.md),
3. [x] [default-import](./2130-default-import.md).

### 2.2. Priority 1

We need it to use JSDoc and TypeScript.

1. [x] [block-comment](./2210-block-comment.md),
2. [ ] [namespace-import](./todo/2220-namespace-import.md).

### 2.3. Priority 2

1. [x] [undefined](./2310-undefined.md),
2. [x] [bigint](./2320-bigint.md),
3. [ ] [property-accessor](./todo/2330-property-accessor.md),
4. [ ] [operators](./todo/2340-operators.md),
5. [ ] [grouping](./todo/2350-grouping.md),
6. [ ] [built-in](./todo/2360-built-in.md),
7. [ ] property key as number — `{ 3e+7: true }` (no leading sign allowed).

### 2.4. Syntactic Sugar

1. [x] [identifier-property](./2410-identifier-property.md),
2. [x] [line-comment](./2420-line-comment.md),
3. [x] [trailing-comma](./2430-trailing-comma.md),
4. [ ] [shorthand](./todo/2440-shorthand.md),
5. [ ] [destructuring](./todo/2450-destructuring.md),
6. [ ] [js-string-literals](./todo/2460-js-string-literals.md).

## 3. FJS

The FJS can have functions. The format requires additional run-time information for serialization.

|format|any     |    |Notes                           |
|------|--------|----|--------------------------------|
|FJS   |function|Func|[function](./todo/3110-function.md)  |

### 3.1. Required

1. [ ] [function](./todo/3110-function.md)
2. [ ] [parameters](./todo/3120-parameters.md)
3. [ ] [body-const](./todo/3130-body-const.md)
4. [ ] [forward-references](./todo/3140-forward-references.md)

### 3.2. Priority 2

1. [ ] `if`. See https://developer.mozilla.org/en-US/docs/Glossary/Falsy
2. [ ] [let](./todo/3220-let.md)
3. [ ] `while`
4. [ ] [export](./todo/3240-export.md)
5. [ ] Ownership of Mutable Objects (Singletons). Wanted for local mutability
   (§8), **not** for I/O: effects keep I/O state in the runner (§5).

### 3.3. Priority 3

1. [ ] Regular Expressions.
2. [ ] [type-annotations](./todo/3360-type-annotations.md)
3. [ ] [type inference](./todo/3370-type-inference.md)
4. [ ] [promise](./todo/3380-promise.md). Needed for JavaScript interop only —
   I/O is done with effects and requires no promises (§5).
5. [ ] [class](./todo/3390-class.md)
6. [ ] Temporal classes. See https://github.com/functionalscript/functionalscript/pull/801

### 3.4. Syntactic Sugar

1. [ ] [expression](./todo/3410-expression.md)
2. [ ] [one-parameter](./todo/3420-one-parameter.md)
3. [ ] [assignments](./todo/3430-assignments.md)
4. [ ] [template-literals](./todo/3440-template-literals.md)
5. [ ] `async`/`await`. Depends on the implementation of promises.

## 4. ECMAScript Proposals

1. [ ] [Type Annotations](https://github.com/tc39/proposal-type-annotations), Stage 1:
   - [Node.js](https://nodejs.org/en/learn/typescript/run-natively),
   - `Deno` supports TypeScript,
   - `Bun` supports TypeScript,
   - most browsers don't support the feature.
2. [ ] [Pipe Operator `|>`](https://github.com/tc39/proposal-pipeline-operator), Stage 2.
3. [ ] [Records and Tuples](https://github.com/tc39/proposal-record-tuple), Stage 2:
   One problem with such records and tuples is that they can't hold safe, immutable functions. Maybe we need something like `#(a) => a * 2`.
4. [ ] [Pattern Matching](https://github.com/tc39/proposal-pattern-matching), Stage 1.
5. [ ] [Safe Assignment Operator](https://github.com/arthurfiorette/proposal-safe-assignment-operator).
6. [ ] [Temporal](https://github.com/tc39/proposal-temporal).

Wish list:

1. [ ] Utf8 String. Something like `u8"Hello, world"`.

## 5. I/O

**Decision:** I/O is done with **effects**. A program never calls the outside
world; it *describes* the call as an ordinary FJS value and hands the
description to a **runner**, which performs the call and resumes the program
with the output. The VM therefore implements neither external functions nor
promises — an effect is built from objects and functions the VM already has,
and everything impure lives in the runner, which is host code rather than
FunctionalScript.

This is the model sketched in the old §5.3 (a request plus a continuation),
now realized and in production use: the `fjs` CLI itself is a program of this
shape, run by the Node runner
([`fjs/module.mjs`](../fjs/module.mjs)). The earlier alternatives are recorded
in [§5.6](#56-earlier-alternatives-superseded).

Authoritative sources — this section describes them, they define the
behaviour:

|Source|Holds|
|------|-----|
|[`fjs/effects/types.ts`](../fjs/effects/types.ts)|the `Effect` type and its invariants|
|[`fjs/effects/module.f.mjs`](../fjs/effects/module.f.mjs)|`pure`, `do_`, `step` and the other combinators, `match`|
|[`fjs/effects/eff`](../fjs/effects/eff/README.md)|an optional method-chaining wrapper — an experiment, unstable, and expressible entirely in terms of `step`|

### 5.1. `Effect` — the value

```ts
type Effect<O extends Operation, T> = Pure<T> | Do<O, T>

// an already-computed `T` behind a thunk
type Pure<T> = () => T

// a request: what to perform, with what, and what to do with the output
type Do<O extends Operation, T> = {
    readonly command: O[0]
    readonly payload: Payload<O, O[0]>
    readonly continuation: (output: Output<O, O[0]>) => Effect<O, T>
}
```

(`Payload` and `Output` are written above for readability; the real types spell
both with the single conditional type `Pr<O, K>`, which projects an operation's
signature into `readonly[parameters, return]`.)

An `Effect<O, T>` is plain data that yields a `T` while performing commands
drawn from the operation set `O`. It has no methods, and the union carries no
tag field: `typeof e === 'function'` tells the two cases apart, which is the
only reason `Pure` is a thunk at all.

The thunk is therefore a **discriminator, not a suspension**. A `Pure` holds a
value that has already been computed; the thunk must be pure and total, and
nothing memoizes it, so it may be forced more than once. Everything that
*does* something is a `Do` node, and only a runner performs those. Hiding work
behind a `Pure` hides it from every runner and every mock, so it is a
correctness bug and not an optimization.

A `Do` node is where the old §5.3 `readonly[Input, Continuation]` went: the
same request-and-continuation pair, with the request split into a `command`
tag and its `payload` so that an interpreter can dispatch on the tag.

### 5.2. `Operation` — the interface to the host

```ts
type Operation = readonly[string, (..._: readonly never[]) => unknown]
```

An operation is a **name paired with a signature**: the signature's parameters
type the `payload`, its return type the value the continuation receives. It is
a type-level declaration only — there is no function to call.

Operation sets compose by union. `Effect` is covariant in `O`, so combining an
`Effect<A, _>` with an `Effect<B, _>` yields an `Effect<A | B, _>`: a program
accumulates the vocabulary it uses, and a runner must interpret at least that
much. A command is created with `do_`:

```js
export const readFile = do_('readFile') // Func<ReadFile>
```

**The language specifies no operations.** The set is the host's vocabulary, not
FunctionalScript's — filesystem, network, subprocess, console, clock and
randomness in [`NodeOp`](../fjs/effects/node/types.ts), key-value slots in
[`MemOp`](../fjs/effects/memory/types.ts). A new operation is a new type and a
new entry in each runner's map; it is never a new language feature.

Failures travel in the operation's return type — Node operations return
`IoResult<T> = Result<T, unknown>` — because FunctionalScript reserves `throw`
for panics and has no `try`/`catch`. Making that error channel part of `step`
itself is
[io-effect-migration](../fjs/effects/todo/io-effect-migration.md).

### 5.3. Composition

`step` is the primitive: run `e`, then continue with `f` applied to its result.

```js
const x0 = step(a, f)
const x1 = step(x0, g)
return step(x1, h)
```

It is **not lazy**: it reads `e`'s shape immediately, so a `Pure` head is
forced and `f` is called where the composition is written; only the `Do` case
defers, by rebuilding the continuation around `f`. That is sound exactly
because of the `Pure` contract above — forcing an already-computed value
observes nothing — and it is why a `defer` combinator cannot exist here: the
`Pure`/`Do` tag has to be known before anything runs, and the union has no
third case meaning "not yet decided".

The remaining combinators are `step` specializations, and
[`fjs/effects/module.f.mjs`](../fjs/effects/module.f.mjs) documents each one:
`mapStep` (a pure projection ending a chain), `historyStep` (carries earlier
values forward so a later link can read them without nesting), `foldStep` and
`forEachStep` (sequential iteration), `okStep` (the `Result` short-circuit).

Sequencing is thus ordinary function composition. `async`/`await` (§3.4) is
sugar for a different mechanism and is not required to write, or to run, an
effectful program.

### 5.4. Runners

A runner is an interpreter: it walks the effect, performs each command, and
feeds the output back into the continuation. `match` holds the step every
runner shares — decode the node, then dispatch its command through an
`OperationMap`, the table that maps each name in `O` to a handler — and a
runner is that plus one world-specific line:

|Runner|World-specific step|Use|
|------|-------------------|---|
|[`asyncRun`](../fjs/effects/module.mjs)|`await`|the base of every asynchronous runner|
|[`node`](../fjs/effects/node/module.mjs)|`asyncRun` against the real Node globals|production I/O; the `fjs` CLI|
|[`mock`](../fjs/effects/mock/module.f.mjs)|threads a state value: `state => effect => [state, result]`|synchronous, pure interpretation|
|[`node/virtual`](../fjs/effects/node/virtual/README.md)|`mock` over an in-memory filesystem, consoles, network and clock|tests, deterministic and race-revealing|
|[`node/memory`](../fjs/effects/node/memory/module.mjs)|`asyncRun` over a store owned by the operation map|the [`memory`](../fjs/effects/memory) operations (`MemOp`), state that outlives an effect step|

The command dispatch is a lookup on data, so the same program runs against any
of them unchanged. **This is what became of dependency injection (old §5.1):
the runner is the injected dependency** — one seam for the whole program,
chosen at the top by the caller that runs the effect, instead of an I/O record
threaded through every function that might need it.

Note what the table already shows: whether I/O is asynchronous is a property of
the *runner*, not of the program or the language. The same effect is awaited by
the Node runner and executed synchronously by the virtual one.

### 5.5. Consequences for the VM

1. **No external functions.** A command is data; only the runner, which is host
   code, ever performs one.
2. **No promises.** The old §5.2 required them; effects do not. Promises appear
   inside `asyncRun` and the Node runner because Node's API is promise-based,
   and nowhere in the effect values themselves. [promise](./todo/3380-promise.md)
   is therefore wanted for JavaScript interop, not for I/O, and is not a
   blocker for it.
3. **No mutable I/O state in the language.** A `mock` runner threads its state
   explicitly and returns the new one, so the ownership machinery of §8 is not
   a prerequisite for I/O either.
4. **A suspended program is a value.** A `Do` node is an FJS object whose
   `continuation` is an FJS function, and §9 makes a function's canonical
   representation an FJS value. Serializing a program that is waiting on I/O
   therefore needs no separate mechanism beyond §9.

### 5.6. Earlier alternatives (superseded)

Kept for the record; all three are subsumed by the sections above.

- **Isolated I/O** — dependency injection of an I/O record. Required the VM to
  implement external functions. What survives: the injection idea, moved to the
  runner ([§5.4](#54-runners)).
- **Isolated asynchronous I/O** — the same, with promises. Dropped: nothing in
  the effect representation is asynchronous, so the promise requirement
  disappears with it ([§5.5](#55-consequences-for-the-vm)).
- **State machine with asynchronous requests** — a program as
  `readonly[Input, Continuation]`, performed by the host. **Chosen**, and
  implemented as `Effect` ([§5.1](#51-effect--the-value)).

## 6. Content-Addressable VM

See also [Unison](https://www.unison-lang.org/), [ScrapScript](https://scrapscript.org/), [Dhall](https://dhall-lang.org/). And ZK: [Lurk](https://filecoin.io/blog/posts/introducing-lurk-a-programming-language-for-recursive-zk-snarks/).

Note that Dhall is not Turing-complete: it is a [total](https://en.wikipedia.org/wiki/Total_functional_programming) programming language, so every Dhall program is guaranteed to terminate. FunctionalScript as a CAPL can also have a total-functional subset, if needed. Another, more practical, option is that the VM can limit execution by time and memory parameters.

The main target is run-time performance.

Hash function: most likely SHA256 because there is a lot of hardware support from modern processors.

Hash structure: we will use several initial hashes for a compress function.

We may use CDT for huge arrays, objects, strings, and BigInts.

The first bit of a hash is reserved for a tag. If the tag is `0`, we have raw data with `1` at the end. A hash with all zeroes is used for `undefined`. If the first bit is `0`, then the value is a hash. So, we have only 255 bits for a hash.

Because we use tagged hash, we can keep small values in a `nanenum`. So it may reuse a lot from non-content addressable VM and ref-values can keep a hash value inside.

Instead of an address, we can use a prefix, hash. 48 bits should be enough for most cases. However, we also need a mechanism to resolve collisions (even if they are rare). For example, our value can be an enum like this

```rust
enum Value {
   Data(...),
   Hash(u48),
   Ref(u48),
}
```

However, while the `===` operation can be faster, `Value::Hash` is slower when we need to access the object's internals because it requires two dereference operations. So, we may come back to using only references.

```rust
enum Value {
   Data(...)
   Ref(u48)
}
```

The collision probability for 48 bits is 50% for `16777216 = 2^24` hashes (birthday attack).

## 7. Object Identity

To build custom dictionaries when using functions as a key, we need either an object identifier (for hash map `O(1)`) or a proper comparison operator (for BTree map `O(log(n))`). The best option now is to use `<` and then use an array for items that satisfy `(a !== b) && !(a < b) && !(b > a)`.

One of the options is to use `Map`. The `Map` type is mutable and requires an object ownership tracking, similar to Rust.

## 7.1. Hack For Map. Add `ReadonlyMap`

```ts
type ImmutableMap<K, V> = {
    readonly set(k: K, v: V): ImmutableMap<K, V>
    readonly delete(k: K): ImmutableMap<K, V>
}

const immutableMap = <K, V>(map: ReadonlyMap<K, V>) => ({
    set: (...kv: readonly[K, V]) => new Map([...map, kv])
    delete: (k: K) => new Map([...map.filter([k] => k !== k)])
})
```

## 7.2. Hack For Map. Special Instructions

```ts
// a special expression which is converted into one command.
new Map(a).set(k, v)

// a special expression which is converted into one command.
const b = new Map(a)
b.delete(k)
```

```ts
type ImmutableMap<K, V> = {
    readonly set(k: K, v: V): ImmutableMap<K, V>
    readonly delete(k: K): ImmutableMap<K, V>
}

const immutableMap = <K, V>(map: ReadonlyMap<K, V>) => ({
    set: (k: K, v: V) => new Map(map).set(k, v)
    delete: (k: K, v: V) => {
        const x = new Map(map)
        x.delete(k)
        return x
    }
})
```

## 8. Mutable Objects and Ownership Tracking

The zero stage is to support `let`.

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

**Superseded for I/O by §5.** This section asks how a test supplies a fake,
stateful `Fs` when the state has to be mutated and the interface is
promise-based. With effects neither half of the problem arises: a test runs the
same effect against the `mock` / virtual runner, which threads its state
explicitly — `(state, effect) => [state, result]` — so there is no mutation to
own and no promise to await. The sketch below remains of interest only for
host-side APIs that are promise-based to begin with, and for the general
question of `let` inside `async` functions.

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

## 9. Serialization: AST as Data, not Bytecode

**Decision:** the stable, canonical representation of functions is the **AST**, expressed as an
FJS value (`Any`). Code is data: the `Function` constructor accepts an `Any` that describes the
code, and the VM knows how to execute it (see [function](./todo/3110-function.md); the exact shape
is specified by the [ast-spec](../todo/ast-spec.md)). The reasons:

1. We need a canonical data representation of functions in FunctionalScript — and in the future
   content-addressable VM (CAVM) — to compute a hash.
2. The AST can be transformed back to source code; this transformation will be used in
   `toString(f)`.
3. Because code is an FJS value, serializing functions requires no separate format: once the VM
   serializes `Any` values, it serializes code too. The binary encoding of `Any` values is
   **CBOR** ([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)), chosen because it represents
   numbers as exact IEEE 754 doubles, avoiding the ambiguous binary↔decimal number conversion of
   text formats.
There are two execution paths, observably identical except in performance:

- **Interpretation** — the `Function` constructor executes the `Any` code description directly:
  the baseline path, required for the self-hosted `nanvm` and for code constructed at run time.
- **AOT compilation** — the FJS compiler generates Rust code that calls the `nanvm-lib` API, and
  rustc compiles it to native code: the bootstrap vehicle for compiling the compiler itself into
  `nanvm`, and the backend for platforms where interpretation is undesirable or JIT is forbidden
  (e.g. iOS, embedded).

Both paths bottom out in the same `nanvm-lib` operators, so shared operator tests cover their
common layer. A natively compiled function still carries its `Any` code description (as static
data), so hashing and `toString(f)` apply uniformly to all functions: the AST is the identity of
a function; native code is a cached acceleration of it.

Bytecode is an advanced, performance-oriented representation that may vary across architectures,
VM implementations, and versions, while the AST is the stable representation. A VM implementation
has an option to transform the AST into its internal bytecode on loading — or to use the AST
itself as its byte code, interpreting it directly; internal bytecode is never used as an
interchange or storage format.

Since bytecode is VM-internal, it can be designed in the most flexible manner, allowing
for various kinds of optimizations in VM implementations. For example, bytecode that always copies
arguments of a function call to devoted stack slots (before the proper call instruction) disallows
optimization opportunities for calling well-known host (built-in) functions that can be implemented
without excessive copying / slot allocations.

1. [ ] [Call-like instructions](./todo/9100-call-like-instructions.md) — VM-internal bytecode design.

### Byte Code Structures

VM-internal sketches; not part of the stable serializable format.

```rust
struct Array<T> {
    len: u32,
    array: [T; self.len],
}

type String = Array<u16>;

// LSB first.
type BigUInt = Array<u64>;

type Object = Array<(String, Any)>;

// The in-memory code of a function (VM-internal).
type Code = Array<u8>;

struct Function {
    length: u32,
    code: Code,
}

// Not for serialization — a parser resolves all imports.
struct Module {
    import: Array<String>,
    code: Code,
}
```
