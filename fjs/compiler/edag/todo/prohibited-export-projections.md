# Write imports whose export names are prohibited property reads

**Priority:** P2
**Status:** open

## Problem

An accepted module can fail when written back as FunctionalScript:

```sh
./dev.sh npm start compile fjs/types/object/module.f.js /tmp/prohibited-export.f.js
```

The output is refused with `a prohibited property name`. The same limitation
affects the [compiler grammar](../../parser/grammar/module.f.js).

The linker's `resolved` helper in [the module](../module.f.mjs) represents
a named import as `['.', importedModule, exportName]`. Export names such as
`map` and `entries` are valid, but the
[source writer's admission check](../../../edag/to_fast/source/module.f.js)
rejects these synthetic reads as prototype properties. The grammar's first
such refusal selects the `map` export of `types/list`.

This is a source-output limitation, separate from the authored `.f.js`
check, which [reads and links without writing](../../../../spec/command-line/checking.md).

## Tasks

- Preserve named-import values and module initialization order while making
  the linked export selections writable as source.
- Keep the existing refusal of prohibited property reads in authored code.
- Prove source output for valid imported names such as `map` and `entries`.
