/**
 * This repository's own CI generation: `ci` with what only this repository
 * can name. `npm run gen` runs it, through `fjs/dev/gen`, where the built-in
 * `fjs ci` — `../module.f.mjs`'s `main` — stays the generator any project
 * gets, since that command cannot know what another package publishes.
 *
 * @module
 *
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { PackageConsumer } from '../types.ts'
 */

import { ci } from '../module.f.mjs'

/**
 * What the packed-package check asks of this repository's tarball as a clean
 * consumer: one published `.f.js` module and a runtime export it must load;
 * its `types.ts` spelled as a consumer spells it, `types.js`, which resolves
 * to the shipped `types.d.ts`; a declared type, a value of that type, and one
 * that is not — the negative control, which must fail to type-check. The
 * module is one the compiler accepts whole, so the check also covers what
 * the `.f.js` extension promises a consumer: the file ships, loads, and
 * carries its declaration.
 *
 * @type {PackageConsumer}
 */
export const packageConsumer = {
    module: 'fjs/js/prototype/module.f.js',
    value: 'prototypeNames',
    types: 'fjs/js/prototype/types.js',
    type: 'PrototypeName',
    accepted: 'map',
    refused: 'stone',
}

/**
 * The workflows and flakes this repository commits: no extra platform steps,
 * and its own module as the packed package's consumer. Every platform runs on
 * every pull request: a macOS or Windows failure found only in the merge queue
 * is found after review, by the queue's eviction.
 *
 * @type {() => Effect<NodeOp, 0, number>}
 */
export const main = () => ci({
    nodeExtra: () => [],
    packageConsumer,
})
