/**
 * The `fjs` CLI entry point for the SpiderMonkey shell:
 * `js --module fjs/spidermonkey.mjs -- <command>`. Its host implements only
 * what `fjs t` needs ([`./effects/spidermonkey/module.mjs`](./effects/spidermonkey/module.mjs)),
 * and `npm run sm-test` runs `fjs t` through it.
 *
 * @module
 */

import { main } from './module.f.mjs'
import { run } from './effects/spidermonkey/module.mjs'

await run(main)
