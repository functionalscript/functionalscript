/**
 * Every corpus fixture, run by Node and by the FJS interpreter, must answer
 * the same value or both throw. Node is the reference; the interpreter is the
 * represented route `fjs compile` takes for a data output.
 */

import { readdirSync, readFileSync } from 'node:fs'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { _transpileDefaultWith } from '../../compiler/transpiler/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { vm } from '../../edag/amnesia/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import runtimeEdag from '../../js/runtime/gen.edag.data.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { corpus, exceptions, fixturesDirectory, undefinedDefault, withAliasing } from './module.f.mjs'

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

/**
 * The runtime the interpreter answers `startsWith` from: `fjs/js/runtime`'s
 * EDAG, which `npm run gen` writes beside its source, evaluated to its
 * export object and read for `runtime`, as `../proof.f.mjs` does.
 *
 * @type {import('../../edag/value/types.ts').Runtime}
 */
const runtime = /** @type {import('../../edag/value/types.ts').Runtime} */ (assertOk(read(
    vm({ frame: [], args: [] })(/** @type {import('../../edag/types.ts').Exp} */ (/** @type {unknown} */ (runtimeEdag))),
    'runtime')))

/**
 * What the interpreter makes of it, in the same shapes, under the runtime.
 * Only the error a module's own initialization raises is a throw; a parser
 * or loader error carries no `thrown` and stays a failure, so a fixture the
 * interpreter never ran cannot pass as one that throws.
 *
 * @type {(name: string) => readonly [string, unknown?]}
 */
const interpreted = name => {
    const [, result] = virtual({ ...emptyState, root })(_transpileDefaultWith(pureOk(runtime))(name))
    if (result[0] === 'error') {
        return 'thrown' in result[1] ? ['throws'] : ['failed', result[1]]
    }
    const [tag, value] = result[1]
    return tag === 'ok' ? ['ok', value] : ['refused', value]
}

/** @type {(outcome: readonly [string, unknown?]) => readonly [string, unknown?]} */
const aliased = ([tag, value]) => tag === 'ok' ? [tag, withAliasing(value)] : [tag, value]

export const proof = {
    /** An exception for a fixture that is gone would excuse nothing. */
    exceptionsNameFixtures: () => {
        for (const file of Object.keys(exceptions)) { assert(names.includes(file), file) }
    },
    /** An `undefinedDefault` entry for a fixture that is gone would excuse nothing. */
    undefinedDefaultNamesFixtures: () => {
        for (const file of Object.keys(undefinedDefault)) { assert(names.includes(file), file) }
    },
    /** Each `undefined` default is listed, and each listed one still is. */
    undefinedDefaultsAreListed: async () => {
        for (const name of corpus(names)) {
            const [tag, value] = await reference(name)
            assertEq(tag === 'ok' && value === undefined, undefinedDefault[name] !== undefined, name)
        }
    },
    /** The interpreter answers what Node answers, or both throw. */
    compared: Object.fromEntries(corpus(names).map(name => [name, async () => {
        assertStructurallySame(aliased(interpreted(name)), aliased(await reference(name)))
    }])),
}
