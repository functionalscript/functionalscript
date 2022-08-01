const cp = require('child_process')
const fs = require('fs')
const package_json = require('../../package.json')

const b =cp.execSync('git log --oneline')

const r = b.toString().split('\n').length

const v = `0.0.${r}`

console.log(`version: ${v}`)

const x = { ...package_json, version: v }

fs.writeFileSync('package.json', JSON.stringify(x, null, 2))