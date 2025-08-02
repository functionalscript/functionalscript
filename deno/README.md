# Deno Test

To enable Deno testing in your project, you can add a simple test runner file `tets.ts` like this:

```ts
import run from 'functionalscript/deno/module.js'

await run()
```

And then run it as `deno test --allow-env --allow-read`.

Another option is to run the [./test.ts](./test.ts) directly, for example

`deno test --allow-env --allow-read node_modules/functionalscript/deno/test.js`
