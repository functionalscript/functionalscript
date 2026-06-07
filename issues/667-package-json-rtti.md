# 667-package-json-rtti. Share package.json RTTI helpers

**Priority:** P3
**Status:** done

## Problem

Multiple development commands read `package.json`-style files. The CI generator
needs package metadata such as `name`, while the version updater reads and writes
`package.json` and `deno.json` back to disk.

Using a local partial schema with rtti `parse` is fine when the caller only wants
the parsed projection. It is not appropriate before writing a file back, because
`parse` rebuilds containers from the schema and can drop fields that are not part
of the partial view.

## Design

Create one `fs/dev/package_json` module for the package metadata schema and JSON
text decoding:

- expose a package metadata schema for partial reads;
- keep malformed JSON as a normal `Result` error for text helpers;
- let write-back paths native-parse JSON and validate the original object with
  the shared package metadata schema before spreading it, so object key order is
  preserved when the file is stringified again.

Callers validate the JSON object against the shared package metadata schema and
then validate the specific fields they need, so spreading the original object
preserves fields that the partial metadata schema does not mention. If a caller
requires an optional field such as `version`, it checks that field after
validating the shared package metadata schema instead of defining a second
package object RTTI.

## Tasks

- [x] Add shared package JSON schema helpers.
- [x] Use the shared helpers from the CI generator.
- [x] Use validation in the version write-back path.
- [x] Add proofs for package metadata parsing and write-back preservation.
