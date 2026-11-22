## Permit permanent identity merging on the path to a CAVM

**Priority:** P2 — language-design decision
**Status:** open — four identity rules recorded in review, with closure and map content still open

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

The designer's [four rules for `Object.is`](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7076917938) apply to logical values, however the VM represents them.

1. **Same value.** `Object.is(a, a)` is always true, including through two aliases.
2. **Equal content built separately.** For independently constructed objects or functions of equal content, `Object.is(a, b)` may be false or true.
3. **Different content.** `Object.is(a, b)` is always false.
4. **Merging is permanent.** Once `Object.is(a, b)` is true, the two are one value and stay one value for their lifetime.

For the live pair `a`, `b` above, two successive observations can yield `[false, false]`, `[false, true]` or `[true, true]`. A previous false places no constraint on a later merge. The boolean already returned stays false. Direct JS selects the fresh outcome for separate allocations, and full content identity selects the shared outcome from the first observation. In this example `structEq(a, b)` is true throughout.

#### Which equality operation should a program use?

**On a non-CAVM, prefer `structEq(a, b)` for comparing contents**, including in tests. `Object.is(a, b)` is a distinct instruction for identity. On object references it runs in `O(1)`. A true result is a fast path for `structEq`. A false result leaves open whether the contents match. For independently built objects, `structEq` may traverse the full structure and take `O(n)` time, where `n` is the size of the compared data including all descendants. Here `n` counts repeated subtree visits. Two separately built graphs, each formed by repeatedly wrapping a child as `[child, child]`, have only a linear number of stored nodes. At depth `d` a naive comparison of the equal roots reaches the leaf pair `2^d` times. An instruction may memoize completed pairs within a comparison. For this family it need only compare `d + 1` distinct pairs. In general the cost depends on the pairs reached and the child entries examined for each pair.

**On a CAVM, both names denote the same equality instruction for every FJS value.** The CAVM specifies the answer and leaves the time complexity unspecified. An implementation can intern values at creation or establish content identity lazily during comparison.

At any instant, identity is an equivalence relation. Its classes can join and never split. `Object.is` treats `NaN` as equal to itself and distinguishes `0` from `-0`. On every executor a true `Object.is(a, b)` implies `structEq(a, b)`. The converse is guaranteed on a CAVM.

One sequence of permanent merges must explain all observations. With `p = [a]` and `q = [b]`, merging `p` and `q` also makes `a` and `b` one value. In a map holding a single entry under `a`, lookup under `b` may start as a miss and become a hit. Once it has found the entry, it must keep finding it on that map. [Reference map](../built-ins/reference-map/README.md)

For reference operands, the same choice reaches `===`, `!==`, reference-map reads and updates, array `indexOf` and `includes`, `switch`, and downstream data, branches and failures. If module initialization observes true, an exported function comparing the same live pair must also observe true. An initial false may later become true. Calls that construct fresh pairs can also yield different booleans. [Module evaluation](../../fjs/edag/memo/README.md) · [Switch](../control-flow/switch/README.md)

**Purity.** Rule 1 prohibits program side effects. FJS code gains no operation to mutate a value, schedule a merge or perform I/O. A program can observe a merge through identity, so effect freedom no longer implies repeatability of an identity-sensitive expression. In particular a VM may retain the boolean returned earlier, but substituting a cached false for a new comparison after a known merge would violate rule 4. [Language principles](../principles/README.md)

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

A later key merge raises a separate question. Suppose an immutable map holds `a → 1` and `b → 2` while the keys are distinct, then `a` and `b` merge. Both keys must now return the same binding. The four rules settle key equality but do not select the surviving value. Decide how to reconcile the bindings on each persistent map version. Test the older one-entry map and two maps with the same bindings written in opposite orders. If those two maps have already merged, any collision rule must give both the same answer.

The proposed native-map serialization can omit a key found nowhere else in the graph, on the assumption that the caller cannot produce it again. Test saving `empty({}, 7)[1]` alone. After a CAVM reloads it, lookup under a newly constructed `{}` must still find `7`. Dropping the entry or substituting a dummy key/value can change that observation. [Map serialization design](../design/object-identity.md#serialization)

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

- [ ] **Allocation identity (language decision).** Carry the four rules recorded in review into the proposed rule 2 exception and reference-map contract. Check global memoization and CAVM as conforming policies. For Amnesia, exercise a shared node read twice and every identity observer before claiming conformance with a content comparator. [Compatibility tracker](../../todo/fjs-javascript-compatibility.md)
- [ ] **Closure folding (language decision).** Decide the versioned canonical code/frame rules and reference-map content. Record which prior identity decisions this supersedes and publish pairs that must and must not merge.
- [ ] **Library change.** Implement the ordered helper and migrate content assertions. Include reordered keys, shared children, missing entries, signed zeros and function leaves.
- [ ] **Backend optimization.** Recognize the helper as a pattern instruction after its semantics are tested. Compare the instruction with the executable definition under the same identity choices. Verify that a non-CAVM keeps the constant-time object identity check distinct from deep comparison, and that both spellings reach the same equality operation on a CAVM.
- [ ] Implement the selective-schedule tests above. Include a false at initialization followed by true on the same live pair, repeat the comparison through a warm cache to catch a stale negative, reject a later split, and cover nested aliases, merged map keys and closures.
- [ ] Test round trips by format. JSON can unfold graph sharing. DataJS records it. Check the ordered content, the sharing each format promises and reconstruction of map keys. [DataJS sharing](../datajs/README.md) · [Serialization](../design/serialization.md)
- [ ] Evolve the existing VM in stages. Start with reference identity and ordered `structEq`, allow selective reuse at construction or later permanent merges even after a false comparison, then unify the two instructions when identity is fully determined by content. Code that already asks for ordered content equality keeps using `structEq` throughout. A lazy merge needs no history of negative comparisons. Preserve established aliases and make identity-sensitive operations observe the joined class. Evaluate lazy hashing and caching on those terms. [CAVM design](../design/content-addressable-vm.md)

### Related designs

OCaml permits implementation-dependent physical equality for immutable values with a one-way guarantee about structural comparison. Unison gives a precedent for excluding names when hashing definitions. [OCaml physical equality](https://ocaml.org/manual/5.3/api/Stdlib.html#VAL(==)) · [Unison hashes](https://www.unison-lang.org/docs/language-reference/hashes/)

Scheme leaves some procedure and literal identities unspecified. Rust documents that separately declared functions can share an address, and MSVC gives a concrete example in its identical-code folding option. [Scheme §6.1](https://standards.scheme.org/official/r7rs.pdf#page=30) · [Rust function addresses](https://doc.rust-lang.org/std/ptr/fn.fn_addr_eq.html) · [MSVC linker options](https://learn.microsoft.com/en-us/cpp/build/reference/opt-optimizations)

TC39's withdrawn Records and Tuples proposal sorted record keys. Its Composites proposal interns key/value sets per realm and normalizes `-0` to `0`. FJS records expose their enumeration order, and `structEq` distinguishes signed zeros. [Records and Tuples](https://github.com/tc39/proposal-record-tuple) · [Composites](https://github.com/tc39/proposal-composites)
