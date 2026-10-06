## Implement the Node effects natively

**Priority:** P2
**Status:** blocked
**Blocked by:** [Implement the native effect runner](./nanvm-effects-node.md)

### Problem

The native runner's loop alone does not provide the effects needed by native
FJS programs, including the self-hosted CLI.

### Proposal

Implement the same set of effects as [`fjs/effects/node/`](../fjs/effects/node/)
in `nanvm-effects-node`, preserving their observable contracts. That directory
is the scope of this task as it evolves, including effects added later; do not
maintain a separate enumeration here.

Build on the native runner's VM-value model and synchronous loop. Individual
effect implementation details remain unspecified by this TODO.

### Tasks

- [ ] Implement native support for the effect set in the referenced directory.
- [ ] Verify equivalent observable behavior against the Node runner.
