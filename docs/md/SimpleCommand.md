SimpleCommand
-------------

###function SimpleCommand(exec, args, workdir)###

Defines a command to run in the shell.

####Parameters####

* exec the program to run
* args an array of arguments to pass to the program
* workdir the working directory for running the command
* * *


###SimpleCommand.prototype.setOptions = function (options)###

Sets the options for the command (can also be done on the run() call).

####Parameters####

* options (optional) an object, or nothing, in which case we get this default:
		{
			redirect: undefined,
			progress: false,
			record: undefined
		}
* options.redirect filename to which all command output should be sent,
if null or undefined it will got to stdout/stderr
* options.progress boolean indicating whether to output status/progess messages,
or a number (>0), which turns on messages, and indicates how many 'chunks' of output data should
be represented as a single '#' in the output. If options.progress is a number and
options.redirect is not set, output will be sent to a temporary file.
(Combine with options.redirect to have the command output saved to a file and still give
some progress indication to the user.)
* options.record filename to which the contents of stdout/stderr should be sent.
Can be used instead of options.redirect if command output should be seen by the user and
sent to a file. If used with both options.redirect and options.reportProgress, it will be
the output defined through options.reportProgress that is saved to the record file.
* * *

###SimpleCommand.prototype.run = function (options, callback)###

Runs the command. All parameters optional.

####Parameters####

* options (optional) if not provided, uses options previously set through setOptions(),
or the default if nothing has been set before; to force a reset, pass `null`.
* callback (optional) a function to run when the command completes.
* * *
