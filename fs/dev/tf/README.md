# Test Framework

To enable testing in your project, you can add a simple test runner file `all.tets.ts` like this:

```ts
import { run } from 'functionalscript/fs/dev/tf/all.test.js'

await run()
```

And then run it as

- `deno test --allow-env --allow-read`,
- `node --test`,
- `bun test`.
