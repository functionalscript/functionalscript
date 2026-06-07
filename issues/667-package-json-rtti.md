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

Create one `fs/package_json` module for package metadata schemas and JSON text
decoding:

- expose a package metadata schema for partial reads;
- expose a required-version schema for version updates;
- expose full JSON object validation for write-back paths;
- keep malformed JSON as a normal `Result` error for read-only metadata helpers;
- let write-back paths validate a native-parsed JSON object so object key order is
  preserved when the file is stringified again.

Read-only callers may use the package metadata parser. Write-back callers must
validate the original JSON object and then validate the specific fields they need,
so spreading the object preserves fields that the partial metadata schema does
not mention.

## Tasks

- [x] Add shared package JSON schema helpers.
- [x] Use the shared helpers from the CI generator.
- [x] Use validation in the version write-back path.
- [x] Add proofs for package metadata parsing and write-back preservation.
