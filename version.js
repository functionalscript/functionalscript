const cp = require('child_process')
const fs = require('fs')

const b =cp.execSync('git log --oneline')

const r = b.toString().split('\n').length

const v = `0.0.${r}`

console.log(`version: ${v}`)

const package_json = JSON.parse(fs.readFileSync('package.json').toString())

package_json.version = v

fs.writeFileSync('package.json', JSON.stringify(package_json, null, 2))