## Allow equal-content allocations to share identity

**Priority:** P3
**Status:** open — proposed language change, pending design approval

### Problem

Preserving a fresh identity for every object makes the history of its construction observable. It can prevent constant folding, sharing equivalent computations across calls, and memoizing a function that returns an object. Allocation history is also a poor portable identifier. Serializing and reading a value creates new allocations, and formats differ in which sharing they encode. [Execution models](../../fjs/edag/execution-models.md) · [DataJS sharing](../datajs/README.md)

### Proposal

Adopt one FJS contract under which an ordinary VM can evolve into a content-addressable VM (CAVM). Non-CAVMs explicitly give up some determinism. An implementation may keep separately constructed objects distinct or coalesce them when their contents agree. Only the CAVM guarantees a single identity for equal content and thus a deterministic answer to identity comparisons for the same inputs and fixed semantics. Direct JavaScript's fresh allocations are a permitted choice.

```js
const make = x => ({ x })
const a = make(1)
const b = make(1)
```

| Observation | Non-CAVM | CAVM |
| --- | --- | --- |
| `a === a` | `true` | `true` |
| `a === make(2)` | `false` | `false` |
| `a === b` | Either boolean | `true` |

A choice is consistent for the lifetime of the values. Repeated comparisons and `Object.is` on the same objects agree. A reference map populated under `a` finds that entry under `b` exactly when `a === b`. If `p = [a]` and `q = [b]`, then `p === q` implies `a === b`. These rules apply even when a comparison is first evaluated during module initialization and observed again in a later call. Identity-dependent branches can therefore return different data, or throw, across permitted executions. [Reference map](../built-ins/reference-map/README.md) · [Module evaluation](../../fjs/edag/memo/README.md)

#### Deep structural equality is a pattern instruction

Define `structEq(a, b)` once as an executable FJS function. The compiler can recognize the complete parsed definition, with its dependencies and bindings resolved, and lower it to an equivalent instruction. Direct JavaScript executes the definition. [Pattern recognition](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)

| Operands | Comparison |
| --- | --- |
| Primitives | Use `Object.is` semantics, including `NaN` equal to itself and distinct signed zeros. |
| Arrays | Compare equal lengths and corresponding elements recursively in index order. |
| Records | Compare the sequence of own enumerable string keys in `Object.entries` order, then compare corresponding values recursively. A present `undefined` counts as an entry. |
| Functions | Compare the two function references by `===`, including when reached inside an array or record. |

Different kinds compare unequal. The same ordered, function-free data gives the same answer on every VM, independently of sharing. For `const x = [1]`, `structEq([x, x], [[1], [1]])` is true. Reordering ordinary string keys changes the result. `structEq({ a: 1, b: 2 }, { b: 2, a: 1 })` is false. A VM must preserve that order when coalescing records. [Objects](../values/objects/README.md)

The current `structurallySame` treats record keys as an unordered set. It gives the wrong answer for the reordered-key example and cannot serve as the instruction's reference definition. It can remain temporarily or be renamed for callers that intentionally need unordered comparison. [Existing helper](../../fjs/types/object/structurally_same/README.md)

#### A compiler may coalesce closures

A compiler may give two functions one reference when their normalized bodies, including their signatures, and their captured values/frames agree. This grants permission to merge at compile time or runtime. At comparison time `structEq` simply tests the references. Function text plays no role in either rule.

With `const make = x => () => x`, two evaluations of `make(1)` may compare equal on a non-CAVM and must compare equal on a CAVM. `make(1)` and `make(2)` remain distinct because their captures differ. The same outcomes apply when the two functions are compared as leaves of larger data structures. Rust documents that distinct functions can share an address, and MSVC documents the same possibility under its identical-code folding option. [Rust function addresses](https://doc.rust-lang.org/std/ptr/fn.fn_addr_eq.html) · [MSVC linker options](https://learn.microsoft.com/en-us/cpp/build/reference/opt-optimizations)

#### Function text can differ between runtimes

This is the other observable deviation from JavaScript execution. FJS VMs can render function text from the EDAG. Even Node and Bun can produce different text for the same ordinary function in the same `.mjs` file. With `const scale = 3` and `const f = (x) => x * scale`, Node 24.19.0 printed `(x) => x * scale`. Bun 1.4.2 printed `(x) => x * 3` after its runtime transpiler inlined the constant. A program can observe this through `String(f)`, comparisons, keys or branches. [Bun/Node example](https://github.com/oven-sh/bun/issues/43460) · [Bun documentation](https://bun.com/docs/compiler/compatibility) · [FJS function text](../../fjs/edag/function-text.md)

### Tasks

- [ ] Record the language designer's decision. If accepted, update the language principles, execution models, JS-compatibility tracker and reference-map contract to describe one evolution path. Keep the existing function-text exception explicit. [Language principles](../principles/README.md) · [Compatibility tracker](../../todo/fjs-javascript-compatibility.md)
- [ ] Implement the ordered `structEq` definition and its pattern instruction. Audit uses of the unordered helper and its assertion. Test ordered and reordered keys, nested records and arrays, signed zero, missing entries and function leaves against the ordinary JS implementation under the same identity choices.
- [ ] Replace tests that assume a fresh allocation when they mean to assert equal content. Retain tests of actual aliasing, stable comparisons, reference-map lookup and closure folding with equal and unequal captures. Exercise fresh, selectively coalescing and fully content-addressable execution.
- [ ] Specify round trips by format. JSON can unfold a shared child into two copies. DataJS explicitly encodes graph sharing. Test the sharing each format promises and the ordered content after reloading. A live execution must honor previous identity observations. An application that explicitly reloads data can only rely on the identity information its format and executor preserve. [Serialization](../design/serialization.md)
- [ ] Evaluate lazy content comparison and hashing in the existing VM. Object creation can remain cheap. Computing a hash later must respect identities already observed. Reuse identity-sensitive cached results only where the receiving execution can honor those choices. [CAVM design](../design/content-addressable-vm.md)
