const cp = require('child_process')
const fs = require('fs')
const package_json = require('../../package.json')
const { version } = require('./module.f.cjs')

fs.writeFileSync('package.json', version(package_json)(cp.execSync('git log --oneline')))