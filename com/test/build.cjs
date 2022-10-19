const { writeFileSync } = require('node:fs')
const { execSync } = require('node:child_process')
const { platform } = require('node:process')
const build = require('./build.f.cjs')

const dirname = __dirname

const nodeJs = {
    dirname: __dirname,
    platform,
}

/** @type {(f: build.Func) => void} */
const run = f => {
    const { file: { name, content }, line } = f(nodeJs)
    writeFileSync(name, content)
    try {
        console.log(execSync(line).toString())
    } catch (e) {
        // @ts-ignore
        console.error(e.output.toString())
    }
}

run(build.cpp)

{
    const cs = require('../cs/test.f.cjs').result

    writeFileSync(`${dirname}/cs/_result.cs`, cs)
    try {
        console.log(execSync(`dotnet build ${dirname}/cs/cs.csproj`).toString())
    } catch (e) {
        // @ts-ignore
        console.error(e.output.toString())
    }
}

{
    const rust = require("../rust/test.f.cjs").result();

    writeFileSync(`${dirname}/rust/src/_result.rs`, rust);
    try {
        console.log(execSync("cargo build").toString());
    } catch (e) {
        // @ts-ignore
        console.error(e.output.toString());
    }
}
