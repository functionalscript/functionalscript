# Replace object.at with the shared entry reader

**Status:** wip, stacked on #3773.

`at` duplicates own-property lookup through a detached
`Object.getOwnPropertyDescriptor`, which the compiler does not admit.
Use the existing `entry(object, key)` primitive throughout its callers
and remove `at` from the object helpers.

`entry` answers `undefined` for absence; keep public APIs that promise
`null` normalized at their nullable boundaries. FunctionalScript plain
record fields are enumerable own properties, matching the lookup contract.

- [ ] Migrate all callers and remove the duplicate helper.
- [ ] Update proofs and documentation for the public API.
- [ ] Check compilation and promote newly supported dependency-closed modules.
- [ ] Regenerate and run the scoped checks.
