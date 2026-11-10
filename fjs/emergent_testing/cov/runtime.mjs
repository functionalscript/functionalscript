/** Native execution facts and the FunctionalScript tool version. @module */

import { readFileSync } from 'node:fs'
import process from 'node:process'

const version = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))?.version
if (typeof version !== 'string' || version.length === 0) {
    throw new Error('FunctionalScript package.json must contain a nonempty version')
}

const env = Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'LANG', 'LC_ALL', 'TZ']
    .map(name => [name, process.env[name] ?? null]))

process.stdout.write(JSON.stringify({
    functionalscript: version,
    node: process.versions.node,
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
    env,
}) + '\n')
