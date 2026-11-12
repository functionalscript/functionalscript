## Implement Math.log2

**Priority:** P3
**Status:** open — approved for implementation

### Problem

The compiler does not admit `Math.log2`. The
[`bigint`](../../../types/bigint/module.f.mjs) module uses it to finish its
integer logarithm, so that dependency cannot yet compile unchanged.
The shared runtime already provides static-function dispatch, but needs
admission of the `Math` namespace and this name, and a shared implementation
of the numerical operation.

### Proposal

Admit `Math.log2` as a static function with one authored FunctionalScript
body in the [common runtime](../module.f.js). Represented execution,
Rust and the future WASM backend use that body. Keep detached calls and
destructuring compatible with JavaScript, including function identity and
the function's `length` of 1.

**Rule for Math functions:** use native operations when compatible native
equivalents exist in both Rust and WASM. If either backend lacks the
operation, implement it in the common runtime and use that implementation
on both backends. A native, more optimal substitution for a shared body
may be added later; it is not part of the initial implementation.

Other `Math` functions and helpers may be added, but every dependency needs
an implementation on each supported backend, whether authored here or
supplied by the backend's standard facilities. Replacing `Math.log2` with
`Math.log` moves the logarithm implementation work; it does not remove it.
Include the complete dependency chain when comparing approaches.

**WASM constraint:** no third-party dependencies. Do not add or link an
external math library to supply missing operations. The reference sources
below inform the algorithm; they are not proposed WASM dependencies.

### Implementation approach

Rust provides
[`f64::log2`](https://doc.rust-lang.org/std/primitive.f64.html#method.log2),
but core [WASM numeric instructions](https://webassembly.github.io/spec/core/syntax/instructions.html#numeric-instructions)
have no logarithm operation. Therefore `Math.log2` belongs in the common
runtime, and Rust uses the shared body too. `Math.log` has the same missing
WASM support, so using it requires another common-runtime body. Do not
replace the missing WASM operation with a host math import.

Select a shared algorithm using the JavaScript references below: either
base conversion with all supporting operations implemented, or a
standalone kernel. Apply the same native-availability rule to every
supporting `Math` function, and implement any remaining helpers. Integrate
with the planned [WASM runtime layers](../../../../doc/sasha-gil/wasm/README.md).

Avoid circular dependencies during runtime construction: the current
[runtime printer](../../../compiler/rust/runtime/module.f.mjs) refuses reads
of body-defined statics inside the runtime closure, so shared bodies may
need plain helper calls or a deliberate change to that restriction.

### Semantics and accuracy

Apply JavaScript's `ToNumber` once, reusing the runtime's `toNumber` helper
where applicable; `Number(x)` alone is unsuitable because it accepts
BigInt. Preserve conversion failures and the exact special results: `NaN` and negative
numbers give `NaN`, either zero gives `-Infinity`, 1 gives positive zero,
and positive infinity gives itself. Cover omitted arguments, ignored extra
arguments, and conversions of admitted strings, booleans and containers
through each executor.

Choose and document a numerical accuracy target before selecting the final
algorithm. ECMAScript permits an implementation-approximated answer for
ordinary positive inputs; exact agreement with every host engine is not
the general oracle. Require exact special cases and test exact powers of
two, their neighbours, values near 1, subnormals and the largest finite
double. Check general accuracy against higher-precision reference values.
Retain the bigint logarithm's existing boundary proofs when enabling it.

**Benefits.** Familiar JavaScript spelling and removal of a compilation
obstacle for the bigint utilities. One numerical implementation serves
represented execution, Rust and WASM, without third-party WASM dependencies.
Native operations are reused where both backends supply compatible ones;
later substitutions can optimize a shared body without replacing its source
of truth.

**Drawbacks.** Reserving `Math` affects existing bindings with that name.
WASM supplies no logarithm opcode, so we must implement the numerical work
even though Rust has a native function. Rust initially runs the shared
body, deferring any native optimization.
Supporting operations may need their own admissions and implementations.
Base conversion adds rounding error, while a standalone numerical kernel
costs more implementation and validation work. Namespace members remain
separate admissions rather than exposing all of `Math` at once.

### JavaScript references

- [core-js fallback](https://github.com/zloirock/core-js/blob/4f76cb1734a7eeeed9ba0e11bae2ce86b758be3d/packages/core-js/internals/math-log2.js)
  — a compact reference when its supporting functions are implemented.
  Converts once with unary `+`, computes `Math.log(n) / Math.LN2`, rounds
  that estimate to `k`, and returns `k` when `Math.pow(2, k) === n`.
  The correction avoids inexact answers at powers of two; `2 ** k` can
  replace the `Math.pow` call. This is not a promise of bitwise equality
  with native `Math.log2` or a documented global ULP bound.
- [stdlib numerical implementation](https://github.com/stdlib-js/stdlib/blob/c9cacbfe7c80e80d5205c867b49bdeb199a76986/lib/node_modules/%40stdlib/math/base/special/log2/lib/main.js)
  — a FreeBSD/fdlibm-derived JavaScript kernel using argument reduction,
  a polynomial correction and compensated arithmetic, without calling
  `Math.log` or `Math.log2`. Its IEEE word helpers use mutable typed-array
  views, which need adaptation for FunctionalScript. Preserve the
  applicable Apache-2.0 and Sun notices if adapting it. The corresponding
  [OpenLibm C source](https://github.com/JuliaMath/openlibm/blob/master/src/e_log2.c)
  explains the extra-precision combining steps. Revalidate accuracy after
  any port rather than inheriting the source's numerical claims.

### Tasks

- [ ] Select the shared algorithm and accuracy target. Inventory every
      supporting operation: use native equivalents only when both Rust
      and WASM provide them; implement the rest in the common runtime,
      with no third-party WASM dependencies.
- [x] Record formal language-design approval for the admissions in scope,
      with benefits and drawbacks, before implementation.
- [ ] Add the static admission and common-runtime body, including all
      required helpers or native bindings for supporting operations, with
      conversion and numerical proofs and represented-execution/NaNVM
      fixtures. Verify Rust uses the shared logarithm body.
- [ ] Regenerate EDAG and Rust outputs and run the scoped checks required
      by the implementation; verify the bigint logarithm's boundaries.
- [ ] Update built-in documentation and enable affected modules that then
      compile; delete this TODO when complete.

### Approval

**sergey-shandar** explicitly requested the TODO PR followed by a stacked
implementation PR in the [working session](https://chatgpt.com/c/6af4b740-b0c0-8191-8471-4aa5a50fa03a).
The request also permits supporting `Math` functions where needed, under
the same native-availability rule above. WASM must have no third-party
dependencies, and Rust must initially use any common-runtime body too.

### Related

- [ECMAScript Math.log2](https://tc39.es/ecma262/#sec-math.log2)
  — conversion, exact special cases and approximation semantics.
- [Static-function design](../../todo/runtime-static.md) — admission and
  shared dispatch.
- [Built-in admission record](../../../../spec/todo/2360-built-in.md#number-and-math)
  — the existing `Math` entry and approval records for other statics.
