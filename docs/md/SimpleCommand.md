SimpleCommand
-------------

###function SimpleCommand(exec, args, workdir)###

SimpleCommand - Constructs a command to run.

####Parameters####

* **exec** *string* the program to run
* **args** *array* arguments to pass to the program <br/>
__Note:__ the program is executed directly, i.e. no subshell is launched to process globs in args
* **workdir** *string* working directory from which to run the command

* * *


###SimpleCommand.prototype.setOptions = function (options)###

SimpleCommand.setOptions - Sets the output control options for the command.

####Parameters####

* **options** *object* (optional) if not provided we get this default:
		{
			redirect: undefined,
			progress: false,
			record: undefined
		}
* **options.redirect** *string* filename to which all command output should be sent,
if null or undefined it will go to the parent's stdout/stderr,
unless modified by **options.progress**
* **options.progress** *object* a _boolean_ indicating whether to output status/progess
messages, or a positive _integer_, which turns on messages, and indicates how many 'chunks' of
output data should be represented as a single '#' in the output. <br/>
(Combine an _integer_ in this field with **options.redirect** to have the command output saved
to a file and still give some progress indication to the user.)
* **options.record** *string* name of a file to which a copy of everything sent to the
parent's stdout/stderr should be recorded, or an existing _simple-log-tee_ to use. <br/>
Can be used instead of **options.redirect** if command output should be seen by the user and
sent to a file. If used with both **options.redirect** and **options.progress**, it will be
the output defined through **options.progress** that is sent to the record.

* * *


###SimpleCommand.prototype.run = function (options, callback)###

SimpleCommand.run - Runs the command.

####Parameters####

* **options** *object* (optional) if not provided, uses options previously set through
`SimpleCommand.setOptions()`, or the default if nothing has been set before.
To force a reset, pass `null`.
* callback *function* (optional) a function to run when the command completes.

* * *
