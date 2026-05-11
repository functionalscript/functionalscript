# Test Framework

To enable testing in your project, you can add a simple test runner file `all.tets.ts` like this:

```ts
import {} from 'functionalscript/dev/tf/all.test.js'
```

And then run it as

- `deno test --allow-env --allow-read`,
- `node --test`,
- `bun test`
