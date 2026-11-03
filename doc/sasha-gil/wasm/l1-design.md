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
32-bit integer operators and bigint arithmetic. Every runtime implements
those, and any other operation it wants to make faster.

## Design choices

### 1. L1 bodies are FunctionalScript over typed values

- **Pick:** an L1 body is an ordinary FunctionalScript function in a new
  module, proposed as `fjs/js/l1`. It reads values through the L0 view and
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

- **Pick:** inside `fjs/js/l1`, the compiler refuses any operator it
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
  the same tables are the conformance test for every native substitution.

### 4. Typed lowering is the compiler's, not L1's

The compiler emits a WASM instruction where it knows both operand types.
L1 is called only where it does not.

| Operands | Lowering |
| --- | --- |
| Two numbers: `+ - * /`, `< <= > >=`, `=== !==` | `f64.add` and its siblings |
| Two booleans, or `!` of a boolean | `i32` instructions |
| Two strings, `+` | L0 `concat` |
| Two strings, `===` and `<` | L1 string compare: a loop over `unit` in FunctionalScript |
| Anything else | The L1 operation |

### 5. One calling convention for every L1 operation

- **Pick:** each operation is a WASM function from `any` values to
  `(i32 status, any)`, the shape of [`call`](./l0-design.md#13-errors-an-i32-status-and-an-any).
  The arguments are borrowed and the result is owned, as in L0.
- **Alternative:** a narrower type for an operation that cannot throw, such
  as `typeof`. That can come later as a specialised version.
- **Why:** a top-level FunctionalScript function compiles to exactly this
  shape. The L1 module is then one compiler output, not hand-written WASM.

### 6. Errors are FunctionalScript throws

- **Pick:** an L1 body throws, as the runtime does today, for example
  `throw 'TypeError: not a function'`. The throw becomes status 1.
- **Why:** there is nothing new to design. Whether the thrown value should
  be an error object, rather than a string, is a separate question for the
  whole runtime.

## The operations

| Group | Operations | First body |
| --- | --- | --- |
| Type tests | `typeof`, `instanceof` | FunctionalScript |
| Coercions | `toBoolean`, `toPrimitive`, `toPropertyKey`, `toString` of everything except numbers and bigints, `toNumber` of everything except strings, `toNumeric` | FunctionalScript |
| Arithmetic | `+ - * /` and unary `-`, number and string | FunctionalScript |
| Comparison | `=== !==`, `< <= > >=` of numbers and strings | FunctionalScript |
| Member read | `a[k]` and `a.k`: an object's own key through `find`, an array index, a string index, `length` | FunctionalScript |
| Calls | `call` of an unknown value, `callMember`, the optional forms `?.` and `?.()` | FunctionalScript, `callMember` through L2's `runtime.dot` |
| Iteration | spread of an array or a string, `Object.entries`-style iteration, object spread | FunctionalScript |
| Numbers, native | `%`, `**`, `numberToString`, `stringToNumber` | Native |
| Integers, native | `& \| ^ ~ << >> >>>` and `ToInt32` | Native |
| Bigints, native | every operation on a bigint, and the mixed comparisons | Native |

The native rows are the whole of what a new runtime must write beyond L0.
Each of them can still get a FunctionalScript body later, for example
`numberToString` as an algorithm such as Ryu, without changing the ABI.

## Linking and substitution

- **Pick:** the FunctionalScript bodies of L1, together with L2, compile
  into one module, the stock runtime. It imports `fjs:l0` and the native
  rows, as `fjs:l1-native`, from the host runtime, and exports `fjs:l1`.
  When the loader links a program, each `fjs:l1` import goes to the host
  runtime if the host exports that name, and to the stock module
  otherwise.
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
