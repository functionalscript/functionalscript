# FS VM load/save

sketch / mention future documentation on errors / exceptions and execution scheme in general, for example:

The host environment has well defined operations like 'Load' (takes a "root" module path, optional extra parameters), 'Execute' (takes the successful result of 'Load', optional extra parameters), 'Save' (takes the successful result of 'Load', optional extra parameters).

'Load' time errors are communicated to the host environment (e.g. to output error diagnostics on the console). In presence of load time errors there is no successful result of 'Load', so there is nothing to pass to Execute, Save. However, it makes sense to have results of a partially successful 'Load' even though they cannot be used in 'Execute', 'Save' - for example, in language server protocol scenarios.

'Save' corresponds to code / data transformations other than 'Execute', e.g. bundling. 'Save' time errors are communicated to the host environment. It might make sense to have results of a partially successful 'Save' (similarly to abovementioned scenarios for partially successful 'Load' results).

'Execute' corresponds to calling the function that is the default export of the "root" module and that takes produces side effects on the environment. Execution ends with a halt caused either by the inner logic of the code (e.g. the root function successfully completes, or an unhandled error happens), or by external causes (e.g. the user stops the execution).

Now, does a proper FS system provide user code means to handle errors, e.g. an exception handling mechanism similar to JS's exception handling?
