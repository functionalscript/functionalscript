## Use EDAG values in FJS VMs

**Priority:** P3
**Status:** wip — design proposal; implementation has not started

### Problem

FJS EDAG evaluators currently produce host JavaScript values. Function wrappers
limit their representation and lose direct access to the function's code.

Define `EdagValue` as a subset of EDAG and make it the sole computation value
representation for VMs implemented in FJS. Evaluation returns
`Result<EdagValue, EdagValue>`, and callers can compile or convert successful
values to host values typed as `unknown`.

### Tasks

- [ ] Complete the design for values, operations, module initialization,
      compilation, host conversion and migration of existing FJS VMs.
