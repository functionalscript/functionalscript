const { writeFileSync } = require('node:fs')
const { execSync } = require('node:child_process')
const { platform, exit } = require('node:process')
const build = require('./build.f.cjs')
const { cpp, cs, rust } = build
const { join } = require('../../types/string/module.f.cjs')
const { log, error } = console
const { bold, reset } = require('../../text/sgr/module.f.cjs')
const { list } = require('../../types/module.f.cjs')

const nodeJs = {
    dirname: __dirname,
    platform,
}

/** @type {(f: build.Func) => void} */
const run = f => {
    const { file: { name, content }, line } = f(nodeJs)
    log(`${bold}writing: ${name}${reset}`)
    writeFileSync(name, content)
    for (const i of list.iterable(line)) {
        const cmd = join(' ')(i)
        log(`${bold}running: ${cmd}${reset}`)
        try {
            log(execSync(cmd).toString())
        } catch (e) {
            // @ts-ignore
            error(e.output.toString())
            exit(-1)
        }
    }
}

run(cpp)
run(cs)
run(rust)
