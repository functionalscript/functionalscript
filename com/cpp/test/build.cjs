const fs = require('node:fs')
const cp = require('node:child_process')
// const cs = require('../test.f.js').result

// fs.writeFileSync('_result.cpp', cs)
try {
    console.log(cp.execSync('clang main.cpp').toString())
} catch (e) {
    // @ts-ignore
    console.error(e.output.toString())
}