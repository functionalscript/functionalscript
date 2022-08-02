const cp = require('child_process')
const fs = require('fs')
// const package_json = require('../../package.json')
const { version } = require('./module.f.cjs')

const p = JSON.parse(fs.readFileSync('package.json').toString())
fs.writeFileSync('package.json', version(p)(cp))