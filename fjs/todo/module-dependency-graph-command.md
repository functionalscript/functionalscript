## Module dependency graph CLI command

**Priority:** P3
**Status:** wip

### Problem

The [smart-build epic](./smart-build-epic.md) needs an `fjs` CLI command to
export a module dependency graph as JSON. The exported graph will
support website visualization and later build-cache integration.

### Proposal

Use the generic AST and dependency extraction to build a module dependency
graph for FJS and the supported subsets of JavaScript and TypeScript. Forming a
source AST must not require admission or lowering into FAST or EDAG.

Write the graph as `_deps.json` in the caller's directory with no filename
argument. Record cycles in this graph; cycle rejection remains a compiler rule.
Use the same syntax-AST import reader and module resolver as compilation.

### Graph format

Represent the graph as a record mapping each module identifier to an array
of its direct dependency identifiers:

```json
{
  "main.f.js": ["lib/module.f.mjs"],
  "lib/module.f.mjs": []
}
```

For the current implementation, record keys and dependency entries are module
paths. Include each module once, with an empty array when it has no
dependencies. Modules sharing a dependency refer to the same identifier.

In the long run, dependency relationships need module hashes rather than
module paths. Replace paths with hashes in both record keys and dependency
arrays, keeping the same graph shape. The hash definition and migration are
future work.

`fjs deps` accepts no arguments. It recursively discovers files named exactly
`module.f.js` or `module.f.mjs` under the caller's directory, then follows their
runtime imports transitively. It reads generic syntax ASTs without FJS admission
or FAST/EDAG lowering. JSON dependencies are leaves. The host resolver supplies
module identity and canonical paths, as for compilation. Graph keys and edges
are relative to the caller's directory, using `/` separators and `../` for
outside dependencies; paths on other filesystem roots stay absolute.
Import attributes use the same AST reader as compilation; selected exports and bindings remain compiler checks.

The output is `_deps.json` in the caller's directory (`INIT_CWD` under npm).
Each module appears once, each direct dependency path appears once per module,
and cycles are retained. A failed scan reports errors and does not replace an
existing graph. An empty scan writes an empty JSON object.
Website rendering and build-cache integration remain separate epic tasks.

### Constructor-expression syntax

The constructor syntax increment retains `new Callee(arguments)` as a distinct AST
node, with its constructor expression, ordered arguments (including spreads)
and original `new` token. Member access, grouping, nested construction and
following calls keep JavaScript's precedence. Standalone expressions beginning
with `new` retain that syntax in module, function and loop statement positions.
This increment requires the
argument parentheses; omitted argument lists, `new.target` and optional-chain
constructor targets remain separate syntax work.

This lets dependency analysis read modules using `new Map(...)`, `new Set(...)`
and `new Error(...)` without executing or resolving those constructors. The
cost is another syntax node and precedence rules to prove. FunctionalScript
admission still explicitly refuses construction at `new`; constructor behavior,
mutability, FAST and EDAG remain outside this increment.

