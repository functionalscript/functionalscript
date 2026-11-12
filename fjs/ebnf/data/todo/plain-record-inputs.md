# Check grammar records within the FunctionalScript input contract

**Status:** wip, stacked on #3774.

`isRecord` inspects prototypes only to reject host objects such as `Map`.
Grammar carriers are FunctionalScript records or decoded DataJS records;
prototype introspection is outside this API's contract.

- [ ] Use `isObject` directly for record carriers and remove prototype reads.
- [ ] Remove Map-only refusal fixtures while retaining FJS shape checks.
- [ ] Check compilation, generation, types and the scoped proofs.
