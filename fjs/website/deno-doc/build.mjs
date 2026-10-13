/**
 * Host boundary for the official Deno CLI and its generated files. Discovery,
 * mapping and the additive return link are pure policies in module.f.mjs.
 */

import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

import { cmp } from '../../types/string/module.f.mjs'
import { deno } from '../../ci/config/module.f.js'
import { rustdocFooter, rustdocHead, rustdocHeader } from '../cargo-doc/module.f.mjs'
import { fundingPath, parse as parseFunding } from '../funding/module.f.mjs'
import { documentationBarsStylesheet } from '../style/module.f.js'
import { _buildIdentity } from '../module.f.mjs'
import { entrypoints, inputDir, manifestName, moduleSource, outputDir, stylesheetName, symbolSource, withSiteChrome } from './module.f.mjs'

/** @type {(dir: string) => Promise<readonly string[]>} */
const files = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async entry => {
    const path = `${dir}/${entry.name}`
    return entry.isDirectory()
        ? entry.name.startsWith('.') || entry.name.startsWith('gen.') || ['node_modules', 'target'].includes(entry.name) ? [] : files(path)
        : entry.isFile() ? [path] : []
}))).flat().toSorted()

const version = spawnSync('deno', ['--version'], { encoding: 'utf8' })
if (version.status !== 0 || !version.stdout.startsWith(`deno ${deno} `)) {
    throw Error(`deno-doc requires Deno ${deno}`)
}
const sources = entrypoints(await files('fjs'))
if (sources.length === 0) { throw Error('no public Deno entrypoints') }
await rm(inputDir, { recursive: true, force: true })
// Do not suppress diagnostics. Warnings are failures too: a partial type graph
// must not be published as if it were complete.
const generated = spawnSync('deno', ['doc', '--no-npm', '--no-remote', '--html', '--name=FunctionalScript', `--output=${inputDir}`, ...sources], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
process.stdout.write(generated.stdout ?? '')
process.stderr.write(generated.stderr ?? '')
if (generated.error || generated.status !== 0 || generated.stderr.includes('Warning')) {
    throw Error('Deno documentation generation failed; see diagnostics above')
}
const pages = await files(inputDir)
/** @type {readonly (readonly [string, string])[]} */
const modules = (await Promise.all(pages.filter(path => path.endsWith('/index.html')).map(async path => {
    const source = moduleSource(await readFile(path, 'utf8'))(sources)
    return source === null ? [] : [/** @type {const} */ ([source, path.slice(inputDir.length + 1)])]
}))).flat().toSorted(([a], [b]) => cmp(a)(b))
if (modules.length !== sources.length || sources.some(source => modules.filter(([name]) => name === source).length !== 1)) {
    throw Error('Deno output does not map every public entrypoint exactly once')
}
const [fundingTag, fundingValue] = parseFunding(await readFile(fundingPath, 'utf8'))
if (fundingTag === 'error') { throw Error(`${fundingPath}: ${fundingValue}`) }
const build = { ..._buildIdentity(process.env), funding: fundingValue, jsApi: modules }
const chrome = {
    head: `${rustdocHead}<link rel="stylesheet" href="/${outputDir}/${stylesheetName}">`,
    header: rustdocHeader(build),
    footer: rustdocFooter(build.funding),
}
await Promise.all(pages.filter(path => path.endsWith('.html')).map(async path => {
    const html = await readFile(path, 'utf8')
    const source = moduleSource(html)(sources) ?? symbolSource(html)(sources)
    await writeFile(path, withSiteChrome(chrome)(html)(source))
}))
await writeFile(`${inputDir}/${stylesheetName}`, documentationBarsStylesheet)
await writeFile(`${inputDir}/${manifestName}`, modules.map(([source, page]) => `${source}\t${page}\n`).join(''))
console.log(`Deno API: ${sources.length} entrypoints, ${pages.length} files`)
