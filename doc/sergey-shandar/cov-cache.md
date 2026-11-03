Next step:
1. we need to compute a hash for each file (we already do in npm start ci init)
2. Create a JSON for each test of the file, like {"test":"cov","path": "hash":"...","dependencies":[..hashes-of-dep-json-files...]}
3. Check if the file is already in build-cache. Run the test, e.g. node with coverage for the module. Save the file in the build cache if the test succeeds.
