## Allow equal-content allocations to share identity

**Priority:** P3
**Status:** open — proposed language change, pending design approval

### Problem

Today a JS-compatible FJS executor preserves the identity of each allocation. The content-addressable VM (CAVM) design gives equal content one identity. Can an ordinary VM evolve into a CAVM under one FJS contract? The proposal admits fresh allocation, selective reuse and full content identity. Programs that observe fresh identity would give up cross-executor agreement. [Execution models](../../fjs/edag/execution-models.md)

### Proposal

**Permit identity reuse.** Two evaluations that construct immutable objects with the same observable content may return the same object. An existing alias stays an alias. Each execution must behave as if it made one consistent choice about sharing, including across module initialization, optimization and later calls.

```js
const make = x => ({ x })
const a = make(1)
const b = make(1)
```

| Observation | Proposed result |
| --- | --- |
| `a === a` | `true` |
| `a === make(2)` | `false` |
| `a === b` | Either boolean. Direct JS gives `false`. Full content identity gives `true`. |
| `[a === b, Object.is(a, b)]` | Both elements agree. |
| Set a reference-map entry under `a`, then read under `b` | The lookup finds that entry exactly when `a === b`, starting from an empty map. |

This permits sharing across calls and common-subexpression elimination. Lazy branches must still skip undemanded computations. An executor can use pointers, compare contents directly, or compute and cache hashes on demand. Computing a hash later must preserve earlier identity decisions. Stable external addresses and a canonical encoding are further CAVM design work. [Reference map](../built-ins/reference-map/README.md) · [CAVM design](../design/content-addressable-vm.md)

**Recognize deep structural equality as a pattern instruction.** Use the existing `structurallySame` function as the executable definition of the proposed `structEq` operation. Recognize its complete parsed definition with bindings and dependencies resolved, as for other helper patterns. Direct JS executes the function. An FJS backend can substitute an equivalent instruction. The API spelling is a separate, small decision. [Helper](../../fjs/types/object/structurally_same/module.f.js) · [Pattern recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)

Use this predicate in tests of immutable data. For `const x = [1]`, `[x, x]` compares structurally equal to `[[1], [1]]` under every sharing policy. Preserve the helper's numeric and property rules, including `NaN` equal to itself, distinct signed zeros and the difference between a missing property and one present with value `undefined`. Keep identity assertions where sharing itself is the contract. [Comparator and assertion semantics](../../fjs/types/object/structurally_same/README.md)

**Keep the existing function-text exception explicit.** FJS VMs may render a function from its EDAG. Its text can differ from the authored source and feed a comparison, property key or branch. ECMAScript requires the stored source text for an ordinary function when the host makes it available. For callables without available source, the native-function spelling is implementation-defined and can vary between engines. FJS's rendering is a deliberate exception even when JS engines agree. These two differences from JavaScript concern observable values. Neither introduces mutation or I/O. [FJS principles](../principles/README.md) · [Function text](../../fjs/edag/function-text.md) · [ECMA-262](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-function.prototype.tostring)

### Design questions and counterexamples

- **Which values may merge?** The helper compares record keys as a set. It accepts `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }`. `Object.entries` distinguishes them. An order-sensitive CA hash can therefore differ even when `structEq` returns `true`. Reusing one as the other would change a program that never tests identity. Preserve observable key order and values, including signed zero. Preserve nested references too. Given `p = [a]` and `q = [b]`, choosing `p === q` requires `a === b`, since each element still aliases its input. [Objects](../values/objects/README.md)
- **What about closures?** The data helper compares function leaves by their existing identity. Ordinary JS cannot inspect a closure's captured frame. Under `const make = x => () => x`, `make(1)` and `make(2)` can have identical text and return different values. Start portable structural tests with function-free data. Before merging functions, specify normalized code, captures, arity and consistent observable text for a shared function. The separate hash-based rendering proposal is still open. [CAVM function text](./cavm-function-to-string.md)
- **What stays deterministic?** If code branches on `a === b`, its returned data or whether it throws can vary across permitted executions. Using `structEq` on the final result cannot repair that. Until identity choices are fixed or irrelevant for a computation, a cached result from one executor needs evidence that the receiving execution can reuse it consistently. Module initialization and later calls must agree on identities already observed. [Compiler module evaluation](../../fjs/edag/memo/README.md)

### Tasks

- [ ] Decide the identity exception and its scope, and record the language designer's decision here. If accepted, reconcile the language principles, JS-compatibility tracker, EDAG execution models, serialization rules and reference-map contract. Preserve the existing guarantee for aliases, including in any evaluator offered as conforming. [Compatibility tracker](../../todo/fjs-javascript-compatibility.md)
- [ ] Recognize the structural-equality helper. Run the ordinary JS function and the instruction on the same data corpus, including independently built values, shared children, reordered keys, signed zero and missing properties.
- [ ] Audit tests that require independently created equal values to compare unequal. Convert content assertions and retain identity-specific tests for stable, transitive comparisons, nested aliases and map lookups. Exercise fresh and coalescing implementations, including a comparison made during module initialization and repeated at runtime.
- [ ] Evaluate lazy content comparison and hashing in the existing VM. Measure repeated equal values and unique short-lived values before choosing when to intern. Full canonical identity is the eventual CAVM guarantee.
