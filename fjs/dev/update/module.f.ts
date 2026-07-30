/**
 * Synchronizes local development configuration generated from canonical repository files.
 *
 * @module
 */
import { mapStep, step, type Effect } from '../../effects/module.f.ts'
import { mkdir, type Mkdir, readUtf8File, type ReadFile, type WriteFile, writeUtf8File } from '../../effects/node/module.f.ts'
import { unwrap } from '../../types/result/module.f.ts'

const source = '.copilot/mcp.json' as const
const targetDirectory = '.vscode' as const
const target = '.vscode/mcp.json' as const

/** Regenerates VS Code's local MCP configuration from the canonical Copilot configuration. */
export const syncMcp = (): Effect<Mkdir | ReadFile | WriteFile, void> => {
    const targetDirectoryReady = mapStep(mkdir(targetDirectory, { recursive: true }), unwrap)
    const sourceText = step(targetDirectoryReady, () => readUtf8File(source))
    const targetWritten = step(sourceText, text => writeUtf8File(target, unwrap(text)))
    return mapStep(targetWritten, unwrap)
}

/** Runs all local development configuration generators. */
export const main = () => mapStep(syncMcp(), () => 0)
