# Test Framework

The main principle is that tests don't depend on test framework. We use conventions instead.

## Conventions

- file name 'test.f.*',
- parsing default exports.

## Regeneration

`npm run gen` is [`gen/module.f.mjs`](./gen/module.f.mjs): one program whose
`generators` list is every generator of this repository in the order
regeneration needs, each with the reason for its position beside it, ending
with the generated Nix lock script run on the terminal. `npm run gen:clean` is
[`clean/module.f.mjs`](./clean/module.f.mjs), the cleanup that program starts
with. A new generated output is a new entry in that list — see
[CONTRIBUTING.md](../../CONTRIBUTING.md#regenerating-after-a-source-change).