The language designer `sergey-shandar` requested this syntax-only implementation
in the [working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
This records no approval of FunctionalScript constructor semantics.

### Numeric object keys

Number literal property names such as `{ 0x70: 'a' }` are admitted in the
generic AST and FunctionalScript, including the equivalent literal keys in
binding patterns. The syntax retains the original numeric token, value and
source location, then reuses the
existing computed-key lowering for `{ [0x70]: 'a' }`. FAST already represents
this as `['object', [[':', 112, 'a']]]`; the current object-construction path
converts the numeric key to its property name. Preserve member evaluation order
and the existing rule that a later duplicate key wins.

The benefit is familiar JavaScript syntax and broader module AST coverage using
existing execution semantics. The cost is one grammar alternative and proofs
for literal spellings, binding patterns, duplicate keys and output readback.
This adds no FAST/EDAG operation or runtime behavior. BigInt literal property
names and additional numeric spellings not yet tokenized remain separate work.

The language designer `sergey-shandar` requested parsing, admission and
desugaring together in the
[working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006),
after confirming the existing computed-key representation. This is the approval
for this numeric-key increment.

### Single-quoted hexadecimal and vertical-tab escapes

Single-quoted strings admit `\xHH` and `\v`, which occur in implementation
modules and previously stopped source AST formation. Both decode to existing
string values, with no new FAST, EDAG or runtime operation. Double-quoted
strings retain JSON's escape rules, and template admission is unchanged.
The approval, rationale and remaining string spellings are tracked in
[JS string literals](../../spec/todo/2460-js-string-literals.md#single-quoted-hexadecimal-and-vertical-tab-escapes).

### Named `let` declarations without initializers

The generic AST retains the omitted initializer in `let name;`, including a
classic `for` header declaration. FunctionalScript admission initializes the
binding to primitive `undefined` at the declaration point, with JavaScript's
reads before any later assignment. It reuses initialized-binding lowering
without definite-assignment analysis or a new FAST/EDAG operation. `const`
and destructuring declarations still require initializers. `for…of` remains
syntax-only and is refused by FunctionalScript admission.
The approval and rationale are part of the
[variables specification](../../spec/bindings/variables/README.md#design-approval).

### Tasks

- [ ] First priority: make coverage tests run only on `module.f.js` and `module.f.mjs` files.
  - [x] Add `fjs deps` to report AST parsing failures for `module.f.js` and
        `module.f.mjs` files using the current parser.
  - [ ] Ensure a generic AST can be formed for every `.f.mjs` file in the repository,
        including files the current compiler cannot parse or lower into FAST or EDAG.
    - [x] Parse braced declaration `for…of` loops as syntax, while retaining FJS
          compilation refusal; tracked in [remaining for forms](../../spec/todo/3270-for.md#generic-forof-syntax).
    - [x] Parse defaults inside object and array binding patterns; tracked in
          [default parameters and patterns](../../spec/todo/3125-default-parameters.md).
    - [x] Parse the bounded [constructor-expression syntax](#constructor-expression-syntax)
          while retaining explicit FunctionalScript refusal.
    - [x] Parse and admit [numeric object keys](#numeric-object-keys), reusing
          computed-key desugaring and existing execution semantics.
    - [x] Parse and admit [single-quoted `\xHH` and `\v`](#single-quoted-hexadecimal-and-vertical-tab-escapes),
          preserving the double-quoted JSON and template boundaries.
    - [x] Remove five redundant empty statements from implementation modules,
          preserving JavaScript behavior and the existing FJS syntax policy.
    - [x] Parse and admit [named `let` declarations without initializers](#named-let-declarations-without-initializers),
          retaining syntax omission and supplying primitive `undefined` at admission.
    - [x] Replace nine Number counter `++` uses in loop completions and Markdown
          with explicit reads and `+= 1`, preserving the old index and update order.
    - [x] Wrap single-return/throw switch case and default bodies in eight
          implementation modules with braces, preserving dispatch and completion.
    - [x] Normalize the remaining dev loop body and explicit fallback/void returns
          in emergent testing and the byte grammar without extending the parser.
    - [x] Replace simple destructuring assignments in SUL, BigInt combinations
          and inflate with ordered ordinary assignments, preserving old values.
    - [x] Add braces around the four remaining single-statement UTF-8 guards,
          preserving behavior and reporting the next unsupported construct.
    - [x] Normalize the remaining UTF-8 tuple assignment and switch completions
          so the whole module forms a generic AST, preserving decoder behavior.
    - [x] Replace the website demo's control re-export with aliased imports and
          declaration exports, tracking automatic desugaring in
          [export lists](../../spec/todo/export-lists.md).
    - [x] Evaluate replacing host-iterable consumers with `alt.toArray`, checking
          bounded traversal and measuring representative performance.
          Object entry construction and compiler summary maps use `alt.toArray`;
          byte conversion and streamed MIME detection use `next` directly to
          preserve size bounds and early exits. Materialization performance
          depends on list shape; the
          [consumer measurements](https://github.com/functionalscript/functionalscript/pull/3584)
          record both gains and slowdowns.
    - [x] Rename the host iterable adapter and its proof to native JavaScript
          once production consumers no longer depend on it.
    - [x] Form a generic AST for every authored `module.f.js` and `module.f.mjs`
          selected by `fjs deps`, without requiring FAST or EDAG admission.
    - [x] Enforce implementation-module AST readiness in CI with `npm start deps`.
          The canonical Node job runs it uncached and fails on AST errors.
- [x] Normalize newly reached FAST fixtures, control-flow proofs and the B-tree
      demo into existing syntax forms so transitive scanning succeeds.
- [x] Define the command interface and input/output behavior.
- [x] Connect the command to AST-based dependency extraction and graph construction,
      sharing import reading and resolution with compilation.
- [x] Emit the module-to-dependencies record as `_deps.json`.
- [x] Retain cycles in the JSON graph; compilation continues rejecting cycles.
- [x] Add command documentation and proofs for output, shared dependencies, cycles
      and scan/write failures.

### Related

- [Smart build epic](./smart-build-epic.md) — foundation tasks and consumers.
- [Dependency command](../deps/README.md) — JSON output and command behavior.
