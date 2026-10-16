/**
 * The `fjs` CLI entry point for the SpiderMonkey shell:
 * `js --module fjs/spidermonkey.mjs -- <command>`. Its host implements only
 * what `fjs t` and `fjs compile`'s check need
 * ([`./effects/spidermonkey/module.mjs`](./effects/spidermonkey/module.mjs)),
 * and `npm run sm <command>` runs it — the SpiderMonkey counterpart of
 * `npm start <command>`.
 *
 * @module
 */

import { main } from './module.f.mjs'
import { run } from './effects/spidermonkey/module.mjs'

await run(main)
