/**
 * Every corpus fixture, run by Node and by the FJS interpreter, must answer
 * the same value or both throw. Node is the reference; the interpreter is the
 * represented route `fjs compile` takes for a data output.
 */

import { readdirSync, readFileSync } from 'node:fs'

import { assert, assertStructurallySame } from '../../asserts/module.f.mjs'
import { _transpileDefault } from '../../compiler/transpiler/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { corpus, exceptions, fixturesDirectory } from './module.f.mjs'

const names = readdirSync(fixturesDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)

const root = Object.fromEntries(names
    .filter(name => name.endsWith('.mjs'))
    .map(name => [name, [utf8(readFileSync(`${fixturesDirectory}/${name}`, 'utf8'))]]))

/** What Node makes of a fixture: its default export, or that it throws. @type {(name: string) => Promise<readonly [string, unknown?]>} */
const reference = async name => {
    try {
        return ['ok', (await import(`../../../${fixturesDirectory}/${name}`)).default]
    } catch {
        return ['throws']
    }
}

/** What the interpreter makes of it, in the same shapes. @type {(name: string) => readonly [string, unknown?]} */
const interpreted = name => {
    const [, result] = virtual({ ...emptyState, root })(_transpileDefault(name))
    if (result[0] === 'error') { return ['throws'] }
    const [tag, value] = result[1]
    return tag === 'ok' ? ['ok', value] : ['refused', value]
}

export const proof = {
    /** An exception for a fixture that is gone would excuse nothing. */
    exceptionsNameFixtures: () => {
        for (const file of Object.keys(exceptions)) { assert(names.includes(file), file) }
    },
    /** The interpreter answers what Node answers, or both throw. */
    compared: Object.fromEntries(corpus(names).map(name => [name, async () => {
        assertStructurallySame(interpreted(name), await reference(name))
    }])),
}
