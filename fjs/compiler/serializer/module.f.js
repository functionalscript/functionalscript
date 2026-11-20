/**
 * Public source and function-text output. Admission happens once at this
 * boundary; common graph conversion and preparation own every execution
 * decision. Target serializers receive prepared FAST only.
 *
 * @module
 * @import { Analysis, Ref } from '../../edag/analysis/types.ts'
 * @import { Exp } from '../../edag/types.ts'
 * @import { Document } from './types.ts'
 * @import { Refusal } from '../../edag/to_fast/source/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Chunk, Marked } from '../../text/marked/types.ts'
 * @import { Block } from '../../js/ast/types.ts'
 */

import { _defaultExport, _moduleExports, _moduleThrows } from '../edag/module.f.js'
import { keywords, literalWords, reservedGlobals } from '../../js/keywords/module.f.js'
import { checked, identityAnalysis } from '../../edag/analysis/module.f.js'
import { isFunctionNode, isHelper } from '../../edag/module.f.js'
import { fromAnalysis, functionFromAnalysis } from '../../edag/to_fast/module.f.js'
import { sourceRefusal } from '../../edag/to_fast/source/module.f.js'
import { _sourceLoops } from '../../edag/to_fast/source/loops/module.f.js'
import { prepare, prepareFunction } from '../../js/ast/prepare/module.f.js'
import { functionStringify, render, renderModule } from '../../js/ast/serializer/module.f.js'
import { isIdentifier } from '../../js/identifier/module.f.js'
import { chunkStrings, chunksMarked, chunksText, fromTagged, withNames } from '../../text/marked/module.f.js'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.js'
import { _helperText } from '../../js/ast/serializer/intrinsic/module.f.js'
import { _resolve } from '../../js/ast/serializer/names/module.f.js'

/** @type {readonly string[]} */
const reservedExports = [...keywords, ...literalWords, ...reservedGlobals, 'then']

/** Tagged lexical output as the established chunk API. @type {(text: string) => Document} */
const chunks = text => mapOk((/** @type {import('../../text/marked/types.ts').Marked} */ runs) => runs.map(run => run[1] === undefined ? run[0] : run))(fromTagged(text))

/** A refusal of no one node. @type {<T>(result: Result<T, string>) => Result<T, Refusal>} */
export const unlocated = result => result[0] === 'ok' ? result : error([result[1], null])

/** The reason alone. @type {<T>(result: Result<T, Refusal>) => Result<T, string>} */
const reasonOf = result => result[0] === 'ok' ? result : error(result[1][0])

/**
 * Source admission and graph placement, each exactly once. A refusal names
 * the graph's node it is of, where it is of one.
 *
 * @type {(e: Exp, module?: boolean) => Result<List<Chunk>, Refusal>}
 */
const located = (e, module = false) => okThen((/** @type {Analysis} */ a) => {
    return okThen((/** @type {Block} */ fast) => {
        const why = sourceRefusal(a, fast, module)
        return why === null ? unlocated(chunks(module ? renderModule(prepare(fast, { sourceLoops: true })) : render(prepare(fast, { sourceLoops: true })))) : error(why)
    })(unlocated(_sourceLoops(fromAnalysis(a))))
})(unlocated(okThen(checked)(identityAnalysis(e))))

/** @type {(e: Exp, module?: boolean) => Document} */
const source = (e, module = false) => reasonOf(located(e, module))

/** A value graph as a FunctionalScript default-export module. @type {(e: Exp) => Document} */
export const _trySerialize = e => source(e)

/** Plain chunks of {@link _trySerialize}. @type {(e: Exp) => import('../../types/result/types.ts').Result<import('../../types/list/types.ts').List<string>, string>} */
export const trySerialize = e => mapOk(chunkStrings)(_trySerialize(e))

/** Marked source from the same token spelling as plain output. @type {(e: Exp) => import('../../types/result/types.ts').Result<import('../../text/marked/types.ts').Marked, string>} */
export const tryMarked = e => mapOk(value => withNames(chunksMarked(value)))(_trySerialize(e))

/** A default-export source module as one string. @type {(e: Exp) => import('../../types/result/types.ts').Result<string, string>} */
export const tryStringify = e => mapOk(chunksText)(_trySerialize(e))

/**
 * Code-only function text from an admitted identity table. Captures retain
 * their positional external names; no surrounding captured value is rendered.
 *
 * @type {(a: Analysis, i: number) => string}
 */
export const functionText = (a, i) => {
    const node = a.nodes[Number(i)]
    if (isHelper(node)) { return chunksText(_resolve([_helperText(node[0])('function')])) }
    return functionStringify(prepareFunction(functionFromAnalysis(a, i)))
}

/** Checked code-only text for a supplied graph function. @type {(e: Exp) => import('../../types/result/types.ts').Result<string, string>} */
export const tryFunctionText = e => {
    if (!isFunctionNode(e)) { return error('not a function') }
    return okThen(a => {
        const i = /** @type {Ref} */ (a.root)[1]
        return mapOk(table => functionText(table, i))(checked(a, i))
    })(identityAnalysis(e))
}

/** A graph namespace as source preserving every exported name, a refusal with its node. @type {(e: Exp) => Result<List<Chunk>, Refusal>} */
const locatedModule = e => {
    if (_moduleThrows(e)) { return located(e) }
    const members = _moduleExports(e)
    if (members.length === 0) { return error(['a module without exports', null]) }
    const keys = members.map(([, key]) => key)
    const sorted = keys.toSorted()
    if (sorted.some((key, index) => index > 0 && key === sorted[Number(index - 1)])) { return error(['duplicate export names', null]) }
    if (keys.some(key => key !== 'default' && (!isIdentifier(key) || reservedExports.includes(key)))) { return error(['an unsupported export name', null]) }
    if (keys.length === 1 && keys[0] === 'default') {
        const compact = located(_defaultExport(e))
        if (compact[0] === 'ok') { return compact }
    }
    return located(e, true)
}

/** A graph namespace as source preserving every exported name. @type {(e: Exp) => Document} */
export const _tryModuleSerialize = e => reasonOf(locatedModule(e))

/**
 * The named-export module's token marks, or why it has no spelling and the
 * node of the graph that is refused, where the refusal is of one node. A
 * caller that linked the graph can say which file that node came from.
 *
 * @type {(e: Exp) => Result<Marked, Refusal>}
 */
export const tryModuleLocated = e => mapOk((/** @type {List<Chunk>} */ value) => withNames(chunksMarked(value)))(locatedModule(e))

/** Plain chunks of a named-export module. @type {(e: Exp) => import('../../types/result/types.ts').Result<import('../../types/list/types.ts').List<string>, string>} */
export const tryModuleSerialize = e => mapOk(chunkStrings)(_tryModuleSerialize(e))

/** The named-export module's token marks. @type {(e: Exp) => import('../../types/result/types.ts').Result<import('../../text/marked/types.ts').Marked, string>} */
export const tryModuleMarked = e => mapOk(value => withNames(chunksMarked(value)))(_tryModuleSerialize(e))

/** The named-export source as one string. @type {(e: Exp) => import('../../types/result/types.ts').Result<string, string>} */
export const tryModuleStringify = e => mapOk(chunksText)(_tryModuleSerialize(e))
