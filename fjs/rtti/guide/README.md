# RTTI guide

Start with [the RTTI README](../README.md): it says what RTTI is for, what
it gives a program, and which modules make it up. This guide assumes that
purpose and goes concept by concept.

The guide explains RTTI one concept per page, the way [the language
specification](../../../spec/README.md) explains FunctionalScript one feature
per page. The module READMEs beside the code ([`data`](../data/README.md),
[`ts`](../ts/README.md)) say how a module works; a guide page says what a
schema means and what each reader and output makes of it. Each page has a
status line, the rule with its example, an *Examples* section describing the
page's demo, a *Reference* to the TypeScript and JSON Schema constructs it
corresponds to, and the module that implements it.

## How a page is built

A page is a directory, `guide/<area>/<page>/`, beside the modules rather than
among them, so a concept directory is never mistaken for a module. It holds
the `README.md`, a `sample.f.mjs` with the page's lessons, a `demo.f.mjs` that
runs them through [`schemaDemo`](../schema-demo/module.f.mjs), and a
`proof.f.mjs` that checks the page's examples and the values its text invites
the reader to type. Each area's `module.f.mjs` lists its pages' lessons, and
the [module page's demo](../demo.f.mjs) offers them in a group per area.

## Contents

`●` has a demo of its own, a lesson the page owns run through
[`schemaDemo`](../schema-demo/module.f.mjs), the machinery behind the module
page's demo; `○` has none, and says why; `◌` is planned and has a
`todo/`.

- [Schemas](./schemas/README.md): the vocabulary
  - `●` [constants](./schemas/constants/README.md)
  - `●` [primitives](./schemas/primitives/README.md)
  - `●` [structs and tuples are closed](./schemas/closed-containers/README.md)
  - `●` [open containers](./schemas/open-containers/README.md)
  - `●` [absence](./schemas/option/README.md)
  - `●` [unions](./schemas/unions/README.md)
  - `●` [arrays and records](./schemas/arrays-and-records/README.md)
  - `●` [recursion and sharing](./schemas/recursion/README.md)
  - `◌` [function types](../todo/668-rtti-function-types.md)
  - `◌` [excluded string values](../todo/excluded-string-values.md)
- [Readers](./readers/README.md): reading a value against a schema
  - `●` [`parse` and `validate`](./readers/parse-and-validate/README.md)
  - `●` [errors](./readers/errors/README.md)
  - `○` [what the readers assume of a value](./readers/assumptions/README.md)
- [Outputs](./outputs/README.md): what a schema gives besides the readers
  - `●` [the TypeScript type](./outputs/typescript/README.md)
  - `●` [JSON Schema](./outputs/json-schema/README.md)
  - `●` [the canonical data form](./outputs/data-form/README.md)
- [In the project](./in-the-project/README.md): the schemas the repository
  itself declares
  - `●` [protocols](./in-the-project/protocols/README.md)
  - `●` [media formats](./in-the-project/media/README.md)
  - `●` [the expression graph](./in-the-project/expression-graph/README.md)
  - `●` [effects](./in-the-project/effects/README.md)
  - `●` [tooling](./in-the-project/tooling/README.md)
