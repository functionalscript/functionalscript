## Permit permanent identity merging on the path to a CAVM

**Priority:** P2 — language-design decision
**Status:** open — awaiting explicit language-design approval

### Problem

The goal is to evolve the existing VM into a content-addressable VM (CAVM) under one language contract. Programs can ask for content equality from the start. The VM can introduce sharing incrementally. For example, can the compiler evaluate `make(1)` once here?

```js
const make = x => ({ x })
const a = make(1)
const b = make(1)
```

Today a JS-compatible executor must make two objects because the program can later ask `Object.is(a, b)`. Relaxing that rule permits common-subexpression elimination, hoisting and memoizing functions that return objects. The cost is observable even in a program that returns just a boolean. [Execution models](../../fjs/edag/execution-models.md)

### Proposed exception to JavaScript agreement

For **every FJS executor**, propose this exception to rule 2 of the [language principles](../principles/README.md). With other inputs and semantics fixed, JavaScript's fresh allocations give one permitted identity-dependent outcome. A non-CAVM may merge equal content selectively. A CAVM always gives equal content one identity under a fixed semantics version. Existing compatibility requirements continue to govern other observations, including the separate function-text exception.

The review records [four proposed rules for `Object.is`](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7076917938). They apply to logical values, however the VM represents them. Formal approval of the allocation-identity change by `sergey-shandar` is pending. [Language-design approval process](../../doc/DESIGN.md#new-language-features-start-with-a-todo)

1. **Same value.** `Object.is(a, a)` is always true, including through two aliases.
2. **Equal content built separately.** For independently constructed objects or functions of equal content, `Object.is(a, b)` may be false or true.
3. **Different content.** `Object.is(a, b)` is always false.
4. **Merging is permanent.** Once `Object.is(a, b)` is true, the two are one value and stay one value for their lifetime.

For the live pair `a`, `b` above, two successive observations can yield `[false, false]`, `[false, true]` or `[true, true]`. A previous false comparison leaves a later merge eligible, even if both objects are keys in the same reference map. The boolean already returned stays false. Direct JS selects the fresh outcome for separate allocations, and full content identity selects the shared outcome from the first observation. In this example `structEq(a, b)` is true throughout.

#### Which equality operation should a program use?

**On a non-CAVM, prefer `structEq(a, b)` for comparing contents**, including in tests. Use `Object.is(a, b)` when the program needs identity. A true result lets `structEq` return immediately. After a false result, the contents may still match.

On a VM that compares object references, `Object.is` takes `O(1)`. An executor that discovers identity by comparing content can have a different cost. Comparing independently built structures with `structEq` can take `O(n)` time, where `n` counts all descendant visits, including repeated visits to a shared subtree.

For example, build two separate graphs by starting with a leaf and wrapping each child as `[child, child]` for `d` levels. A naive comparison reaches the leaf pair `2^d` times. Memoizing completed pairs reduces this example to `d + 1` distinct pair comparisons. In general the work depends on the pairs reached and the child entries examined for each pair.

**On a CAVM, both names denote the same equality instruction for every FJS value.** The CAVM specifies the answer and leaves the time complexity unspecified. An implementation can intern values at creation or establish content identity lazily during comparison.

At any instant, identity is an equivalence relation. Its classes can join and never split. `Object.is` treats `NaN` as equal to itself and distinguishes `0` from `-0`. On every executor a true `Object.is(a, b)` implies `structEq(a, b)`. The converse is guaranteed on a CAVM.

One sequence of permanent merges must explain all observations. With `p = [a]` and `q = [b]`, merging `p` and `q` also makes `a` and `b` one value. The [reference-map example below](#what-is-the-canonical-content-of-a-reference-map) shows how a key merge affects earlier and later versions of the same map.

For reference operands, the same choice reaches `===`, `!==`, reference-map reads and updates, array `indexOf` and `includes`, `switch`, and downstream data, branches and failures. If module initialization observes true, an exported function comparing the same live pair must also observe true. An initial false may later become true. Calls that construct fresh pairs can also yield different booleans. [Module evaluation](../../fjs/edag/memo/README.md) · [Switch](../control-flow/switch/README.md)

**Purity.** The language's no-side-effects principle applies. FJS code gains no operation to mutate a value, schedule a merge or perform I/O. A program can observe a merge through identity, so effect freedom no longer implies repeatability of an identity-sensitive expression. In particular a VM may retain the boolean returned earlier, but a new comparison after a known merge must observe that permanent identity. [Language principles](../principles/README.md)

### Ordered structural equality and its pattern instruction

Define `structEq(a, b)` once as an executable FJS **library function**. Its **pattern instruction** is a separately deliverable optimization. Recognize the complete parsed definition with resolved dependencies and bindings. Direct JavaScript executes the function, and a backend may substitute an equivalent instruction. The ordered helper can ship first. [Pattern recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)

| Operands | Comparison |
| --- | --- |
| Primitives | Use `Object.is`, including equal `NaN` values and distinct signed zeros. |
| Arrays | Compare lengths and corresponding elements recursively in index order. |
| Records | Compare own enumerable string keys in `Object.entries` order, then the corresponding values recursively. A present `undefined` counts as an entry. |
| Functions | Use `Object.is(a, b)` on the two function references, including inside a container. |

Different kinds compare unequal. The same ordered, function-free data gives the same answer on every VM regardless of sharing. For containers with function leaves, even a structural comparison of the same operands may change from false to true if the corresponding closures merge. Reversing ordinary string keys changes the answer. Array-index keys enumerate first. `{ b: 1, "2": 0 }` and `{ "2": 0, b: 1 }` both enumerate `["2", "b"]`. The existing `structurallySame` intentionally compares record keys as an unordered set. Audit its callers and retain it temporarily or rename it for those that need unordered comparison. [Objects](../values/objects/README.md) · [Existing helper](../../fjs/types/object/structurally_same/README.md)

### What is the canonical content of a closure?

Closure folding is a language decision of its own. It would reverse the approved rule that two separately written instances of the recognized `empty` helper have distinct identities even after compilation. The proposed eligibility test uses canonical code, signature (including the observable `length`) and the corresponding captured values. A JS-inferred function name is a spelling and contributes no content. Rendering a function as text is a separate observation. [Approved object-identity decision](../design/object-identity.md#decisions) · [Function names and identity](../functions/names-and-identity/README.md) · [Function-text design questions](./cavm-function-to-string.md#what-must-default-function-text-guarantee)

Define canonical code per semantics version, before discretionary optimizer rewrites. Today's EDAG uses the name-erased graph with specified lowerings. A minimal candidate compares operator tags, binding and frame slot references, signature, and the graph's specified sharing. A consistent renaming makes `x => x` and `y => y` the same code. Should canonicalization also fold `() => 1 + 2` to `() => 3`, substitute a captured constant into the body, or normalize additional graph sharing? Specify each admitted rewrite and its expected equality result for the version. Backends may emit the same machine code for two functions while preserving their distinct language identities. [Current EDAG representation](../../fjs/edag/README.md)

Given `const wrap = x => () => x`, two calls to `wrap(1)` may coalesce and a CAVM must give them one identity. `wrap(1)` and `wrap(2)` remain distinct. If the captured values are references `a` and `b`, folding `wrap(a)` with `wrap(b)` must preserve what calls return. Their common result would have to alias both `a` and `b`. While `a` and `b` are distinct, their closures must also be distinct. A later merge of the closures requires their captures to have merged by then.

### What is the canonical content of a reference map?

For lookup, treat each persistent map version as a list of writes with object or function keys. Search newest first and take the value of the first key for which `Object.is(storedKey, key)` is true, or `undefined` on a miss. A read `m(key)` returns that value and the same map. A write `m(key, value)` returns the previous value and a new version with the write prepended. Passing `undefined` as the value is a read. The EDAG list implementation uses `===`, which agrees with `Object.is` for its object and function keys. [Reference-map API](../built-ins/reference-map/README.md) · [EDAG implementation](../../fjs/js/ref_map/module.f.js) · [Designer's lookup rule](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7077249934)

Suppose `a` and `b` have equal content and are still distinct at all three writes. After they merge, look up either key in each saved version.

| Map version | Write | Previous value returned at the write | Lookup after the merge |
| --- | --- | --- | --- |
| `m1`, from `empty` | `a → 1` | `undefined` | `1` |
| `m2`, from `m1` | `b → 2` | `undefined` | `2` |
| `m3`, from `m2` | `a → 3` | `1` | `3` |

Merging the keys before the writes gives the same later lookups in each version. Values returned by earlier calls reflect the identities at the time of each call. A VM may merge keys held in the same version, directly or through a parent, or keep them distinct.

The EDAG interpreters scan up to all the writes in a version. Production VMs must answer each map call in `O(log n)`, including calls on older versions, where `n` counts distinct keys set since `empty`. A VM that indexes keys by address and merges them later must still find the newest matching write in the queried version within that bound. Direct JavaScript and VMs that establish identity at construction never have to reconcile two entries after a key merge. [Executor bounds and implementations](../built-ins/reference-map/README.md#executors)

**Import into a CAVM.** Replay ordered writes oldest first with canonical keys. If several stored keys become one, the newest write wins in that version. To reproduce lookups, a compact snapshot can keep the last write for each source key if it preserves their relative write order. In `m3`, first-insertion order would incorrectly make `b → 2` the winner. Refuse an order-losing format only when the missing precedence makes the result ambiguous. For example, the unordered bindings of `m2` alone cannot say whether `1` or `2` wins. [Refuse what you cannot handle](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)

The single-key case must succeed. Save `empty({}, 7)[1]` alone, reload it on a CAVM, then look up a newly constructed `{}`. The lookup must return `7`. The existing native-map serialization proposal can omit a key found nowhere else in the graph or insert a dummy binding. A CAVM can reconstruct the lookup key by content, so its import format must preserve the binding. [Map serialization design](../design/object-identity.md#serialization)

**The map's own CAVM identity is open.** One candidate uses the unordered set of current canonical key/value bindings. Under that rule, writing `a → 1` then `a → 2` gives the same map as writing only `a → 2`. A closure-based definition would have to say which frame differences count. On a VM that can still merge keys, two maps with the same current bindings can be distinguished later. If one wrote `a → 1` last and the other wrote `b → 2` last, merging the keys makes the two maps answer differently.

### Testing identity-dependent results

Use direct JavaScript as an exact oracle where the expected observation is invariant under **every** permitted merge schedule, with the same inputs and function-text assumptions. Justify that property for the case (for example, a traversal of ordered, function-free data that compares only primitive leaves). Agreement at the two extremes cannot prove it.

```js
const a = make(1)
const b = make(1)
const c = make(2)
const d = make(2)
const agree = () => Object.is(Object.is(a, b), Object.is(c, d))
```

The two content classes can merge independently. The fresh and fully shared policies both make `agree()` true. Merging only one pair makes it false. For this fixture enumerate all four choices and, across two checkpoints, all nine combinations of per-pair histories (stays false, becomes true, starts true). For larger cases, try adversarial schedules and seeded random merges between eligible pairs, recording the seed for replay. Each merge must respect transitivity and child/capture aliases. A sampled run can disprove independence. Certifying it requires an argument covering all permitted schedules. [Execution models](../../fjs/edag/execution-models.md)

### Tasks

- [ ] **Allocation identity (language decision).** Record the language designer's explicit approval and link it here before implementing the allocation-identity exception. Check fresh allocation, selective sharing (including global memoization) and full content identity against the rules. Exclude Amnesia from VM conformance tests. Its proof evaluator can recompute a shared array as two allocations and return false for the same logical value. [Amnesia's shared-node example](../../fjs/edag/amnesia/README.md#recomputed-code-retained-values) · [Compatibility tracker](../../todo/fjs-javascript-compatibility.md)
- [ ] **Closure folding (language decision).** Decide the versioned canonical code/frame rules and reference-map content. Record which prior identity decisions this supersedes and publish pairs that must and must not merge.
- [ ] **Library change.** Implement the ordered helper and migrate content assertions. Include reordered keys, shared children, missing entries, signed zeros and function leaves.
- [ ] **Backend optimization.** Recognize the helper as a pattern instruction after its semantics are tested. Compare the instruction with the executable definition under the same identity choices. Verify the constant-time identity fast path on a reference-comparing VM and the shared equality operation on a CAVM.
- [ ] Implement the selective-schedule tests above. Include a false at initialization followed by true on the same live pair, repeat the comparison through a warm cache to catch a stale negative, reject a later split, and cover nested aliases and captures. Run the three-version map example with a direct key merge and with a merge induced through `[a]` and `[b]`. Check both keys in every saved version. Reverse the first two writes and verify that the two-write version now returns `1` for both keys.
- [ ] Test round trips by format. JSON can unfold graph sharing. DataJS records it. Check ordered content and the sharing each format promises. Import the one-key snapshot and the ordered snapshots of all three map versions into a CAVM. Check the winner under both write orders, including the final overwrite. Accept unordered bindings when the result is unambiguous and reject the two different competing bindings when their precedence is lost. [DataJS sharing](../datajs/README.md) · [Serialization](../design/serialization.md)
- [ ] Evolve the existing VM in stages. Start with reference identity and ordered `structEq`, allow selective reuse at construction or later permanent merges even after a false comparison, then unify the two instructions when identity is fully determined by content. Code that already asks for ordered content equality keeps using `structEq` throughout. A lazy merge needs no history of negative comparisons. Preserve established aliases and make identity-sensitive operations observe the joined class. Verify that an address-indexed map can recover the newest binding in each version within the map-call bound before enabling late key merges there. Evaluate lazy hashing and caching on those terms. [CAVM design](../design/content-addressable-vm.md)

### Related designs

OCaml permits implementation-dependent physical equality for immutable values with a one-way guarantee about structural comparison. Unison gives a precedent for excluding names when hashing definitions. [OCaml physical equality](https://ocaml.org/manual/5.3/api/Stdlib.html#VAL(==)) · [Unison hashes](https://www.unison-lang.org/docs/language-reference/hashes/)

Scheme leaves some procedure and literal identities unspecified. Rust documents that separately declared functions can share an address, and MSVC gives a concrete example in its identical-code folding option. [Scheme §6.1](https://standards.scheme.org/official/r7rs.pdf#page=30) · [Rust function addresses](https://doc.rust-lang.org/std/ptr/fn.fn_addr_eq.html) · [MSVC linker options](https://learn.microsoft.com/en-us/cpp/build/reference/opt-optimizations)

TC39's withdrawn Records and Tuples proposal sorted record keys. Its Composites proposal interns key/value sets per realm and normalizes `-0` to `0`. FJS records expose their enumeration order, and `structEq` distinguishes signed zeros. [Records and Tuples](https://github.com/tc39/proposal-record-tuple) · [Composites](https://github.com/tc39/proposal-composites)
