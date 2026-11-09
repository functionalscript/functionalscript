/**
 * Native coverage output capture. The parent writes the module label; this
 * boundary emits its status suffix and exposes the child's log only on failure.
 * A shared file descriptor preserves stdout/stderr write order without a
 * capture-buffer limit.
 * @module
 */

import { spawn } from 'node:child_process'
import { closeSync, createReadStream, mkdtempSync, openSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

let announced = false

/** @type {(stream: NodeJS.WriteStream, text: string | Uint8Array) => Promise<void>} */
const write = (stream, text) => new Promise((resolve, reject) => {
    stream.write(text, error => error ? reject(error) : resolve())
})

/** @type {(value: 'Ok' | 'Failed') => Promise<void>} */
const announce = async value => {
    announced = true
    await write(process.stdout, `${value}\n`)
}

/** @type {() => Promise<number>} */
const run = async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fjs-coverage-output-'))
    const log = join(directory, 'output.log')
    /** @type {number | undefined} */
    let descriptor
    let code = 1
    try {
        descriptor = openSync(log, 'w')
        const child = spawn(process.execPath, process.argv.slice(2), { stdio: ['inherit', descriptor, descriptor] })
        /** @type {NodeJS.Signals | null} */
        let interrupted = null
        /** @type {(signal: NodeJS.Signals) => void} */
        const forward = signal => {
            interrupted = signal
            child.kill(signal)
        }
        const onInterrupt = () => forward('SIGINT')
        const onTerminate = () => forward('SIGTERM')
        process.on('SIGINT', onInterrupt)
        process.on('SIGTERM', onTerminate)
        /** @type {Promise<{ readonly code: number | null, readonly signal: NodeJS.Signals | null, readonly interrupted: NodeJS.Signals | null, readonly error: Error | null }>} */
        const ended = new Promise(resolve => {
            /** @type {Error | null} */
            let problem = null
            child.once('error', error => { problem = error })
            child.once('close', (code, signal) => resolve({ code, signal, interrupted, error: problem }))
        })
        const outcome = await ended.finally(() => {
            process.off('SIGINT', onInterrupt)
            process.off('SIGTERM', onTerminate)
        })
        closeSync(descriptor)
        descriptor = undefined
        const signal = outcome.signal ?? outcome.interrupted
        if (outcome.code === 0 && signal === null && outcome.error === null) {
            code = 0
        } else {
            await announce('Failed')
            for await (const chunk of createReadStream(log)) await write(process.stderr, chunk)
            const message = outcome.error !== null ? `error: ${outcome.error.message}`
                : signal !== null ? `terminated by ${signal}` : `exited with code ${outcome.code}`
            await write(process.stderr, `Coverage subprocess ${message}\n`)
            code = outcome.code !== null && outcome.code > 0 ? outcome.code : 1
        }
    } finally {
        try {
            if (descriptor !== undefined) closeSync(descriptor)
        } finally {
            rmSync(directory, { recursive: true, force: true })
        }
    }
    if (code === 0) await announce('Ok')
    return code
}

try {
    process.exitCode = await run()
} catch (error) {
    process.exitCode = 1
    if (!announced) await announce('Failed')
    await write(process.stderr, `Coverage output capture failed: ${error instanceof Error ? error.message : String(error)}\n`)
}
