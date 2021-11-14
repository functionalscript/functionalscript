const cp = require('child_process')
const fs = require('fs')

const b =cp.execSync('git log --oneline')

const r = b.toString().split('\n').length

const package_json = JSON.parse(fs.readFileSync('package.json').toString())

package_json.version = `0.0.${r}`

fs.writeFileSync('package.json', JSON.stringify(package_json, null, 2))