## Implement the Node effects natively

**Priority:** P2
**Status:** blocked
**Blocked by:** [Implement the native effect runner](./nanvm-effects-node.md)

### Problem

The native runner's loop alone does not provide the effects needed by native
FJS programs, including the self-hosted CLI.

### Proposal

Implement the same set of effects as [`fjs/effects/node/`](../fjs/effects/node/)
in `nanvm-effects-node`, preserving their observable contracts within the native
scope below. That directory defines the evolving effect set, including effects
added later; do not maintain a separate enumeration here.

The host-JavaScript `import` effect is excluded from this native task. Native
module loading belongs to the [FJS module loader](../fjs/compiler/todo/load-modules-without-import-effect.md)
and follows the [native source-loading contract](../nanvm-lib/todo/mvp-roadmap.md#post-mvp-milestone-self-hosting):
supported FunctionalScript, not arbitrary JavaScript or host modules. This does
not remove or change `import` support in existing JavaScript runners.

Build on the native runner's VM-value model. Use its minimal synchronous loop
only for effects whose observable contracts it can preserve. Effects requiring
asynchronous execution, and the execution support they need, are tracked in
[asynchronous native effects](./nanvm-effects-node-async.md), not forced through
the synchronous boundary. That work does not block the synchronous subset.

This TODO remains the overall parity task: completing the synchronous subset
alone does not complete it. Execution design and individual effect
implementation details remain unspecified here.

### Tasks

- [ ] Implement effects whose observable contracts the synchronous loop can preserve.
- [ ] Complete the [asynchronous native-effects task](./nanvm-effects-node-async.md).
- [ ] Verify equivalent observable behavior against the Node runner for the full
      native scope above.
