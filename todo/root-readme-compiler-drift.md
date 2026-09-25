## Root README describes an old compiler

**Priority:** P2
**Status:** open

### Problem

The "Compiling a module" section of the root [README.md](../README.md)
restates what [`fjs/fsc/README.md`](../fjs/fsc/README.md) owns, and the copy
has drifted behind the compiler it documents. This README is also the page npm
shows for the package, so it is the first description of the compiler most
readers get.

What it says against what `fjs compile` does at `36c8d4a`:

- **The EDAG example output is wrong.** For its own `input.f.js`, the README
  shows `output.edag.data.js` as
  `const $0=["[]",["text"]];export default ["[]",[1,1,$0,…]];`. The compiler
  writes the module object around the value:
  `const $0=["[]",["text"]];export default ["{}",[[":","default",["[]",[1,1,$0,…]]]]];`.
- **Captures are said to be refused.** "A reference to a `const`, an import or
  an enclosing function's parameter is refused as a capture." They compile to
  a frame: `const b = [1]; export default (...a) => b;` lowers to
  `["=>",0,["[]",[["[]",[1]]]],[".",["frame"],0]]`, and
  [`closure.mjs`](../nanvm-harness/fixtures/closure.mjs) compiles to Rust.
- **Functions are said to take one rest parameter.** Fixed parameters compile
  too — [`parameters.mjs`](../nanvm-harness/fixtures/parameters.mjs) is
  `(a, b, c, ...x) => …`.
- **Unary `-` is called "the one operator".** `fjs/fsc/README.md` says it "was
  once the language's only operator": Stage A added the arithmetic, strict
  comparison and bitwise operators and Stage B the lazy `&& || ??` and `?:`
  ([`operators.mjs`](../nanvm-harness/fixtures/operators.mjs),
  [`lazy.mjs`](../nanvm-harness/fixtures/lazy.mjs)).
- **A call is said to reach only `output.edag.data.js`**, "the other outputs
  having no spelling for one yet". The Rust output spells calls:
  [`call.mjs`](../nanvm-harness/fixtures/call.mjs) compiles to `call.rs`.

### Proposal

Keep one short example in the root README whose outputs are checked against
the compiler, and link to `fjs/fsc/README.md` for the accepted subset instead
of restating it, so the list has one owner.

### Tasks

- [ ] Correct the `output.edag.data.js` example output
- [ ] Replace the accepted-subset paragraph with a link to
      `fjs/fsc/README.md`, or bring it up to date with captures, fixed
      parameters, the Stage A and Stage B operators, and calls in the Rust
      output

### Related

- [`fjs/fsc/README.md`](../fjs/fsc/README.md) — the compiler's own
  description, which the root README should defer to
- [samples](./samples.md) — executed samples the root README would embed,
  the same answer to an example that nothing checks
