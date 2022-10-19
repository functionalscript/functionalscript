const { writeFileSync } = require('node:fs')
const { execSync } = require('node:child_process')
const { platform } = require('node:process')
const build = require('./build.f.cjs')
const { cpp, cs, rust } = build
const { join } = require('../../types/string/module.f.cjs')
const { log, error } = console
const { bold, reset } = require('../../text/sgr/module.f.cjs')

const nodeJs = {
    dirname: __dirname,
    platform,
}

/** @type {(f: build.Func) => void} */
const run = f => {
    const { file: { name, content }, line } = f(nodeJs)
    log(`${bold}writing: ${name}${reset}`)
    writeFileSync(name, content)
    const cmd = join(' ')(line)
    log(`${bold}running: ${cmd}${reset}`)
    try {
        log(execSync(cmd).toString())
    } catch (e) {
        // @ts-ignore
        error(e.output.toString())
    }
}

run(cpp)
run(cs)
run(rust)
