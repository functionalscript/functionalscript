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

For the live pair `a`, `b` above, two successive observations can yield `[false, false]`, `[false, true]` or `[true, true]`. A previous false comparison alone leaves a later merge eligible. Live reference maps impose the key constraint below. The boolean already returned stays false. Direct JS selects the fresh outcome for separate allocations, and full content identity selects the shared outcome from the first observation. In this example `structEq(a, b)` is true throughout.

#### Which equality operation should a program use?

**On a non-CAVM, prefer `structEq(a, b)` for comparing contents**, including in tests. `Object.is(a, b)` is a distinct instruction for identity. On a VM that implements object identity by comparing references, this check takes `O(1)`. An executor that discovers identity by comparing content can have a different cost. A true result is a fast path for `structEq`. A false result leaves open whether the contents match. For independently built objects, `structEq` may traverse the full structure and take `O(n)` time, where `n` is the size of the compared data including all descendants. Here `n` counts repeated subtree visits. Two separately built graphs, each formed by repeatedly wrapping a child as `[child, child]`, have only a linear number of stored nodes. At depth `d` a naive comparison of the equal roots reaches the leaf pair `2^d` times. An instruction may memoize completed pairs within a comparison. For this family it need only compare `d + 1` distinct pairs. In general the cost depends on the pairs reached and the child entries examined for each pair.

**On a CAVM, both names denote the same equality instruction for every FJS value.** The CAVM specifies the answer and leaves the time complexity unspecified. An implementation can intern values at creation or establish content identity lazily during comparison.

At any instant, identity is an equivalence relation. Its classes can join and never split. `Object.is` treats `NaN` as equal to itself and distinguishes `0` from `-0`. On every executor a true `Object.is(a, b)` implies `structEq(a, b)`. The converse is guaranteed on a CAVM.

One sequence of permanent merges must explain all observations. With `p = [a]` and `q = [b]`, merging `p` and `q` also makes `a` and `b` one value. In a map holding a single entry under `a`, lookup under `b` may start as a miss and become a hit. Once it has found the entry, it must keep finding it on that map. [Reference map](../built-ins/reference-map/README.md)

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

Maps are callable values with no iteration order. Decide whether canonical content is the unordered set of current key/value bindings or a specified closure representation. With the bindings rule, inserting two distinct keys in opposite orders, or overwriting a key with its current value, yields the same CAVM map. A representation-based rule must define which frame differences count. Equal lookup behavior alone does not settle function identity. [Reference-map API](../built-ins/reference-map/README.md)

**Distinct keys in a live map must stay distinct.** An optional merge is allowed only if it preserves every distinct key in each live persistent map version. If `m` holds both `a → 1` and `b → 2`, the VM must keep `a` and `b` separate while `m` is live, even when the keys have equal content. The same rule applies when their bound values are equal. It also covers merges through an alias or a parent. Merging `[a]` with `[b]` would force the forbidden key merge. Two separate maps that each hold only one of the keys do not by themselves block it. An executor can conservatively skip an optional merge. A VM that folds at construction time already knows which key a later write will update. [Proposed map constraint](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7077021977)

**Import into a CAVM.** Refuse a serialized map if two distinct stored keys would canonicalize to one key in that map. Check the source bindings before deduplication or replay could silently discard an entry. Executing two ordinary writes to an already canonical key is valid. The second updates the first. The loader must distinguish that operation from importing a snapshot that represents two distinct keys. [Refuse what you cannot handle](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)

The single-key case must succeed. Save `empty({}, 7)[1]` alone, reload it on a CAVM, then look up a newly constructed `{}`. The lookup must return `7`. The existing native-map serialization proposal omits keys found nowhere else in the graph and can insert a dummy binding. A CAVM can reconstruct such a key by content, so its import format must preserve that binding. [Map serialization design](../design/object-identity.md#serialization)

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
- [ ] Implement the selective-schedule tests above. Include a false at initialization followed by true on the same live pair, repeat the comparison through a warm cache to catch a stale negative, reject a later split, and cover nested aliases and captures. Retain an older two-key map and check that a direct or induced key merge stays blocked. In a separate fixture, a one-key map may observe a former miss become a hit.
- [ ] Test round trips by format. JSON can unfold graph sharing. DataJS records it. Check ordered content and the sharing each format promises. Load the one-key snapshot successfully and refuse a selective VM's two-key snapshot if CAVM canonicalization would collapse its distinct keys. [DataJS sharing](../datajs/README.md) · [Serialization](../design/serialization.md)
- [ ] Evolve the existing VM in stages. Start with reference identity and ordered `structEq`, allow selective reuse at construction or later permanent merges even after a false comparison, then unify the two instructions when identity is fully determined by content. Code that already asks for ordered content equality keeps using `structEq` throughout. A lazy merge needs no history of negative comparisons. Check proposed identity-class unions against the live-map constraint, preserve established aliases, and make identity-sensitive operations observe the joined class. Evaluate lazy hashing and caching on those terms. [CAVM design](../design/content-addressable-vm.md)

### Related designs

OCaml permits implementation-dependent physical equality for immutable values with a one-way guarantee about structural comparison. Unison gives a precedent for excluding names when hashing definitions. [OCaml physical equality](https://ocaml.org/manual/5.3/api/Stdlib.html#VAL(==)) · [Unison hashes](https://www.unison-lang.org/docs/language-reference/hashes/)

Scheme leaves some procedure and literal identities unspecified. Rust documents that separately declared functions can share an address, and MSVC gives a concrete example in its identical-code folding option. [Scheme §6.1](https://standards.scheme.org/official/r7rs.pdf#page=30) · [Rust function addresses](https://doc.rust-lang.org/std/ptr/fn.fn_addr_eq.html) · [MSVC linker options](https://learn.microsoft.com/en-us/cpp/build/reference/opt-optimizations)

TC39's withdrawn Records and Tuples proposal sorted record keys. Its Composites proposal interns key/value sets per realm and normalizes `-0` to `0`. FJS records expose their enumeration order, and `structEq` distinguishes signed zeros. [Records and Tuples](https://github.com/tc39/proposal-record-tuple) · [Composites](https://github.com/tc39/proposal-composites)
