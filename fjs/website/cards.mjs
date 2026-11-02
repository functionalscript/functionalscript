/**
 * The screenshot step: each card page the generator wrote
 * ([`./card`](./card/module.f.mjs)), taken by headless Chromium as the card
 * image its page's `og:image` names.
 *
 * Run from the repository root after `npm run website`:
 *
 * ```sh
 * node ./fjs/website/cards.mjs
 * ```
 *
 * **Chromium over the DevTools protocol, with Node's own `WebSocket`**, so the
 * step adds no npm dependency. `CHROME_PATH` names the browser, and
 * `google-chrome`, which GitHub's Ubuntu runners carry, is the default.
 *
 * **Several tabs at once**, each taking the next card from one queue.
 *
 * **The site is served while it is taken**, from the built tree on a local
 * port, because a card page links the site's stylesheet root-relatively, as
 * every page does.
 *
 * @module
 */

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { cardPagePath, cardSize, cardsPath } from './card/module.f.mjs'
import { cardImageName } from './page/module.f.mjs'
import { concat as pathConcat } from '../path/module.f.js'

/** @type {Readonly<Record<string, string>>} */
const types = {
    '.css': 'text/css',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
}

/**
 * Serves the tree under `root` on a free local port.
 *
 * @type {(root: string) => Promise<{ readonly origin: string, readonly close: () => void }>}
 */
const serve = root => new Promise(ready => {
    const server = createServer(async (request, response) => {
        const file = resolve(root, `.${decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)}`)
        try {
            if (!file.startsWith(root + sep)) { throw new Error('outside the tree') }
            const body = await readFile(file)
            response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body)
        } catch {
            response.writeHead(404).end()
        }
    })
    server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (address === null || typeof address === 'string') { throw new Error('no port') }
        ready({ origin: `http://127.0.0.1:${address.port}`, close: () => server.close() })
    })
})

/**
 * Starts the browser and answers the address of its DevTools endpoint, and
 * how to stop it, which waits until it has exited.
 *
 * @type {(profile: string) => Promise<{ readonly url: string, readonly stop: () => Promise<void> }>}
 */
const launch = profile => new Promise((ready, fail) => {
    const browser = spawn(process.env.CHROME_PATH ?? 'google-chrome', [
        '--headless', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    const exited = new Promise(done => browser.once('exit', () => done(undefined)))
    browser.once('error', fail)
    let output = ''
    browser.stderr.setEncoding('utf8').on('data', chunk => {
        output += chunk
        const line = output.split('\n').find(l => l.startsWith('DevTools listening on '))
        if (line !== undefined) {
            ready({ url: line.slice('DevTools listening on '.length).trim(), stop: () => { browser.kill(); return exited } })
        }
    })
    exited.then(() => fail(new Error(`the browser exited before it listened:\n${output}`)))
})

/**
 * A DevTools protocol session over `socket`: a command answers its result,
 * and an event can be waited for.
 *
 * **A closed socket fails everything waiting on it**, and every command sent
 * after: a browser that crashes mid-run answers nothing more, and a wait it
 * left pending would otherwise hold the step until the job's timeout.
 *
 * @type {(socket: WebSocket) => { readonly send: (method: string, params?: object, sessionId?: string) => Promise<any>, readonly next: (method: string, sessionId: string) => Promise<any> }}
 */
const devtools = socket => {
    /** @type {Map<number, { resolve: (result: any) => void, reject: (e: Error) => void }>} */
    const pending = new Map()
    /** @type {{ method: string, sessionId: string, resolve: (params: any) => void, reject: (e: Error) => void }[]} */
    let waiting = []
    /** @type {Error | null} */
    let closed = null
    let id = 0
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(String(data))
        const command = pending.get(message.id)
        if (command !== undefined) {
            pending.delete(message.id)
            if (message.error === undefined) { command.resolve(message.result) } else { command.reject(new Error(message.error.message)) }
            return
        }
        const i = waiting.findIndex(w => w.method === message.method && w.sessionId === message.sessionId)
        if (i >= 0) { waiting.splice(i, 1)[0].resolve(message.params) }
    })
    socket.addEventListener('close', () => {
        const error = new Error('the browser closed the DevTools connection')
        closed = error
        pending.forEach(command => command.reject(error))
        pending.clear()
        waiting.forEach(w => w.reject(error))
        waiting = []
    })
    return {
        send: (method, params = {}, sessionId) => new Promise((resolve, reject) => {
            if (closed !== null) { reject(closed); return }
            id += 1
            pending.set(id, { resolve, reject })
            socket.send(JSON.stringify({ id, method, params, sessionId }))
        }),
        next: (method, sessionId) => new Promise((resolve, reject) => {
            if (closed !== null) { reject(closed); return }
            waiting.push({ method, sessionId, resolve, reject })
        }),
    }
}

