## Allow sharing of equal values on the path to a CAVM

**Priority:** P2 — language-design decision
**Status:** open — awaiting explicit language-design approval

### Problem

The goal is to evolve the existing VM into a content-addressable VM (CAVM). **Developers are responsible for their algorithm’s correctness when it uses allocation identity.** An algorithm may use `Object.is` and return different valid results on different VMs. Use ordered `structEq` when the algorithm requires content equality.

```js
const make = x => ({ x })
const a = make(1)
const b = make(1)
export default Object.is(a, b)
```

A JS-hosted EDAG interpreter with fresh allocations returns `false`. A compiler could reuse the result of `make(1)` and return `true`. A test that insists on either boolean for every FJS executor would prevent the other implementation. For this data, `structEq(a, b)` is `true` on both. [Execution models](../../fjs/edag/execution-models.md)

### Proposed exception to JavaScript agreement

The proposal relaxes allocation identity under rule 2 of the language principles. A non-CAVM may keep separately created equal-content objects or functions distinct or share them. FJS leaves the timing of that choice open. Existing aliases still denote one value, and different content stays distinct. Only a CAVM guarantees a deterministic identity result for fixed inputs and a fixed semantics version. [Language principles](../principles/README.md) · [Identity design discussion](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7076917938)

Leave unresolved non-CA identity cases open until a concrete use requires a guarantee. A later specification can narrow the choices while preserving programs that already work across them. Withdrawing a guarantee can break programs that came to depend on it.

