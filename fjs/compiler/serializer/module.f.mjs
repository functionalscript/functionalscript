/**
 * Public source and function-text output. Admission happens once at this
 * boundary; common graph conversion and preparation own every execution
 * decision. Target serializers receive prepared FAST only.
 *
 * @module
 * @import { Analysis, Ref } from '../../edag/analysis/types.ts'
 * @import { Exp } from '../../edag/types.ts'
 * @import { Document } from './types.ts'
 */

import { _defaultExport, _moduleExports, _moduleThrows } from '../edag/module.f.mjs'
import { keywords, literalWords, reservedGlobals } from '../../js/keywords/module.f.js'
import { checked, identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { isIntrinsic } from '../../edag/module.f.mjs'
import { fromAnalysis, functionFromAnalysis } from '../../edag/to_fast/module.f.mjs'
import { sourceReason } from '../../edag/to_fast/source/module.f.mjs'
import { prepare, prepareFunction } from '../../js/ast/prepare/module.f.mjs'
import { functionStringify, render, renderModule } from '../../js/ast/serializer/module.f.mjs'
import { isIdentifier } from '../../js/identifier/module.f.mjs'
import { chunkStrings, chunksMarked, chunksText, fromTagged, withNames } from '../../text/marked/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.js'
import { _entryText, _hasEntryText, _intrinsicText } from '../../js/ast/serializer/intrinsic/module.f.mjs'
import { _resolve } from './names/module.f.mjs'

const reservedExports = new Set([...keywords, ...literalWords, ...reservedGlobals, 'then'])

/** Tagged lexical output as the established chunk API. @type {(text: string) => Document} */
const chunks = text => mapOk((/** @type {import('../../text/marked/types.ts').Marked} */ runs) => runs.map(run => run[1] === undefined ? run[0] : run))(fromTagged(text))

/** Source admission and graph placement, each exactly once. @type {(e: Exp, module?: boolean) => Document} */
const source = (e, module = false) => okThen(a => {
    const fast = fromAnalysis(a)
    const why = sourceReason(a, fast, module)
    return why === null ? chunks(module ? renderModule(prepare(fast)) : render(prepare(fast))) : error(why)
})(okThen(checked)(identityAnalysis(e)))

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
    const node = a.nodes[i]
    if (node[0] === 'entry') { return chunksText(_resolve([_entryText('function')])) }
    if (node[0] === 'hasEntry') { return chunksText(_resolve([_hasEntryText('function')])) }
    if (isIntrinsic(node)) { return chunksText(_resolve([_intrinsicText(node[0])('function')])) }
    return functionStringify(prepareFunction(functionFromAnalysis(a, i)))
}

/** Checked code-only text for a supplied graph function. @type {(e: Exp) => import('../../types/result/types.ts').Result<string, string>} */
export const tryFunctionText = e => {
    if (!(e instanceof Array) || (e[0] !== '=>' && e[0] !== 'entry' && e[0] !== 'hasEntry' && !isIntrinsic(e))) { return error('not a function') }
    return okThen(a => {
        const i = /** @type {Ref} */ (a.root)[1]
        return mapOk(table => functionText(table, i))(checked(a, i))
    })(identityAnalysis(e))
}

/** A graph namespace as source preserving every exported name. @type {(e: Exp) => Document} */
export const _tryModuleSerialize = e => {
    if (_moduleThrows(e)) { return _trySerialize(e) }
    const members = _moduleExports(e)
    if (members.length === 0) { return error('a module without exports') }
    const keys = members.map(([, key]) => key)
    if (new Set(keys).size !== keys.length) { return error('duplicate export names') }
    if (keys.some(key => key !== 'default' && (!isIdentifier(key) || reservedExports.has(key)))) { return error('an unsupported export name') }
    if (keys.length === 1 && keys[0] === 'default') {
        const compact = _trySerialize(_defaultExport(e))
        if (compact[0] === 'ok') { return compact }
    }
    return source(e, true)
}

/** Plain chunks of a named-export module. @type {(e: Exp) => import('../../types/result/types.ts').Result<import('../../types/list/types.ts').List<string>, string>} */
export const tryModuleSerialize = e => mapOk(chunkStrings)(_tryModuleSerialize(e))

/** The named-export module's token marks. @type {(e: Exp) => import('../../types/result/types.ts').Result<import('../../text/marked/types.ts').Marked, string>} */
export const tryModuleMarked = e => mapOk(value => withNames(chunksMarked(value)))(_tryModuleSerialize(e))

/** The named-export source as one string. @type {(e: Exp) => import('../../types/result/types.ts').Result<string, string>} */
export const tryModuleStringify = e => mapOk(chunksText)(_tryModuleSerialize(e))
