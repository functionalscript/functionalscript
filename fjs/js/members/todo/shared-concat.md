# Share array and string concat in the common runtime

**Status:** wip, stacked on #3772.

`concat` is already an admitted member call, with separate Rust and
represented-executor implementations. The typed member inventory still
holds `todo` entries and the common runtime has no body for either type.

Implement the array and string bodies in FunctionalScript, dispatch through
the common runtime, and use those same bodies in both executors. Preserve
array spreading by one level, fresh array results, string conversion order,
own-property shadowing and optional-call behavior. Property-read admission
is unchanged.

- [ ] Add typed array and string bodies and their proofs.
- [ ] Wire the inventory and common runtime dispatcher.
- [ ] Replace the native fallbacks with runtime-only resolution.
- [ ] Regenerate artifacts and validate the shared execution paths.
