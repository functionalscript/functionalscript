# L1: a first detailed design

This draft makes the options in [l1-operations.md](./l1-operations.md)
concrete. It builds on the [L0 design](./l0-design.md) and aims to write
as much of the runtime as possible in FunctionalScript. Native code comes
later, as a substitution of a body that already works
([DESIGN.md §13](../../DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
Nothing here is decided yet.

## Summary

L1 is option C of the notes: a closed, versioned list of operations, each
with a reference body. In the first implementation almost every body is
FunctionalScript, written over the [FunctionalScript view of
L0](./l0-design.md#17-a-functionalscript-view-of-l0). Only a short list of
operations is native: number formatting and parsing, `%`, `**`, the
32-bit integer operators, bigint arithmetic, and the member functions that
have no body yet. Every runtime implements those, and any other operation
it wants to make faster.

## Design choices

### 1. L1 bodies are FunctionalScript over typed values

- **Pick:** an L1 body is an ordinary FunctionalScript function in a new
  module, `fjs/wasm/runtime/l1`, which only the WASM backend compiles. It
  reads values through the L0 view and
  works on the typed results. For example, `+` is:

  ```js
  const add = (a, b) => {
      const ka = kind(a)
      const kb = kind(b)
      if (ka === NUMBER && kb === NUMBER) { return asNumber(a) + asNumber(b) }
      if (ka === STRING && kb === STRING) { return concat(a, b) }
      return addSlow(a, b)
  }
  ```

  `ka === NUMBER` compares two known numbers and `asNumber(a) + asNumber(b)`
  adds two, so the compiler emits `f64.eq` and `f64.add`, not a call to L1.
- **Why:** the decision to unpack values once
  ([L0 design](./l0-design.md#2-typed-values-exist-only-in-the-compiler))
  is what makes this possible. An operator on known types is a WASM
  instruction, so L1 can be written in the language it defines.

### 2. The closure rule

- **Pick:** inside `fjs/wasm/runtime/l1`, the compiler refuses any operator it
  would lower to an L1 import. An operator there must have typed operands,
  or the body must call another L1 body by name.
- **Why:** the rule makes the definition well founded, the same way the
  runtime today holds no member call
  ([fjs/js/runtime](../../../fjs/js/runtime/module.f.js)). A mistake is a
  compile error, not an infinite recursion at run time.

### 3. Proved on a JavaScript host first

- **Pick:** every L1 body has a proof that runs it in plain JavaScript and
  compares it with JavaScript's own operator, over a table of values of
  every kind. The L0 view's JavaScript bodies make this possible.
- **Why:** the reference bodies are correct before any WASM exists. Later,
  the same tables are the conformance test for every native substitution,
  NaNVM's existing Rust operations included. The module is held to the
  repository's full proof coverage, like any other.

### 4. Typed lowering is the compiler's, not L1's

The compiler emits a WASM instruction where it knows both operand types.
L1 is called only where it does not.

| Operands | Lowering |
| --- | --- |
| Two numbers: `+ - * /`, `< <= > >=`, `=== !==` | `f64.add` and its siblings |
| Two booleans, or `!` of a boolean | `i32` instructions |
| Two strings, `+` | L0 `concat` |
| Two strings, `===` and `<` | L1 string compare: a loop over `unit` in FunctionalScript |
| Spread of a known array or object: `[...xs, x]`, `{ ...o, [k]: v }` | L0 builder calls over `length`, `item` and `key`, emitted by the compiler |
| A condition that is a known boolean: `if`, `?:`, `&&`, `\|\|`, `!` | `br_if` and `i32` instructions; any other condition goes through L1 `toBoolean` |
| `x === undefined`, `x === null` and their `!==` | L0 `kind` and an `i32.eq` |
| A call of a known function | L0 `call` |
| `.length` of a known string or array | L0 `length` |
| Anything else | The L1 operation |

### 5. One calling convention for every L1 operation

- **Pick:** each operation is a WASM function from `any` values to
  `any`, the shape of [`call`](./l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text).
  The arguments are borrowed and the result is owned, as in L0.
- **Alternative:** a narrower type for an operation that cannot throw, such
  as `typeof`. That can come later as a specialised version.
- **Why:** a top-level FunctionalScript function compiles to exactly this
  shape. The L1 module is then one compiler output, not hand-written WASM.
- **Needs:** the compiler must compile a top-level function that captures
  nothing as a direct WASM function with one parameter per argument, besides
  the general `(self, args)` code that every function value has.
- **Variadic operations:** an operation that takes any number of
  arguments, such as the body of `String.fromCharCode`, has one parameter,
  the arguments as an array: `(any args) -> any`. Its function value
  passes the `args` of its `(self, args)` code straight through. A direct
  call such as `String.fromCharCode(a, b)` builds the array with L0's
  builder, as a spread does.

### 6. Errors are FunctionalScript throws

- **Pick:** an L1 body throws, as the runtime does today, for example
  `throw 'TypeError: unexpected type'` from `call` of a value that is not a
  function. The throw calls L0's
  [`throw`](./l0-design.md#13-errors-a-throw-traps), which traps.
- **Why:** there is nothing new to design. Each throw copies the text of
  the matching constructor in NaNVM's
  [`error.rs`](../../../nanvm/lib/src/vm/error.rs), the error's name, a
  colon and the message, so a native substitution and its body throw the
  same value and the proof tables can compare it. A case `error.rs` does
  not have yet gets a constructor there first. Whether the thrown value should
  be an error object, rather than a string, is a separate question for the
  whole runtime.

## The operations

| Group | Operations | First body |
| --- | --- | --- |
| Type tests | `typeof`, `instanceof` | FunctionalScript |
| Coercions | `toBoolean`, `toPrimitive`, `toPropertyKey`, `toString` of everything except numbers and bigints, `toNumber` of everything except strings, `toNumeric` | FunctionalScript |
| Arithmetic | `+ - * /` and unary `-`, number and string | FunctionalScript |
| Comparison | `=== !==`, `< <= > >=` of numbers and strings | FunctionalScript |
| Member read | `a[k]` and `a.k`: an object's own key through `find`, an array index, a string index, the `length` of a string, an array or a function | FunctionalScript |
| Today's intrinsics | `charCodeAt`, `slice`, `entry`, `hasEntry`, and the bodies of the statics `String.fromCharCode` and `Object.entries` ([L2 design](./l2-design.md#2-todays-natives-become-l1-operations)) | FunctionalScript |
| Calls | `call` of an unknown value, and `resolveMember`, the callee of `a[k](...)` | FunctionalScript, `resolveMember` through L2's `runtime.dot` |
| Iteration | `toIterable(v)`: an array as it is, a string as an array of its code points, a throw for anything else. Spread, `for...of` and array destructuring of an unknown value call it, then walk the array with `length` and `item`. Object spread of an unknown value | FunctionalScript |
| Numbers, native | `%`, `**`, `numberToString`, `stringToNumber` | Native |
| Integers, native | `& \| ^ ~ << >> >>>` and `ToInt32` | Native |
| Bigints, native | every operation on a bigint, and the mixed comparisons | Native |
| Members, native | `nativeMember(self, key)`: the member functions with no body in `fjs/js/runtime` yet, such as `map` | Native, shrinking as bodies are written |

Some operators need no operation of their own. Unary `+` is `toNumber`.
A template literal is `toString` of each part, then `concat`. A computed key
in an object literal is `toPropertyKey`. `in` is L2's `runtime.in`.

Optional chaining stays in the program, and the compiler emits the guard
itself with L0 `kind`. What it tests depends on where the `?.` stands, as
in NaNVM's `option_dot` and `option_call`:

- `a?.b`, `a?.[k]` and `a?.k(x)` test the receiver `a` for `undefined` and
  `null` first. Only after that does the program evaluate `k` and read the
  member, or call `resolveMember`, so `undefined?.x` answers `undefined`
  and does not throw.
- `f?.(x)` and `a.k?.(x)` get the callee first, through `resolveMember` for
  a member, then test the callee.

When the test fails, the guard jumps to the end of the whole chain, which
answers `undefined`: every step written after the `?.` is skipped, up to a
parenthesis that closes the chain
([optional chaining](../../../spec/property-access/optional-chaining/README.md)).
So `n?.a.b` answers `undefined`, while `(n?.a).b` reads `b` of `undefined`
and throws. The chain is one block in WASM, and the guard is a `br` out of
it. Either way the arguments are evaluated only after the test passes. No L1
operation takes an argument that has not been evaluated yet, so no thunk
crosses the boundary, and the order stays the one
[the runtime README](../../../fjs/js/runtime/README.md) sets: the guard
before the arguments.

The native rows are the whole of what a new runtime must write beyond L0.
Each of them can still get a FunctionalScript body later, for example
`numberToString` as an algorithm such as Ryu, without changing the ABI.

## Linking and substitution

- **Pick:** the FunctionalScript bodies of L1, together with L2, compile
  into one module, the stock runtime. It imports `fjs:l0` and the native
  rows, as `fjs:l1-native`, from the host runtime, and exports `fjs:l1`.
  Substitution happens when our linker builds the stock module for a
  host. For each L1 or L2 name the host exports, the linker drops the
  FunctionalScript body and turns every call to it, inside the stock module
  as well as in programs, into a call to the host's import. A call between
  bodies that stays inside the module is therefore always a call to a body
  the host did not replace.
- **Why:** a native version replaces a body by name, with no change to the
  program or the body. This is DESIGN.md §13's substitution at the module
  boundary. NaNVM starts by exporting only L0 and the native rows, then
  takes over hot operations one at a time.

## Versioning

The list is closed and versioned with L0's scheme: a custom section names
`l1/1`. Adding an operation, or moving one between the FunctionalScript and
native rows, is a new version.

## Where this draft is least sure

- **The closure rule (2).** It depends on the compiler always knowing
  types after `as` casts. If inference is weaker than that, L1 needs more
  casts in its bodies.
- **String compare (4).** A loop over `unit` is correct but slow, and
  strings are compared often. It may be the first native substitution.
- **Errors as strings (6).** If the runtime moves to error objects, every
  L1 throw changes with it.