The practical example is running the serialized program on another VM. The compiler’s `.edag.data.js` output retains the comparison and its operands. Executing that graph on a CAVM gives `true` because both records have the same ordered content. If the first execution writes its result to `.json` or `.data.js`, loading that value gives the original `false`. [Program and value outputs](../command-line/output.md#evaluation-and-projection)

#### Which equality operation should a program use?

**On a non-CAVM, prefer `structEq(a, b)` for comparing contents**, including in tests. A true `Object.is(a, b)` lets `structEq` return immediately. After a false result, the contents may still match.

A parser generator can use `Object.is` to assign entries in a map of grammar rules. Suppose the start production is `S ::= "x" "x"` and the generator constructs the two literal rules separately. One VM may assign both occurrences the same rule ID. Another may return a map with two IDs. The start production refers to the literal twice in either map, so both parsers must recognize exactly `xx`. Different returned maps are valid when the generator promises a correct parser and allows the rule numbering to vary.

On a VM that compares object references, `Object.is` takes `O(1)`. An executor that discovers identity by comparing content can have a different cost. Comparing independently built structures with `structEq` can take `O(n)` time, where `n` counts all descendant visits, including repeated visits to a shared subtree.

For example, build two separate graphs by starting with a leaf and wrapping each child as `[child, child]` for `d` levels. A naive comparison reaches the leaf pair `2^d` times. Memoizing completed pairs reduces this example to `d + 1` distinct pair comparisons. In general the work depends on the pairs reached and the child entries examined for each pair.

**On a CAVM, both names denote the same equality instruction for every FJS value.** The CAVM specifies the answer and leaves the time complexity unspecified. An implementation can intern values at creation or establish content identity lazily during comparison.

On every executor, `Object.is` treats `NaN` as equal to itself and distinguishes `0` from `-0`. A true `Object.is(a, b)` implies `structEq(a, b)`. On a CAVM the converse also holds.

Identity-sensitive operations include reference-map lookup, reference comparisons with `===`, and array `includes`. If a branch depends on allocation identity, its result can vary across executors even in a program with no I/O or mutation. [Reference map](#reference-map) · [Language principles](../principles/README.md)

### Ordered structural equality and its pattern instruction

Define `structEq(a, b)` once as an executable FJS **library function**. Its **pattern instruction** is a separately deliverable optimization. Recognize the complete parsed definition with resolved dependencies and bindings. Direct JavaScript executes the function, and a backend may substitute an equivalent instruction. The ordered helper can ship first. [Pattern recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)

| Operands | Comparison |
| --- | --- |
| Primitives | Use `Object.is`, including equal `NaN` values and distinct signed zeros. |
| Arrays | Compare lengths and corresponding elements recursively in index order. |
| Records | Compare own enumerable string keys in `Object.entries` order, then the corresponding values recursively. A present `undefined` counts as an entry. |
| Functions | Use `Object.is(a, b)` on the two function references, including inside a container. |

Different kinds compare unequal. The same ordered, function-free data gives the same answer on every VM regardless of sharing. For a container with function leaves, the result also depends on whether the corresponding function references are shared. Reversing ordinary string keys changes the answer. Array-index keys enumerate first. `{ b: 1, "2": 0 }` and `{ "2": 0, b: 1 }` both enumerate `["2", "b"]`. The existing `structurallySame` intentionally compares record keys as an unordered set. Audit its callers and retain it temporarily or rename it for those that need unordered comparison. [Objects](../values/objects/README.md) · [Existing helper](../../fjs/types/object/structurally_same/README.md)

### What is the canonical content of a closure?

Closure folding is a language decision of its own. It would reverse the approved rule that two separately written instances of the recognized `empty` helper have distinct identities even after compilation. The proposed eligibility test uses canonical code, signature (including the observable `length`) and the corresponding captured values. A JS-inferred function name is a spelling and contributes no content. Rendering a function as text is a separate observation. [Approved object-identity decision](../design/object-identity.md#decisions) · [Function names and identity](../functions/names-and-identity/README.md) · [Function-text design questions](./cavm-function-to-string.md#what-must-default-function-text-guarantee)

Define canonical code per semantics version, before discretionary optimizer rewrites. Today's EDAG uses the name-erased graph with specified lowerings. A minimal candidate compares operator tags, binding and frame slot references, signature, and the graph's specified sharing. A consistent renaming makes `x => x` and `y => y` the same code. Should canonicalization also fold `() => 1 + 2` to `() => 3`, substitute a captured constant into the body, or normalize additional graph sharing? Specify each admitted rewrite and its expected equality result for the version. Backends may emit the same machine code for two functions while preserving their distinct language identities. [Current EDAG representation](../../fjs/edag/README.md)

Given `const wrap = x => () => x`, two calls to `wrap(1)` may coalesce and a CAVM must give them one identity. `wrap(1)` and `wrap(2)` remain distinct. If the captured values are references `a` and `b`, folding `wrap(a)` with `wrap(b)` must preserve what calls return. Their common result would have to alias both `a` and `b`. The caller can distinguish the closures while calls return distinguishable captures.

### Reference map

For lookup, treat each persistent map version as a list of writes with object or function keys. Search newest first and take the value of the first key for which `Object.is(storedKey, key)` is true, or `undefined` on a miss. A read `m(key)` returns that value and the same map. A write `m(key, value)` returns the previous value and a new version with the write prepended. Passing `undefined` as the value is a read. The EDAG list implementation uses `===`, which agrees with `Object.is` for its object and function keys. [Reference-map API](../built-ins/reference-map/README.md) · [EDAG implementation](../../fjs/js/ref_map/module.f.js) · [Designer's lookup rule](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7077249934)

Suppose a non-CAVM keeps the equal-content keys `a` and `b` distinct through three writes. Save each version with its write order and reload it on a CAVM.

| Map version | Write | Previous value returned at the write | CAVM lookup with either key |
| --- | --- | --- | --- |
| `m1`, from `empty` | `a → 1` | `undefined` | `1` |
| `m2`, from `m1` | `b → 2` | `undefined` | `2` |
| `m3`, from `m2` | `a → 3` | `1` | `3` |

The newest matching write wins under the receiving VM’s identity relation.

The EDAG interpreters scan up to all the writes in a version. Production VMs must answer each map call in `O(log n)`, including calls on older versions, where `n` counts distinct keys set since `empty`. An address-indexed implementation must preserve newest-first lookup for the identity policy it implements. [Executor bounds and implementations](../built-ins/reference-map/README.md#executors)

**Import into a CAVM.** Replay ordered writes oldest first with canonical keys. If several stored keys become one, the newest write wins in that version. To reproduce lookups, a compact snapshot can keep the last write for each source key if it preserves their relative write order. In `m3`, first-insertion order would incorrectly make `b → 2` the winner. Refuse an order-losing format only when the missing precedence makes the result ambiguous. For example, the unordered bindings of `m2` alone cannot say whether `1` or `2` wins. [Refuse what you cannot handle](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)

The single-key case must succeed. Save `empty({}, 7)[1]` alone, reload it on a CAVM, then look up a newly constructed `{}`. The lookup must return `7`. The existing native-map serialization proposal can omit a key found nowhere else in the graph or insert a dummy binding. A CAVM can reconstruct the lookup key by content, so its import format must preserve the binding. [Map serialization design](../design/object-identity.md#serialization)

#### Map identity

The map’s own canonical identity remains a CAVM design question. One candidate uses the unordered set of current canonical bindings. Under that rule, writing `a → 1` then `a → 2` gives the same map as writing only `a → 2`. Non-CA map identity can stay open. [Map identity discussion](https://github.com/functionalscript/functionalscript/pull/4076#issuecomment-7077397030)

### Testing identity-dependent results

Test the properties the algorithm promises. For the grammar-rule map, run the generated parser on `xx`, `x` and `xxx`. Only `xx` should be accepted, whichever rule IDs the generator chose. Also check any parse output the grammar specifies. For the two records above, the portable content assertion is `structEq(a, b)`. Non-CA sharing choices are outside the portable test contract.

Amnesia serves as a proof evaluator outside the FJS identity-conformance suite. It can evaluate a shared array node twice and return false when both reads denote the same logical value. The same-value rule requires true. [Amnesia's shared-node example](../../fjs/edag/amnesia/README.md#recomputed-code-retained-values)

### Tasks

- [ ] **Allocation identity (language decision).** Record the language designer's explicit approval of the portability exception and link it here before implementation. [Language-design approval](../../doc/DESIGN.md#new-language-features-start-with-a-todo) · [Compatibility tracker](../../todo/fjs-javascript-compatibility.md)
- [ ] **Closure folding (language decision).** Decide the CAVM’s versioned canonical code/frame rules and the separate [map identity question](#map-identity). Record which prior identity decisions this supersedes and publish examples of CAVM equality.
- [ ] **Library change.** Implement the ordered helper and migrate content assertions. Include reordered keys, shared children, missing entries, signed zeros and function leaves.
- [ ] **Backend optimization.** Recognize the helper as a pattern instruction after its semantics are tested. Compare the instruction with the executable definition under the same identity choices. Verify the constant-time identity fast path on a reference-comparing VM and the shared equality operation on a CAVM.
- [ ] Test that repeated references to the same value preserve aliasing. For separate allocations, verify that serializing the boolean preserves the result obtained and that evaluating the serialized comparison on a CAVM uses content identity.
- [ ] Test round trips by format. JSON can unfold graph sharing. DataJS records it. Check ordered content and the sharing each format promises. Import the one-key snapshot and the ordered snapshots of all three map versions into a CAVM. Check the winner under both write orders, including the final overwrite. Accept unordered bindings when the result is unambiguous and reject the two different competing bindings when their precedence is lost. [DataJS sharing](../datajs/README.md) · [Serialization](../design/serialization.md)
- [ ] Evolve the existing VM in stages. Start with reference identity and ordered `structEq`, allow the compiler to share equal values, then unify the two equality instructions on the CAVM. Portable content comparisons use the same spelling throughout. Evaluate lazy hashing and caching as implementation choices. [CAVM design](../design/content-addressable-vm.md)

### Related designs

OCaml permits implementation-dependent physical equality for immutable values with a one-way guarantee about structural comparison. Unison gives a precedent for excluding names when hashing definitions. [OCaml physical equality](https://ocaml.org/manual/5.3/api/Stdlib.html#VAL(==)) · [Unison hashes](https://www.unison-lang.org/docs/language-reference/hashes/)

Scheme leaves some procedure and literal identities unspecified. Rust documents that separately declared functions can share an address, and MSVC gives a concrete example in its identical-code folding option. [Scheme §6.1](https://standards.scheme.org/official/r7rs.pdf#page=30) · [Rust function addresses](https://doc.rust-lang.org/std/ptr/fn.fn_addr_eq.html) · [MSVC linker options](https://learn.microsoft.com/en-us/cpp/build/reference/opt-optimizations)

TC39's withdrawn Records and Tuples proposal sorted record keys. Its Composites proposal interns key/value sets per realm and normalizes `-0` to `0`. FJS records expose their enumeration order, and `structEq` distinguishes signed zeros. [Records and Tuples](https://github.com/tc39/proposal-record-tuple) · [Composites](https://github.com/tc39/proposal-composites)
