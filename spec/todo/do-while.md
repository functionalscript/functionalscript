# Do-while loops

**Priority:** P3
**Status:** wip — approved implementation

The language designer approved retaining `do { body } while (condition)` in AST and lowering it to an unconditional FAST loop with a condition check after the body in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).

## Contract

The body runs at least once. Normal completion and an owning `continue` evaluate the condition exactly once; falsy breaks and truthy starts the next iteration. An owning `break`, return or throw skips the condition. Nested loops and functions keep their own transfers. Body lexical declarations do not escape into the condition. Preserve the written loop and unreachable statements in syntax AST; perform control-flow lowering in AST-to-FAST conversion using existing loop and transfer forms.

## Tasks

- [ ] Admit braced do-while statements with their condition and optional semicolon in AST, preserving JavaScript statement boundaries.
- [ ] Lower through the existing loop machinery, including mutable state, owning continues and abrupt exits.
- [ ] Prove AST shape, scopes, once-only condition evaluation, nested transfer ownership and supported output behavior.
