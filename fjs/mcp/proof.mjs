/**
 * Host proof of the CAS MCP server: the version it advertises is the
 * package's.
 *
 * A `.mjs` and not a `.f.mjs`: `package.json` is the single source of the
 * package version, and only a host can read it. `casConfig` keeps its
 * version as a literal — the `fjs` CLI imports this module and must not
 * import anything generated — so this proof is what keeps the two spellings
 * equal: a release that bumps one without the other fails here.
 */

import { readFile } from 'node:fs/promises'

import { assertEq } from '../asserts/module.f.js'
import { casConfig } from './module.f.mjs'

export const proof = {
    serverInfoVersion: async () => {
        const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
        assertEq(casConfig.serverInfo.version, version)
    },
}
