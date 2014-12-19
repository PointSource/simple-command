var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var stee = require('simple-log-tee');
var util = require('util');

module.exports = SimpleCommand;

/**
* Defines a command to run in the shell.
* @param exec the program to run
* @param args an array of arguments to pass to the program
* @param workdir the working directory for running the command
* @param logfile (optional) a file to redirect the command output to,
* 	if not provided, output will go to stdout and stderr
*/
function SimpleCommand(exec, args, workdir, logfile) {
	this.exec = /^win/.test(process.platform) ? findWindowsExec(exec) : exec;
	this.args = args;
	this.workdir = workdir;
	this.logfile = logfile;
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
* Runs the command. All parameters optional.
* @param progress (optional) a ProgressRecord to send the output to.
* 	If null or not provided, it will be sent to stdio.
* 	To suppress progress reporting, create a ProgressRecord with an empty array as it's streams.
* @param callback (optional) a function to run when the command completes.
*/
SimpleCommand.prototype.run = function (progress, callback) {
	var command = this;
	var commandLine = util.format('%s %s', command.exec, command.args.join(' '));
	if (!progress || typeof progress === 'function') {
		callback = progress;
		progress = stee.logToStdoutOnly();
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
