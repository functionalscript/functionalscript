## Lint authored `.f.js` files with FSC

**Priority:** P2
**Status:** blocked
**Blocked by:** the first authored `.f.js`: the package fixture that
[`.f.js` package support](../../ci/todo/f-js-package-support.md) adds, or the
first rename in the [compiler-compatibility migration](../../../todo/fjs-nanvm-integration.md)
if that lands first.

### Problem

The `.f.js` extension promises that FSC accepts the source. Once the first
authored `.f.js` exists, that promise needs a repeatable check for all
discovered `.f.js` files: `tsc` accepts source FSC refuses (a missing
terminating `;`, for one), so nothing else would catch it.

### Tasks

- [ ] Discover `*.f.js` files and check each with FSC's existing compilation
      pipeline, without writing compiled output or executing the program.
- [ ] Report the file and compiler diagnostic for failures; return a failing
      status if any discovered file is rejected.
- [ ] Prove discovery checks every matching file, accepts compiler-compatible
      source, and reports a rejected file among otherwise valid inputs.

This task does not decide how to make a rejected `.f.mjs` compile. For each
candidate, show the failure to the owner, who chooses between rewriting the
source and implementing a missing FSC feature before either change begins.

### Related

- [Extension contract](../README.md#stage-2-mark-compiler-compatible-functionalscript).
