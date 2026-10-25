# Update supported tool versions

Edit exact pins in `config/module.f.js` and the pixi manifest together.
Update `.node-version`, `package.json` and `package-lock.json` when Node changes.
Refresh the pixi lock on all six native platforms and commit required sidecars.
Keep supplemental archive hashes and npm package pins synchronized.

Run `./dev.sh npm run gen`, then type-check and run scoped proofs. Validate
runtime version assertions in CI on every platform before adoption. A package
with the right name may supply libraries rather than a CLI; test actual commands.
