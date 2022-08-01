const _ = require('./module.f.cjs')

const e = {
    "name": "functionalscript",
    "version": "0.1.0",
    "description": "FunctionalScript is a functional subset of JavaScript",
    "main": "module.f.cjs",
    "scripts": {
        "tsc": "tsc",
        "test": "tsc && npm run test-only",
        "version": "node ./nodejs/version/main.cjs",
        "test-only": "node --trace-uncaught ./test.f.cjs"
    },
    "repository": {
        "type": "git",
        "url": "git+https://github.com/functionalscript/functionalscript.git"
    },
    "author": "NatFoam",
    "license": "MIT",
    "keywords": [
        "lambda",
        "functional-programming",
        "closure",
        "pure-functional",
        "typescript",
        "programming-language",
        "lazy-evaluation"
    ],
    "bugs": {
        "url": "https://github.com/functionalscript/functionalscript/issues"
    },
    "homepage": "https://github.com/functionalscript/functionalscript#readme",
    "devDependencies": {
        "@types/node": "^18.6.2",
        "typescript": "^4.7.4"
    }
}

{
    const v = _.version(e)(Buffer.from("123\n456\n"))
    if (v !== '0.0.3') { throw v }
}

module.exports = {}
