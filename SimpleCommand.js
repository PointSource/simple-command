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
*		if null or undefined it will got to stdout/stderr
* @param options.progress boolean indicating whether to output status/progess messages,
*		or a number, which turns on messages, and indicates how many lines of command output should be
*		represented as a single '#' in the output.
*		(Combine with options.redirect to have the command output saved to a file and still give
*			some progress indication to the user.)
* @param options.record filename to which the contents of stdout/stderr should be sent
*		Can be used instead of options.redirect if command output should be seen by the user and
*		sent to a file. If used with both options.redirect and options.reportProgress, it will be
*		the output defined through options.reportProgress that is saved to the record file.
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
* @param options (optional) uses options previously set through setOptions(),
*		or the default if nothing has been set before; to force a reset, pass `null`
* @param callback (optional) a function to run when the command completes.
*/
SimpleCommand.prototype.run = function (options, callback) {
	var command = this;
	if (options === undefined || typeof options === 'function') {
		callback = options;
	} else {
		command.setOptions(options);
	}
	var streams = _setStreams(options);
	var commandLine = util.format('%s %s', command.exec, command.args.join(' '));
	if (command.options.progress) {

	}

	progress.log('From %s, invoking command:\n%s', path.relative('./',command.workdir), commandLine);
	var child;
	if (command.logfile) {
		progress.log('SimpleCommand output will be captured in', path.relative('./', command.logfile));
		var ticks = 25;
		var cmdLogStream = fs.createWriteStream(command.logfile);
		cmdLogStream.on('error', function(err) {
			progress.log('\nWriting log file failed.');
			progress.log(err);
			cmdLogStream.end();
		});
		cmdLogStream.on('open', function(fd) {
			child = _doSpawn('pipe');
			var outCount = 0;
			child.stdout.on('data', function(data) {
				cmdLogStream.write(data);
				if (++outCount % ticks === 0) {
					progress.write('=');
				}
			});
			var errCount = 0;
			child.stderr.on('data', function(data) {
				cmdLogStream.write(data);
				if (++outCount % ticks === 0) {
					progress.write('-');
				}
			});
			child.on('exit', function(code) {
				progress.log('\nDone:', commandLine);
				cmdLogStream.end();
			});
			_installCallback(child);
		});
	} else {
		child = _doSpawn('inherit');
		_installCallback(child);
	}
	return child;

	function _setStreams(options) {
		var streams = {};
		streams.redirect = options.redirect ? fs.createWriteStream(options.redirect) : null;
		if (options.redirect) {
			streams.redirect = fs.createWriteStream(options.redirect);
		}
	}

	function _doSpawn(_stdio) {
		var child = childProcess.spawn(command.exec, command.args,
		{cwd: path.relative('./', command.workdir), env: process.env, stdio: _stdio});
		return child;
	}

	function _installCallback(child) {
		var _callback = callback;
		child.on('exit', function(code) {
			_doCallback(code);
		});
		child.on('error', function(err) {
			progress.log('Error running "%s"', commandLine);
			progress.log(err);
			_doCallback(-1);
		});
		return child;

		function _doCallback(code) {
			if (_callback) {
				_callback = null;
				callback(code);
			}
		}
	}
};
