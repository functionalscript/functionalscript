# Outputs

**Status:** implemented

Besides the readers, a schema gives three outputs, each derived from the one
declaration:

| Output | From a schema `s` |
| --- | --- |
| the TypeScript type | `Ts<typeof s>`, and `printer()(s)` as text |
| a JSON Schema, draft 2020-12 | `toJsonSchema(s)` |
| a canonical form, with `equal`, `cmp` and `subset` | `toData(s)` |

## Pages

- [The TypeScript type](./typescript/README.md): `Ts<>` and the printer
- [JSON Schema](./json-schema/README.md): `toJsonSchema`, and where it is
  lossy
- [The canonical data form](./data-form/README.md): `toData`, and comparing
  schemas as sets

## Where it is implemented

[`ts`](../../ts/module.f.mjs), [`media/json/schema`](../../../media/json/schema/module.f.mjs)
and [`data`](../../data/module.f.mjs).
