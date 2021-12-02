const cp = require('child_process')
const fs = require('fs')
const json = require('./json')

const b =cp.execSync('git log --oneline')

const r = b.toString().split('\n').length

const v = `0.0.${r}`

console.log(`version: ${v}`)

let package_json = json.parse(fs.readFileSync('package.json').toString())

package_json = json.setProperty(v)(['version'])(package_json)

fs.writeFileSync('package.json', JSON.stringify(package_json, null, 2))