/**
 * Synchronizes local development configuration generated from canonical repository files.
 *
 * @module
 *
 * @import { IoChannel, Mkdir, NodeProgram, ReadFile, WriteFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */


import { exitStep, mkdir, readUtf8File, writeUtf8File } from '../../effects/node/module.f.mjs'
import { history, historyStep, step } from '../../effects/module.f.mjs'

const source = /** @type {const} */ ('.copilot/mcp.json')
const targetDirectory = /** @type {const} */ ('.vscode')
const target = /** @type {const} */ ('.vscode/mcp.json')

/**
 * Regenerates VS Code's local MCP configuration from the canonical Copilot configuration.
 *
 * The source text is still needed after the directory has been created, so it
 * is carried forward in a history rather than closed over by a nested
 * continuation — and the history holds the text itself, not the `Result` the
 * read returned.
 *
 * @type {() => Effect<Mkdir | ReadFile | WriteFile, void, IoChannel>}
 */
export const syncMcp = () => {
    const sourceText = history(readUtf8File(source))
    const targetDirectoryReady = historyStep(
        sourceText,
        () => mkdir(targetDirectory, { recursive: true }))
    return step(targetDirectoryReady, ([, text]) => writeUtf8File(target, text))
}

/**
 * Runs all local development configuration generators.
 *
 * @type {NodeProgram}
 */
export const main = () => exitStep(syncMcp())
