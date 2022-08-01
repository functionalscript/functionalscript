const cp = require('child_process')
const fs = require('fs')
const package_json = require('../../package.json')
const { version } = require('./module.f.cjs')

const b = cp.execSync('git log --oneline')

const v = version(package_json)(b)

fs.writeFileSync('package.json', v)