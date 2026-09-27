## Explore an optional Rust EDAG library

**Priority:** P4
**Status:** on-hold — not planned for MVP; not a self-hosting prerequisite.

### Problem

Direct Rust output exposes error propagation and lazy operands at each generated
operation: `Result` handling and grouping, plus thunks for short-circuiting.
A Rust expression graph could centralize those semantics, serve as a Rust EDSL
for FJS, and support a native executor for dynamically loaded EDAG.

That flexibility adds a representation, dispatch and allocation costs, graph
ownership rules, and another executor to keep conformant. Cleaner generated
syntax alone does not justify putting it on the bootstrap path. Keep the
existing direct Rust backend and low-level VM for MVP and self-hosting.

### Proposal

Explore a separate, optional library that depends on the VM value/operator API.
The VM foundation must not depend on this library, and individual VM
implementations need not implement their own EDAG. Direct AOT output continues
to use VM objects and the effects it needs without a runtime EDAG dependency
or runtime code generation.

A future compiler backend could emit Rust that constructs this graph. Compiling
that Rust ahead of time still leaves graph evaluation at runtime; direct native
AOT remains a separate backend. The same graph builders would also let Rust
authors write FJS computations as an EDSL.

Expression builders produce expressions, not evaluated values. A shared
executor owns evaluation order, lazy branches and error propagation. Rust
traits can provide arithmetic syntax, while operations whose Rust result type
or evaluation rules differ need explicit builders:

| FJS operation | Rust EDSL direction |
| --- | --- |
| `+`, `-`, `*`, `/` | Arithmetic traits returning expressions |
| `===`, `<` | Explicit expression builders; `PartialEq`/`PartialOrd` cannot return expressions |
| `&&`, `\|\|`, `??`, `?:` | Explicit builders preserving lazy operand evaluation |

A closure alone, such as `Fn() -> Any<A>`, is not inspectable code. Source
reconstruction needs retained semantic graph data and function association;
keep that metadata concern separate from the executor. The same distinction
applies to direct AOT functions, which can retain metadata without depending
on a dynamic Rust executor.

### Tasks, if resumed

- [ ] Choose graph representation, ownership and the boundary between immutable
      code and invocation state; preserve sharing, captures and function identity.
- [ ] Specify expression builders and evaluation semantics against the existing
      FJS EDAG, without redesigning the VM foundation around the graph.
- [ ] Reuse the canonical schema through
      [Rust schema generation](../fjs/edag/todo/rust-schema-codegen.md).
- [ ] Prototype graph-building compiler output and the Rust EDSL; compare their
      shared executor with direct AOT and the FJS interpreter for semantic
      agreement, runtime cost and implementation size.
- [ ] Evaluate a native runtime EDAG adapter only if a concrete consumer needs it;
      it is an alternative to the AOT-compiled FJS interpreter.

Future direct AOT targets, such as Swift, may compile from EDAG without shipping
this library. Backend selection and those targets are outside this task's
current scope; none is a requirement for MVP.

### Related

- [MVP roadmap](../nanvm-lib/todo/mvp-roadmap.md) — direct Rust generation and
  self-hosting through AOT-compiled FJS.
- [FJS interpreter](../fjs/fsc/todo/interpret-edag.md) — the existing executor.
- [function association](../fjs/fsc/todo/associate-edag-with-functions.md) and
  [function serialization](../spec/todo/serialization.md) — metadata and text
  contracts, independent of a Rust EDAG executor.
