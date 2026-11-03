## Control-flow-neutral AST and function completion

**Priority:** P2
**Status:** wip

### Proposal

Keep syntax AST blocks close to the written source: ordered statement sequences, including statements after returns, without implicit-return nodes or terminal-loop/terminal-if classifications. Preserve written returns, branches and loops. Do not analyze reachability in syntax parsing.

During AST-to-FAST conversion, analyze completion and omit unreachable FAST work. Synthesize `return undefined` only for a function path that completes normally. An if/else whose every branch returns is terminal; a missing else leaves a normal path. A literal infinite loop without a break targeting it is terminal, including a loop with owning-function returns. Retain binding resolution and existing unsupported-operation refusals.

This changes function fallthrough from a refusal to an accepted undefined result. It improves JavaScript compatibility and separates syntax from control flow; the cost is revising the existing completion-dependent block readers and admission proofs. Broader join and switch-fallthrough support remain separate work.

The language designer `sergey-shandar` explicitly requested this representation, the FAST completion behavior and preservation of unreachable AST statements in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019). This supersedes the earlier explicit-function-ending rule for this increment and records approval under DESIGN.md §12.

### Tasks

- [ ] Make syntax blocks preserve all written statements without completion markers.
- [ ] Lower normal function completion to an undefined return in FAST only.
- [ ] Prove terminal branches/loops, unreachable syntax and normal fallthrough.
- [ ] Update affected specs, examples and refusal expectations; validate the change.
