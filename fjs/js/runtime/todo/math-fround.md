## Implement Math.fround in the common runtime

**Priority:** P2
**Status:** wip

### Problem

The WAT formatter needs `Math.fround` to find a decimal spelling that rounds
back to its binary32 value. The compiler currently refuses this static function.

### Proposal

Admit `Math.fround` with one FunctionalScript implementation in the common
runtime. Convert its first argument with JavaScript `ToNumber`, then round
to binary32 precision with nearest, ties-to-even rounding. Return an ordinary
FJS number, preserving signed zero, subnormals, infinities and NaN. Missing
arguments produce NaN; bigint inputs and failed conversions throw. Extra
arguments are evaluated but not converted.

All backends use that same authored body. Do not add a native fround binding,
Rust float cast, WASM demote/promote substitution or pattern instruction in
this change. This is an explicit exception to the general Math admission
preference for native operations when both Rust and core WASM provide them.
Keep ordinary static-function reads, destructuring, identity, length and
function text consistent with the existing admitted functions.

**Benefits:** familiar JavaScript spelling, one numerical implementation and
one set of semantics across languages, without a new FJS numeric type.

**Drawbacks:** the arithmetic body does more work than a native conversion;
admission touches static-function metadata and generated runtime artifacts.
Native pattern substitutions can be considered separately after measurement.

### Language-design approval

**sergey-shandar** clarified that common runtime means "the same FJS
implementation for all languages", then requested "Do it in the next PR"
after the shared implementation was distinguished from native bindings in
the [working session](https://chatgpt.com/local/6af76317-5c08-8191-b451-685c94478033).
This request approves the shared-body approach above.

### Tasks

- [ ] Implement the common body and admit the static without adding a native.
- [ ] Prove rounding boundaries, special values, argument conversion and
      static-function behavior through the runtime and compiler backends.
- [ ] Regenerate runtime artifacts and validate the WAT consumer; rename it
      if the whole module is now accepted by the compiler.
- [ ] Record the admission and its shared-body exception in the lasting docs.
