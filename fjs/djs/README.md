# DJS: what is left

The front end — tokenizer, parser, AST, transpiler and `fjs compile` — moved to
[`fjs/fsc`](../fsc/README.md) as stage 5a of
[`todo/parser-serializer-restructure.md`](../../todo/parser-serializer-restructure.md).
Two things stay here until stage 4 of that plan is on `main`:

- [`serializer/`](./serializer/module.f.mjs) and [`types.ts`](./types.ts), the
  DJS serializer and the value model it writes, which stage 4 reworks into
  [`fjs/media/datajs`](../media/datajs/README.md).
- [`todo/`](./todo/), the issues of the front end and the serializer alike.
  They move to `fjs/fsc/todo/` in a pull request of their own once stage 4's
  pull requests, which link into them, have landed.
