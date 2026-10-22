# RTTI guide

The guide explains RTTI one concept per page, the way
[the language specification](../../../spec/README.md) explains
FunctionalScript one feature per page. The module READMEs beside the code
([`data`](../data/README.md), [`ts`](../ts/README.md)) say how a module works;
a guide page says what a schema means and what each reader and output makes of
it. Each page has a status line, the rule with its example, an *Examples*
section, a *Reference* to the TypeScript and JSON Schema constructs it
corresponds to, and the module that implements it.

## Contents

`●` has a lesson in the [RTTI demo](../README.md) today; `○` has none yet;
`◌` is planned and has a `todo/`. The areas not linked yet are still sections
of [the RTTI README](../README.md), and move here one area at a time
([the plan](../todo/rtti-guide.md)).

- [Schemas](./schemas/README.md): the vocabulary
  - `○` [constants](./schemas/constants/README.md)
  - `●` [primitives](./schemas/primitives/README.md)
  - `●` [structs and tuples are closed](./schemas/closed-containers/README.md)
  - `●` [open containers](./schemas/open-containers/README.md)
  - `●` [absence](./schemas/option/README.md)
  - `●` [unions](./schemas/unions/README.md)
  - `●` [arrays and records](./schemas/arrays-and-records/README.md)
  - `●` [recursion](./schemas/recursion/README.md)
  - `◌` function types, excluded string values
- Readers: `parse` and `validate`, the error shape, what the readers assume of
  a value
- Outputs: the TypeScript type, JSON Schema, the canonical data form
- In the project: the schemas the repository itself declares
