/**
 * Synchronizes local development configuration generated from canonical repository files.
 *
 * @module
 */
import { history, historyStep, mapStep, step } from '../../effects/module.f.mjs'
import type { Effect } from '../../effects/types.ts'
import { mkdir, readUtf8File, writeUtf8File } from '../../effects/node/module.f.mjs'
import type { Mkdir, NodeProgram, ReadFile, WriteFile } from '../../effects/node/types.ts'
import { unwrap } from '../../types/result/module.f.mjs'

const source = '.copilot/mcp.json' as const
const targetDirectory = '.vscode' as const
const target = '.vscode/mcp.json' as const

/** Regenerates VS Code's local MCP configuration from the canonical Copilot configuration. */
export const syncMcp = (): Effect<Mkdir | ReadFile | WriteFile, void> => {
    const sourceText = history(mapStep(readUtf8File(source), unwrap))
    const targetDirectoryReady = historyStep(
        sourceText,
        () => mapStep(mkdir(targetDirectory, { recursive: true }), unwrap))
    const targetWritten = step(targetDirectoryReady, ([, text]) => writeUtf8File(target, text))
    return mapStep(targetWritten, unwrap)
}

/** Runs all local development configuration generators. */
export const main: NodeProgram = () => mapStep(syncMcp(), () => 0)
