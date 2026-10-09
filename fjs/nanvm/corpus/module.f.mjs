/**
 * The call-contract corpus: the `nanvm-harness` fixtures, read by more than
 * one executor. A fixture is a source module whose default export reports its
 * own identity, laziness and throws as ordinary values, so the same file can
 * be run by Node (the independent reference), by the FJS interpreter and, as
 * generated Rust, by `nanvm-lib`. See
 * [callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md),
 * Stage 8.
 *
 * Every fixture is in the corpus unless {@link exceptions} names it and says
 * why, so a new fixture is compared by default and an exception cannot be
 * silent.
 *
 * @module
 */

import { fixturesDirectory } from '../harness/module.f.mjs'

export { fixturesDirectory }

/**
 * The fixtures no executor comparison covers, each with its reason. A fixture
 * here is not wrong; it tests something other than the language's value
 * contract.
 *
 * @type {{ readonly [file: string]: string }}
 */
export const exceptions = {
    'function-text.mjs': 'a function\'s text is the specified function-text exception: the reference prints the host\'s source, the executors the shared renderer\'s',
    'function.mjs': 'exports a function as its default, which the harness\'s own call action tests; a language call is observed by a fixture that calls at module level',
    'rest-function.mjs': 'exports a function as its default, which the harness\'s own call action tests; a language call is observed by a fixture that calls at module level',
}

const extension = '.mjs'

/**
 * The corpus: the `.mjs` files of a fixture directory listing that no
 * exception excludes.
 *
 * @type {(names: readonly string[]) => readonly string[]}
 */
export const corpus = names => names.filter(name => name.endsWith(extension) && exceptions[name] === undefined)
