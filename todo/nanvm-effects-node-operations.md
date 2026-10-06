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

Build on the native runner's VM-value model and synchronous loop. Individual
effect implementation details remain unspecified by this TODO.

### Tasks

- [ ] Implement native support for the referenced effect set within the scope above.
- [ ] Verify equivalent observable behavior against the Node runner for that scope.
