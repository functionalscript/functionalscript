## Allow equal-content allocations to share identity

**Priority:** P2 — language-design decision
**Status:** open — pending design approval

### Problem

Can the compiler evaluate `make(1)` once here?

```js
const make = x => ({ x })
const a = make(1)
const b = make(1)
```

Today a JS-compatible executor must make two objects because the program can later ask `Object.is(a, b)`. Relaxing that rule permits common-subexpression elimination, hoisting and memoizing functions that return objects. It also lets an ordinary VM evolve into a content-addressable VM (CAVM). The cost is observable even in a program that returns just a boolean. [Execution models](../../fjs/edag/execution-models.md)

### Proposed exception to JavaScript agreement

For **every FJS executor**, amend rule 2 of the [language principles](../principles/README.md) for identity-dependent observations. Keeping all other inputs and semantics fixed, the JavaScript result is *one permitted FJS result*. JavaScript creates fresh identities for independent constructions. A non-CAVM can selectively reuse an identity for equal content. The CAVM guarantees one identity for equal content under a fixed semantics version. Outside the consequences of this choice, existing compatibility rules and the separately specified function-text exception still apply.

| Observation in the example | Direct JS | Non-CAVM | CAVM |
| --- | --- | --- | --- |
| `Object.is(a, a)` | `true` | `true` | `true` |
| `Object.is(a, make(2))` | `false` | `false` | `false` |
| `Object.is(a, b)` | `false` | Either boolean | `true` |

**Identity uses `Object.is` on every FJS value.** This is a stable equivalence relation (reflexive, symmetric and transitive). It treats `NaN` as equal to itself and distinguishes `0` from `-0`. The implications below hold for all admitted values `a` and `b`.

- On every executor, `Object.is(a, b)` implies `structEq(a, b)`.
- On a CAVM, `Object.is(a, b)` if and only if `structEq(a, b)`.

**One choice must account for the whole execution.** Every use of a shared reference observes the same value, including its children. With `p = [a]` and `q = [b]`, choosing `Object.is(p, q)` requires `Object.is(a, b)`. From an empty reference map, storing an entry under `a` makes it retrievable under `b` exactly when `Object.is(a, b)`. [Reference map](../built-ins/reference-map/README.md)

For reference operands, the same choice reaches `===`, `!==`, reference-map reads and updates, array `indexOf` and `includes`, `switch`, and downstream data, branches and failures. With the same live `a` and `b`, a comparison during module initialization and one in an exported function must agree. Two calls to `() => Object.is(make(1), make(1))` each construct a new pair and may yield different booleans even within one non-CAVM run. This is why comparing final outputs to Node alone cannot validate every such program. [Module evaluation](../../fjs/edag/memo/README.md) · [Switch](../control-flow/switch/README.md)

### Ordered structural equality and its pattern instruction

Define `structEq(a, b)` once as an executable FJS **library function**. Its **pattern instruction** is a separately deliverable optimization. Recognize the complete parsed definition with resolved dependencies and bindings. Direct JavaScript executes the function, and a backend may substitute an equivalent instruction. The ordered helper can ship first. [Pattern recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)

| Operands | Comparison |
| --- | --- |
| Primitives | Use `Object.is`, including equal `NaN` values and distinct signed zeros. |
| Arrays | Compare lengths and corresponding elements recursively in index order. |
| Records | Compare own enumerable string keys in `Object.entries` order, then the corresponding values recursively. A present `undefined` counts as an entry. |
| Functions | Use `Object.is(a, b)` on the two function references, including inside a container. |

Different kinds compare unequal. The same ordered, function-free data gives the same answer on every VM regardless of sharing. With function leaves, an answer may depend on permitted closure folding. Reversing ordinary string keys changes the answer. Array-index keys enumerate first. `{ b: 1, "2": 0 }` and `{ "2": 0, b: 1 }` both enumerate `["2", "b"]`. The existing `structurallySame` intentionally compares record keys as an unordered set. Audit its callers and retain it temporarily or rename it for those that need unordered comparison. [Objects](../values/objects/README.md) · [Existing helper](../../fjs/types/object/structurally_same/README.md)

### What is the canonical content of a closure?

