var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var stee = require('simple-log-tee');
var util = require('util');

module.exports = SimpleCommand;

/**
 * Defines a command to run in the shell.
 *
 * @param exec the program to run
 * @param args an array of arguments to pass to the program
 * @param workdir the working directory for running the command
*/
function SimpleCommand(exec, args, workdir) {
	this.exec = /^win/.test(process.platform) ? findWindowsExec(exec) : exec;
	this.args = args;
	this.workdir = workdir;
	this.setOptions();
}

function findWindowsExec(exec) {
	var found;
	if (/^win/.test(process.platform)) { // on Windows there may be more to setting exec ...
		var execPossibilities = process.env.PATHEXT.split(path.delimiter).map(function (ext) {
			return exec + ext; // array of exec with Windows PATH extensions applied
		});
		execPossibilities.push(exec); // put the plain exec last

		// check if it's an absolute path or in the current directory first
		['', '.' + path.sep].forEach(function (execPath) {
			execPossibilities.forEach(function (execPossibility) {
				if (fs.existsSync(execPossibility) && !found) {
					found = execPossibility;
				}
			});
		});

		if (!found){
			// for each path in the PATH environment variable
			process.env.PATH.split(path.delimiter).forEach(function (execPath) {
				execPossibilities.forEach(function (execPossibility) {
					if (fs.existsSync(execPath + path.sep + execPossibility) && !found) {
						found = execPossibility;
					}
				});
			});
		}
	}

	return found ? found : exec;
}

/**
* Sets the options for the command (can also be done on the run() call).
*
* @param options (optional) an object, or nothing, in which case we get this default:
*		{
*			redirect: undefined,
*			progress: false,
*			record: undefined
*		}
* @param options.redirect filename to which all command output should be sent,
* if null or undefined it will got to stdout/stderr
* @param options.progress boolean indicating whether to output status/progess messages,
* or a number (>0), which turns on messages, and indicates how many 'chunks' of output data should
* be represented as a single '#' in the output. If options.progress is a number and
* options.redirect is not set, output will be sent to a temporary file.
* (Combine with options.redirect to have the command output saved to a file and still give
* some progress indication to the user.)
* @param options.record filename to which the contents of stdout/stderr should be sent.
* Can be used instead of options.redirect if command output should be seen by the user and
* sent to a file. If used with both options.redirect and options.reportProgress, it will be
* the output defined through options.reportProgress that is saved to the record file.
*/
SimpleCommand.prototype.setOptions = function (options) {
	if (!options)  {
		this.options = {
			redirect: undefined,
			progress: false,
			record: undefined
		};
	} else {
		this.options = options;
	}
};

/**
* Runs the command. All parameters optional.
*
* @param options (optional) if not provided, uses options previously set through setOptions(),
* or the default if nothing has been set before; to force a reset, pass `null`.
* @param callback (optional) a function to run when the command completes.
*/
SimpleCommand.prototype.run = function (options, callback) {
	var command = this;
	if (options === undefined || typeof options === 'function') {
		callback = options;
	} else {
		command.setOptions(options);
	}
	var output = _setOutput(command.options);
	var commandLine = util.format('%s %s', command.exec, command.args.join(' '));

	if (command.options.progress) {
		var workpath = command.workdir === path.resolve(command.workdir) ?
			command.workdir : path.relative('./',command.workdir);
		output.progressTee.log('From %s, invoking command:\n%s', workpath, commandLine);
	}
	var child;
	if (output.redirectStream) {
		var reportingProgressAndRedirectingToAFile =
			command.options.progress && command.options.redirect;
		if (reportingProgressAndRedirectingToAFile) {
			output.progressTee.log(
				'Command output will be captured in', path.relative('./', command.options.redirect));
		}
		output.redirectStream.on('error', function(err) {
			if (reportingProgressAndRedirectingToAFile) {
				output.progressTee.log('\nWriting to redirect file %s failed.', command.options.redirect);
				output.redirectStream.end();
			}
			output.progressTee.log(err);
		});
		output.redirectStream.on('open', function(fd) {
			child = _doSpawn('pipe');
			child.stdout.on('data', function(data) {
				__doProgress(data);
			});
			child.stderr.on('data', function(data) {
				__doProgress(data);
			});
			_installCallback(child);

			var chunks = command.options.progress === true ? 0 : command.options.progress;
			var chunkCount = 0;
			function __doProgress(data) {
				// write the command's output somewhere
				if (command.options.redirect) {
					output.redirectStream.write(data);
				} else if (typeof command.options.progress !== 'number') {
					output.progressTee.write(data);
				}
				// write a progress indicator, if requested
				if (chunks && chunkCount++ % chunks === 0) {
					output.progressTee.write('#');
				}
			}
		});
	} else {
		child = _doSpawn('inherit');
		_installCallback(child);
	}
	return child;

	function _setOutput(options) {
		var output = {};
		output.progressTee = options.record ? stee.createLogFileTee(options.record) :
			stee.teeToStdoutOnly();
		if (options.redirect) {
			output.redirectStream = fs.createWriteStream(path.resolve(options.redirect));
		} else if (options.record) {
			output.redirectStream = output.progressTee.getFileStream();
		} else if (options.progress !== true && options.progress > 0) {
			output.redirectStream = fs.createWriteStream(util.format(
				'%s/simple-command_%s-%s.log', process.env.TMPDIR, command.exec, Date.now()));
		} else {
			output.redirectStream = null;
		}
		return output;
	}

	function _doSpawn(_stdio) {
		var options = {
			cwd: path.relative('./', command.workdir),
			env: process.env,
			stdio: _stdio
		};
		var child = childProcess.spawn(command.exec, command.args, options);
		return child;
	}

	function _installCallback(child) {
		var _callback = callback;
		child.on('exit', function(code) {
			if (command.options.progress) {
				output.progressTee.log('\nDone', commandLine);
			}
			_doCallback(code);
		});
		child.on('error', function(err) {
			if (command.options.progress) {
				output.progressTee.log('\nError running', commandLine);
			}
			output.progressTee.log(err);
			_doCallback(-1);
		});
		return child;

		function _doCallback(code) {
			if (output.redirectStream) {
				output.redirectStream.end();
			}
			if (_callback) {
				_callback = null;
				callback(code);
			}
		}
	}
};
