# Development commands

`npm run gen` regenerates source outputs through `gen/module.f.mjs`, stopping
at the first failure. `npm run gen:clean` deletes all generated files before
regeneration; no tool lock is exempt. Run both through `./dev.sh`.

Dependency lock updates are separate from generation. See root CONTRIBUTING.md.
