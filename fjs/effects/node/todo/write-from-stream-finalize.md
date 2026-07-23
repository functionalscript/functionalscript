# writeFromStream should unlink a file in case of error

Currently, the `writeFromStream` doesn't delete a file in case of an error and leave partial file.
