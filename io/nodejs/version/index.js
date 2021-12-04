const cp = require('child_process')
const fs = require('fs')
const json = require('../../../json')
const { isPackageJson } = require('../../../commonjs/package')

const b =cp.execSync('git log --oneline')

const r = b.toString().split('\n').length

const v = `0.0.${r}`

console.log(`version: ${v}`)

const package_json = json.parse(fs.readFileSync('package.json').toString())

if (!isPackageJson(package_json)) { throw 'error' }

const x = { ...package_json, version: v }

fs.writeFileSync('package.json', JSON.stringify(x, null, 2))