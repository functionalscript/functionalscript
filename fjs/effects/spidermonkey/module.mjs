/**
 * The SpiderMonkey shell's host for `fjs` programs: a partial Node host.
 *
 * It runs a `NodeProgram` through {@link asyncPartialRun} over
 * `nodeCommands` with the operations `fjs t` and `fjs compile` need and no
 * others: `sandbox` and `catch` from `commonOperationMap`, `all` from the
 * runner itself, which answers it because `nodeCommands` name it, and
 * `readdir`, `import`, `resolveFileModule`, `readWhole`, `mkdir`, `rm`,
 * `writeFile`, `writeBytes`, and `write` here. Every other Node operation
 * answers `NotImplemented`, so another `fjs` command fails naming what this
 * host lacks. The program sees `engine: 'spidermonkey'`, which is how `fjs t`
 * knows to load authored proofs only. `npm run sm <command>` runs an `fjs`
 * command through it, and `npm run sm t` runs `fjs t`.
 *
 * The shell is not a browser and not Node. It has `print`, `putstr`,
 * `printErr`, `quit`, `scriptArgs`, `os.getenv`, `os.system`,
 * `os.file.listDir`, `os.file.readFile`, `os.file.writeTypedArrayToFile`, and
 * `import()` of an absolute path. It has no `URL`, `TextEncoder`,
 * `TextDecoder`, `setTimeout`, `stat`, `mkdir`, `rm`, positional write, or
 * way to read the working directory. Each handler below says which of those
 * it works around. Its command line passes arguments after `--` only:
 * `js --module run.mjs a b` runs `a` as a second script.
 *
 * @module
 *
 * @import { NodeOp, NodeProgram, NodeProgramOptions } from '../node/types.ts'
 * @import { WriteConsoles } from '../common/types.ts'
 * @import { Effect } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Shell } from './types.ts'
 */

import { asyncPartialRun, io } from '../module.mjs'
import { commonOperationMap } from '../common/module.mjs'
import { _maxVecBytes, exitCode, nodeCommands } from '../node/module.f.mjs'
import { _orderDirents } from '../node/virtual/readdir/module.f.mjs'
import { concat, normalize } from '../../path/module.f.mjs'
import { resolve as resolveImportPath } from '../../path/import/module.f.mjs'
import { fromVec, toVec } from '../../types/uint8array/module.f.mjs'
import { tryShellQuote } from '../../text/shell/module.f.js'
import { utf8ToString } from '../../text/utf8/module.f.mjs'
import { ok } from '../../types/result/module.f.js'


const shell = /** @type {Shell} */ (/** @type {unknown} */ (globalThis))
const { getenv } = shell.os
const { listDir } = shell.os.file

/**
 * Whether `path` is a directory. The shell has no `stat`, so a directory is
 * whatever `listDir` can list. A symbolic link to a directory reads as one,
 * where Node's `Dirent` says it is neither; the repository tracks no links. A
 * directory `listDir` may not list reads as a file, so discovery skips it
 * where Node fails: see ./todo/unlistable-directory.md.
 *
 * @type {(path: string) => boolean}
 */
const isDirectory = path => {
    try {
        listDir(path)
        return true
    } catch {
        return false
    }
}

/**
 * The working directory, as the caller's shell exported it. SpiderMonkey cannot
 * read its own, and `import()` resolves a relative path against the importing
 * file rather than the working directory. Under `npm run`, `INIT_CWD` is
 * absolute, so every path discovery imports is absolute and this goes unread.
 */
const cwd = getenv('PWD')

/** @type {(path: string) => string} */
const absolute = path => {
    if (path.startsWith('/')) { return path }
    if (cwd === undefined) { throw new Error(`PWD is not set, so ${path} has no directory to resolve against`) }
    return concat(cwd)(path)
}

/**
 * Runs `command` on one path through the shell's `os.system`, which hands a
 * command line to the system shell and answers its raw wait status: the
 * shell has no other way to make a directory or remove a file. The path goes
 * after `--` as one quoted word, so no character of it is the shell's and a
 * name that looks like an option is still a name. A status other than `0` is
 * a failure, named with the status. The tool's own complaint goes nowhere:
 * the failure is the program's to report, as the Node host's are, and
 * `writeChunks` discards a failed cleanup on purpose.
 *
 * Calling an external tool from our code waits on approval
 * ([AGENTS.md §6](../../../AGENTS.md#6-external-tools)); the owner approved
 * `mkdir` and `rm` for this host. It is POSIX, as the rest of the host is.
 *
 * @type {(command: string, path: string) => void}
 */
const onPath = (command, path) => {
    const word = tryShellQuote(path)
    if (word === null) { throw new Error(`a path holding NUL cannot reach a shell: ${JSON.stringify(path)}`) }
    const status = shell.os.system(`${command} -- ${word} 2>/dev/null`)
    if (status !== 0) { throw new Error(`\`${command}\` failed with wait status ${status}: ${path}`) }
}

/**
 * Stderr's unfinished line. `printErr` ends every call with a newline, so text
 * is held until its line ends, and {@link run} prints what is left at exit.
 */
let errLine = ''

/** @type {(stream: WriteConsoles, text: string) => void} */
const writeText = (stream, text) => {
    if (stream === 'stdout') {
        shell.putstr(text)
        return
    }
    const lines = (errLine + text).split('\n')
    errLine = lines.pop() ?? ''
    for (const line of lines) { shell.printErr(line) }
}

