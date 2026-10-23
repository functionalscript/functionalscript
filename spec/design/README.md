# Language Specification: Design

Design decisions and sketches for the unimplemented parts of the system. They
are not open work and carry no issue header; the open work is in
[`spec/todo/`](../todo/README.md). The numbered ones moved from the main spec
README and keep their old section numbers:

|Document|Topic|
|--------|-----|
|[io-effects](./io-effects.md)|§5 — I/O with effects: `Effect`, operations, runners|
|[content-addressable-vm](./content-addressable-vm.md)|§6 — content-addressable VM, hashing|
|[object-identity](./object-identity.md)|§7 — object identity, custom dictionaries, `Map`|
|[mutability](./mutability.md)|§8 — mutable objects and ownership tracking|
|[serialization](./serialization.md)|§9 — EDAG as data, CBOR, bytecode as VM-internal|
|[vm-command-format](./vm-command-format.md)|NPN command format of the VM|
|[design-principles](./design-principles.md)|design principles of the "ideal" FJS `0.*`|
|[function-frame](./3111-function-frame.md)|NaNVM function objects: frames and captured values, VM-internal|
|[call-like-instructions](./9100-call-like-instructions.md)|VM-internal bytecode for calls|
