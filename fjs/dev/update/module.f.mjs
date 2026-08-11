/**
 * Synchronizes local development configuration generated from canonical repository files.
 *
 * @module
 */
import { history, historyStep, mapStep, step } from '../../effects/module.f.mjs'
/** @import { Effect } from '../../effects/types.ts' */
import { mkdir, readUtf8File, writeUtf8File } from '../../effects/node/module.f.mjs'
/** @import { Mkdir, NodeProgram, ReadFile, WriteFile } from '../../effects/node/types.ts' */
import { unwrap } from '../../types/result/module.f.mjs'

const source = /** @type {const} */ ('.copilot/mcp.json')
const targetDirectory = /** @type {const} */ ('.vscode')
const target = /** @type {const} */ ('.vscode/mcp.json')

/**
 * Regenerates VS Code's local MCP configuration from the canonical Copilot configuration.
 *
 * @type {() => Effect<Mkdir | ReadFile | WriteFile, void>}
 */
export const syncMcp = () => {
    const sourceText = history(mapStep(readUtf8File(source), unwrap))
    const targetDirectoryReady = historyStep(
        sourceText,
        () => mapStep(mkdir(targetDirectory, { recursive: true }), unwrap))
    const targetWritten = step(targetDirectoryReady, ([, text]) => writeUtf8File(target, text))
    return mapStep(targetWritten, unwrap)
}

/**
 * Runs all local development configuration generators.
 *
 * @type {NodeProgram}
 */
export const main = () => mapStep(syncMcp(), () => 0)