/** @type {(url: string) => Promise<WebSocket>} */
const connect = url => new Promise((ready, fail) => {
    const socket = new WebSocket(url)
    socket.addEventListener('open', () => ready(socket))
    socket.addEventListener('error', () => fail(new Error(`cannot connect to ${url}`)))
})

/**
 * How many cards are taken at once, each in a tab of its own: GitHub's
 * standard Linux runner has four cores. `CARD_TABS` overrides it.
 *
 * @type {number}
 */
const tabs = Number(process.env.CARD_TABS ?? 4)

/**
 * Screenshots each card in `cards`, served at `origin`, through the browser
 * whose DevTools endpoint is `url`.
 *
 * @type {(url: string, origin: string, cards: readonly string[]) => Promise<void>}
 */
const shoot = async (url, origin, cards) => {
    const socket = await connect(url)
    try {
        const { send, next } = devtools(socket)
        // Every tab takes the next card from one shared queue, so a card
        // waiting on a slow image holds up its own tab and no other.
        const queue = cards.values()
        await Promise.all(Array.from({ length: tabs }, async () => {
            const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
            const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
            await send('Page.enable', {}, sessionId)
            await send('Emulation.setDeviceMetricsOverride', { ...cardSize, deviceScaleFactor: 1, mobile: false }, sessionId)
            await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, sessionId)
            for (const path of queue) {
                // Parsed, not loaded: the load event waits for every image,
                // where `cardReady` waits for each five seconds at most. The
                // card's script, after its stylesheet, has run by now.
                const parsed = next('Page.domContentEventFired', sessionId)
                // Handled at once: should the navigation fail first, its
                // rejection is the error, and this one is not left unhandled.
                parsed.catch(() => undefined)
                await send('Page.navigate', { url: `${origin}/${cardPagePath(path)}` }, sessionId)
                await parsed
                const ready = await send('Runtime.evaluate', { expression: 'window.cardReady.then(() => true)', awaitPromise: true }, sessionId)
                if (ready.exceptionDetails !== undefined) { throw new Error(`${path}: ${ready.exceptionDetails.text}`) }
                const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
                await writeFile(pathConcat(path)(cardImageName), Buffer.from(data, 'base64'))
            }
        }))
    } finally {
        socket.close()
    }
}

/**
 * The whole step. Each resource is released by its own `finally`, as soon
 * as it is acquired, so a browser that fails to start or to connect still
 * leaves no server holding the process open, no browser running and no
 * profile behind: the step fails at once rather than at the job's timeout.
 *
 * @type {() => Promise<void>}
 */
const main = async () => {
    /** @type {readonly string[]} */
    const cards = JSON.parse(await readFile(cardsPath, 'utf8'))
    const server = await serve(process.cwd())
    try {
        const profile = await mkdtemp(join(tmpdir(), 'cards-'))
        try {
            const browser = await launch(profile)
            try {
                await shoot(browser.url, server.origin, cards)
            } finally {
                await browser.stop()
            }
        } finally {
            // A killed browser's helpers can still be writing here for a
            // moment, so the removal retries rather than fail the step.
            await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
        }
    } finally {
        server.close()
    }
    console.log(`cards: ${cards.length}`)
}

try {
    await main()
} catch (e) {
    console.error(`Card images failed: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
}