/** @type {<T, E>(effect: Effect<NodeOp, T, E>) => Promise<Result<T, E>>} */
const runShellEffect = asyncPartialRun(nodeCommands)({
    ...commonOperationMap,
    readdir: (path, { recursive }) => io(async () => {
        if (recursive === true) { throw new Error('a recursive readdir is not implemented in the SpiderMonkey shell') }
        const parentPath = normalize(path)
        return _orderDirents(
            // `listDir` lists `.` and `..` too, which Node's `readdir` never
            // does: a walk taking them for subdirectories would not end.
            listDir(path).filter(name => name !== '.' && name !== '..').map(name => {
                const directory = isDirectory(concat(path)(name))
                return { name, parentPath, isFile: !directory, isDirectory: directory }
            }),
            () => [])
    }),
    import: path => io(() => import(absolute(path))),
    // Lexical, as the virtual host resolves: the shell has neither `URL` nor
    // `realpath`, so a module's identity is its normalized absolute path, and
    // a module reached through two symbolic links would be two modules. The
    // repository tracks no links.
    resolveFileModule: (name, parent) => io(async () => {
        const path = parent === null ? absolute(name) : resolveImportPath(parent)(name)
        if (path === null) { throw new Error('invalid module specifier') }
        return { id: normalize(path), path }
    }),
    // In `Vec` windows of the most bytes one holds, as the Node host reads. A
    // directory is refused first: the shell reads one as "too large for a
    // Uint8Array". Nothing else can be: without `stat`, a FIFO passes, and one
    // no process writes to blocks the read (./todo/unlistable-directory.md).
    readWhole: path => io(async () => {
        if (isDirectory(path)) { throw new Error(`${path} is not a file`) }
        const bytes = shell.os.file.readFile(path, 'binary')
        /** @type {readonly Uint8Array[]} */
        const windows = Array.from({ length: Math.ceil(bytes.length / _maxVecBytes) },
            (_, i) => bytes.subarray(i * _maxVecBytes, (i + 1) * _maxVecBytes))
        return windows.map(toVec)
    }),
    mkdir: (path, options) => io(async () => { onPath(options?.recursive === true ? 'mkdir -p' : 'mkdir', path) }),
    rm: path => io(async () => { onPath('rm', path) }),
    writeFile: (path, data) => io(async () => { shell.os.file.writeTypedArrayToFile(path, fromVec(data)) }),
    // The shell replaces a file whole and has no positional write, so the file
    // is read, the bytes laid over it at `offset`, and the result written
    // back. It costs the file's size per call, which `writeChunks` pays once
    // per 128 KiB chunk. The `offset` and size were checked before the host
    // was asked.
    writeBytes: (path, offset, data) => io(async () => {
        // A directory reads as "too large for a Uint8Array"; a missing file
        // fails the read, as `writeBytes` never creates one.
        if (isDirectory(path)) { throw new Error(`${path} is not a file`) }
        const before = shell.os.file.readFile(path, 'binary')
        const bytes = fromVec(data)
        // Writing nothing changes nothing, at any offset: laying no bytes
        // past the end would still grow the file.
        if (bytes.length === 0) { return }
        // Where Node leaves a hole, this would hold the whole gap in memory,
        // gigabytes for a far offset, so a write must start inside the file or
        // at its end, which is where every caller writes
        // (./todo/sparse-write.md).
        if (offset > before.length) {
            throw new Error(`the SpiderMonkey shell cannot write past the end of a file: offset ${offset}, size ${before.length}: ${path}`)
        }
        const after = new Uint8Array(Math.max(before.length, offset + bytes.length))
        after.set(before)
        after.set(bytes, offset)
        shell.os.file.writeTypedArrayToFile(path, after)
    }),
    write: async (stream, data) => {
        // `utf8ToString` because the shell has no `TextDecoder`.
        writeText(stream, utf8ToString(data))
        return ok(undefined)
    },
})

/** @type {(name: string) => string} */
const required = name => {
    const value = getenv(name)
    if (value === undefined) { throw new Error(`${name} is not set`) }
    return value
}

/**
 * The variables the programs this host runs read: `INIT_CWD`, where discovery
 * starts, and `GITHUB_ACTIONS`, which picks the reporter's format. The shell
 * reads a variable by name only, so `env` holds these and no others.
 */
const envNames = ['INIT_CWD', 'GITHUB_ACTIONS']

/**
 * This file's path. The shell's `import.meta.url` is a plain path rather than a
 * `file:` URL; anything else is refused rather than misread.
 */
const self = import.meta.url
if (!self.startsWith('/')) { throw new Error(`import.meta.url is not an absolute path: ${self}`) }

/** @type {NodeProgramOptions} */
const options = {
    args: shell.scriptArgs,
    env: Object.fromEntries(envNames.flatMap(name => {
        const value = getenv(name)
        return value === undefined ? [] : [[name, value]]
    })),
    home: required('HOME'),
    // The shell cannot tell whether a stream is a terminal, so output is plain.
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
    testContext: { test: () => Promise.reject(new Error('the SpiderMonkey shell has no test framework to register with')) },
    // this file is `fjs/effects/spidermonkey/module.mjs` of the package it runs from
    packageRoot: concat(self)('../../../..'),
    engine: 'spidermonkey',
}

/**
 * Runs a `NodeProgram` in the shell and ends the shell with its exit code.
 *
 * @type {(program: NodeProgram) => Promise<never>}
 */
export const run = async program => {
    const code = exitCode(await runShellEffect(program(options)))
    if (errLine !== '') { shell.printErr(errLine) }
    return shell.quit(code)
}
