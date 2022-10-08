const fs = require("node:fs");
const cp = require("node:child_process");
const rust = require("../rust/test.f.cjs").result();

fs.writeFileSync("./src/_result.rs", rust);
try {
  console.log(cp.execSync("cargo build").toString());
} catch (e) {
  // @ts-ignore
  console.error(e.output.toString());
}
