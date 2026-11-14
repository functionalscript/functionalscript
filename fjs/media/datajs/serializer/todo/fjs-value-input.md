## Serialize FunctionalScript values directly

**Priority:** P2
**Status:** wip

### Problem

The serializer reflects on property descriptors, prototypes and other host
metadata even though its input is a FunctionalScript value. These checks
duplicate the language's value invariants and prevent compiler admission.

### Approved direction

Assume FJS values: classify non-null objects with `instanceof Array`, read
array elements directly and object members with `Object.entries`, refuse
functions, and pass primitive values to the format's leaf rule. Host objects,
property metadata and cycles are outside this input contract.

### Tasks

- [ ] Remove reflection and host-only validation while preserving data order,
      sharing, undefined members, deep traversal and JSON leaf behavior.
- [ ] Update the input types, proofs and documentation to the FJS contract.
- [ ] Check proofs, coverage, types, compiler admission and affected demos.