Closure folding is a language decision of its own. It would reverse the approved rule that two separately written instances of the recognized `empty` helper have distinct identities even after compilation. The proposed eligibility test uses canonical code, signature (including the observable `length`) and the corresponding captured values. A JS-inferred function name is a spelling and contributes no content. Rendering a function as text is a separate observation. [Approved object-identity decision](../design/object-identity.md#decisions) · [Function names and identity](../functions/names-and-identity/README.md) · [Function-text design questions](./cavm-function-to-string.md#what-must-default-function-text-guarantee)

Define canonical code per semantics version, before discretionary optimizer rewrites. Today's EDAG uses the name-erased graph with specified lowerings. A minimal candidate compares operator tags, binding and frame slot references, signature, and the graph's specified sharing. A consistent renaming makes `x => x` and `y => y` the same code. Should canonicalization also fold `() => 1 + 2` to `() => 3`, substitute a captured constant into the body, or normalize additional graph sharing? Specify each admitted rewrite and its expected equality result for the version. Backends may emit the same machine code for two functions while preserving their distinct language identities. [Current EDAG representation](../../fjs/edag/README.md)

Given `const wrap = x => () => x`, two calls to `wrap(1)` may coalesce and a CAVM must give them one identity. `wrap(1)` and `wrap(2)` remain distinct. If the captured values are references `a` and `b`, folding `wrap(a)` with `wrap(b)` must preserve what calls return. Their common result would have to alias both `a` and `b`. A non-CAVM that keeps those captures distinct must also keep those closures distinct.

### What is the canonical content of a reference map?

Maps are callable values with no iteration order. Decide whether canonical content is the unordered set of current key/value bindings or a specified closure representation. With the bindings rule, inserting two distinct keys in opposite orders, or overwriting a key with its current value, yields the same CAVM map. A representation-based rule must define which frame differences count. Equal lookup behavior alone does not settle function identity. [Reference-map API](../built-ins/reference-map/README.md)

The proposed native-map serialization can omit a key found nowhere else in the graph, on the assumption that the caller cannot produce it again. Test saving `empty({}, 7)[1]` alone. After a CAVM reloads it, lookup under a newly constructed `{}` must still find `7`. Dropping the entry or substituting a dummy key/value can change that observation. [Map serialization design](../design/object-identity.md#serialization)

### Tasks

- [ ] **Allocation identity (language decision).** Record the designer's decision on the rule 2 exception. If approved, reconcile the principles, execution models and reference-map contract. [Compatibility tracker](../../todo/fjs-javascript-compatibility.md)
- [ ] **Closure folding (language decision).** Decide the versioned canonical code/frame rules and reference-map content. Record which prior identity decisions this supersedes and publish pairs that must and must not merge.
- [ ] **Library change.** Implement the ordered helper and migrate content assertions. Include reordered keys, shared children, missing entries, signed zeros and function leaves.
- [ ] **Backend optimization.** Recognize the helper as a pattern instruction after its semantics are tested. Compare the instruction with the executable definition under the same identity choices. On a CAVM the entire instruction can lower to `Object.is(a, b)` for every admitted input, including `NaN` and signed zero. On a non-CAVM, a true `Object.is(a, b)` can short-circuit the ordered comparison.
- [ ] Run identity-sensitive tests under fresh, selective and full-content policies. Check admissible whole results, transitivity, child and captured aliases, repeated live comparisons, fresh pairs, map lookups and exported calls. Compare identity-independent outputs directly with JavaScript under the same function-text assumptions.
- [ ] Test round trips by format. JSON can unfold graph sharing. DataJS records it. Check the ordered content, the sharing each format promises and reconstruction of map keys. Evaluate lazy hashing and reuse of cached computations subject to observed identities. [DataJS sharing](../datajs/README.md) · [Serialization](../design/serialization.md) · [CAVM design](../design/content-addressable-vm.md)

### Related designs

OCaml permits implementation-dependent physical equality for immutable values with a one-way guarantee about structural comparison. Unison gives a precedent for excluding names when hashing definitions. [OCaml physical equality](https://ocaml.org/manual/5.3/api/Stdlib.html) · [Unison hashes](https://www.unison-lang.org/docs/language-reference/hashes/)

Scheme leaves some procedure and literal identities unspecified. Rust documents that separately declared functions can share an address, and MSVC gives a concrete example in its identical-code folding option. [Scheme §6.1](https://standards.scheme.org/official/r7rs.pdf#page=30) · [Rust function addresses](https://doc.rust-lang.org/std/ptr/fn.fn_addr_eq.html) · [MSVC linker options](https://learn.microsoft.com/en-us/cpp/build/reference/opt-optimizations)

TC39's withdrawn Records and Tuples proposal sorted record keys. Its Composites proposal uses per-realm interning and ordinary object identity for composite values. FJS already exposes enumeration order for ordinary records. [Records and Tuples](https://github.com/tc39/proposal-record-tuple) · [Composites](https://github.com/tc39/proposal-composites)
