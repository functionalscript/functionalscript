# Deno Test

To enable Deno testing in your project, you can add a simple test runner file `tets.ts` like this:

```ts
import {} from 'functionalscript/deno/test.run.js'
```

And then run it as `deno test --allow-env --allow-read`.

Another option is to run the [./test.run.ts](./test.run.ts) directly, for example

`deno test --allow-env --allow-read node_modules/functionalscript/deno/test.run.js`
