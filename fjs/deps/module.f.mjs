/**
 * Checks that every authored FunctionalScript source can form a syntax AST.
 * This is the first dependency-command step: source is read and parsed, with
 * no module execution, import resolution, FJS admission or FAST/EDAG lowering.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../effects/types.ts'
 * @import { NodeProgram, ReadWhole, Write } from '../effects/node/types.ts'
 * @import { _Checked } from './private.ts'
 */

import { allFiles, isAuthored, sourceRoot } from '../dev/module.f.mjs'
import { readSource } from '../compiler/source/module.f.mjs'
import { tokenize } from '../compiler/tokenizer/module.f.mjs'
import { errorLocation } from '../compiler/parser/module.f.mjs'
import { parseSyntax } from '../compiler/parser/syntax/module.f.mjs'
import { error as errorLine, errorExit, errorMessage, log } from '../effects/node/module.f.mjs'
import { foldStep, history, historyStep, mapStep, pure, pureError, pureOk, resultStep, step } from '../effects/module.f.mjs'
import { stringToList } from '../text/utf16/module.f.mjs'

/** Read one source without resolving or evaluating any of its imports. @type {(path: string) => (count: _Checked) => Effect<ReadWhole | Write, _Checked, IoChannel>} */
const checkOne = path => ({ checked, refused }) => {
    const parsed = step(readSource(path), text => pure(parseSyntax(tokenize(stringToList(text))(path))))
    return resultStep(parsed, ([tag, value]) => tag === 'ok'
        ? pureOk({ checked: checked + 1, refused })
        : mapStep(errorLine(`${errorLocation(path)(value)} - error: ${value.message}`), () => ({
            checked: checked + 1, refused: refused + 1,
        })))
}

/** Recursively check the caller's source tree. No arguments or graph output yet. @type {NodeProgram} */
export const main = ({ args, env }) => {
    if (args.length !== 0) { return errorExit('Usage: fjs deps') }
    const files = allFiles(sourceRoot(env), isAuthored)
    const results = foldStep(files, { checked: 0, refused: 0 }, checkOne)
    const reported = historyStep(history(results), ({ checked, refused }) =>
        log(`AST: ${checked - refused} parsed, ${refused} failed, ${checked} total`))
    return resultStep(reported, ([tag, value]) => {
        if (tag === 'error') { return errorExit(errorMessage(value)) }
        const [, { refused }] = value
        return refused === 0 ? pureOk(0) : pureError(1)
    })
}
