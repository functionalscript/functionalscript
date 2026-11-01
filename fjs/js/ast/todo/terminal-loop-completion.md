## Preserve terminal loop completion

**Priority:** P2
**Status:** wip

### Problem

Source normalization puts a synthetic throw after a terminal unconditional
loop because FAST requires every block to have an exit. A loop admitted with
no break targeting it cannot complete normally. Its FAST and EDAG should
preserve that fact without inventing a failure after the loop.

### Tasks

- [ ] Represent terminal loop completion directly in FAST and graph construction.
- [ ] Preserve owning returns, deliberate divergence, source failures and loop state.
- [ ] Verify JavaScript and Rust output without adding implicit function returns.
- [ ] Remove the synthetic-guard contract from the permanent documentation.

### Related

- [Compiler architecture](../../../compiler/architecture.md).
- [Terminal unconditional loops](../../../../spec/control-flow/loops/README.md#a-terminal-unconditional-loop).
- [Session decision](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
