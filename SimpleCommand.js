var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var stee = require('simple-log-tee');
var util = require('util');

module.exports = SimpleCommand;

/**
 * SimpleCommand - Constructs a command to run.
 *
 * @param  {string} **exec**    the program to run
 * @param  {array} **args**    arguments to pass to the program <br/>
 * __Note:__ the program is executed directly, i.e. no subshell is launched to process globs in args
 * @param  {string} **workdir** working directory from which to run the command
 *
 */
function SimpleCommand(exec, args, workdir) {
	this.exec = /^win/.test(process.platform) ? findWindowsExec(exec) : exec;
	this.args = args;
	this.workdir = workdir;
	this.setOptions();
	this.commandLine = util.format('%s %s', this.exec, this.args.join(' '));
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
 * SimpleCommand.setOptions - Sets the output control options for the command.
 *
 * @param {object} **options** (optional) if not provided we get this default:
 *		{
 *			redirect: undefined,
 *			progress: false,
 *			record: undefined
 *		}
 * @param {string} **options.redirect** filename to which all command output should be sent,
 * if null or undefined it will go to the parent's stdout/stderr,
 * unless modified by **options.progress**
 * @param {object} **options.progress** a _boolean_ indicating whether to output status/progess
 * messages, or a positive _integer_, which turns on messages, and indicates how many 'chunks' of
 * output data should be represented as a single '#' in the output. <br/>
 * (Combine an _integer_ in this field with **options.redirect** to have the command output saved
 * to a file and still give some progress indication to the user.)
 * @param {string} **options.record** name of a file to which a copy of everything sent to the
 * parent's stdout/stderr should be recorded, or an existing _simple-log-tee_ to use. <br/>
 * Can be used instead of **options.redirect** if command output should be seen by the user and
 * sent to a file. If used with both **options.redirect** and **options.progress**, it will be
 * the output defined through **options.progress** that is sent to the record.
 *
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
	// knowing the options, we can set the stdioType
	if (!this.options.redirect &&
		!this.options.progress &&
		!this.options.record) {
		// the default: simply have the child inherit the parent's stdio
		this.stdioType = 'inherit';
	} else if (this.options.redirect &&
		typeof this.options.progress !== 'number' &&
		!this.options.record) {
		// we're redirecting the output to a file and don't need to capture/monitor the child's output
		this.stdioType = 'stream';
	} else {
		// we're doing something that requires acting on the child's stdout/stderr
		this.stdioType = 'pipe';
	}

};

/**
 * SimpleCommand.run - Runs the command.
 *
 * @param  {object} **options**  (optional) if not provided, uses options previously set through
 * `SimpleCommand.setOptions()`, or the default if nothing has been set before.
 * To force a reset, pass `null`.
 * @param  {function} callback (optional) a function to run when the command completes.
 *
 */
SimpleCommand.prototype.run = function (options, callback) {
	if (options === undefined || typeof options === 'function') {
		callback = options;
	} else {
		this.setOptions(options);
	}
	this._setupOutput();

	if (this.options.progress) {
		var workpath = (this.workdir === path.resolve(this.workdir)) ?
			this.workdir : path.relative('./', this.workdir);
		this.output.progressTee.log('From %s, invoking command:\n%s', workpath, this.commandLine);
	}

	if (this.options.progress && this.options.redirect) {
		this.output.progressTee.log(
			'Command output will be captured in', path.relative('./', this.options.redirect));
	}
	var runfn = (this.stdioType === 'pipe') ? _runWithProgress : _runWithoutProgress;
	if (this.output.redirectStream) {
		// only spawn after the stream is open, and listen for errors on the redirect stream
		var command = this;
		this.output.redirectStream.on('open', function(fd) {
			runfn(command);
		});
		this.output.redirectStream.on('error', function(err) {
			if (command.options.progress) {
				command.output.progressTee.log(
					'\nWriting to redirect file %s failed.', command.options.redirect);
			}
			if (command.stdioType === 'pipe') {
				// we're responsible for closing the stream
				command.output.redirectStream.end();
			}
			command.output.progressTee.log(err);
		});
	} else {
		runfn(this);
	}
	return;


	function _runWithProgress(command) {
		var chunks = command.options.progress === true ? 0 : command.options.progress;
		var chunkCount = 0;
		var child = command._doSpawn('pipe');
		child.stdout.on('data', function(data) {
			__doProgress(data);
		});
		child.stderr.on('data', function(data) {
			__doProgress(data);
		});
		command._installCallback(child, callback);
		return;

		function __doProgress(data) {
			// write the command's output somewhere
			if (command.options.redirect) {
				command.output.redirectStream.write(data);
			} else if (typeof command.options.progress !== 'number') {
				// we're not redirecting, and we're not hashing,
				// we write command output to the progress tee
				command.output.progressTee.write(data);
			}
			// write a progress indicator every 'chunks' time, if requested
			if (chunks && chunkCount++ % chunks === 0) {
				command.output.progressTee.write('#');
			}
		}
	}

	function _runWithoutProgress(command) {
		var stdio;
		if (command.stdioType === 'stream') {
			stdio = [0, command.output.redirectStream, command.output.redirectStream];
		} else {
			stdio = 'inherit';
		}
		var child = command._doSpawn(stdio);
		command._installCallback(child, callback);
		return;
	}
};

SimpleCommand.prototype._setupOutput = function () {
	this.output = {};
	// set the progress stee
	if (typeof this.options.record === 'object') {
		// assume it is an existing stee
		this.output.progressTee = this.options.record;
	} else if (typeof this.options.record === 'string') {
		// it's a filepath
		this.output.progressTee = stee.createLogFileTee(this.options.record);
	} else {
		// just send progress to stdout
		this.output.progressTee = stee.teeToStdoutOnly();
	}
	// set the redirect stream
	if (this.options.redirect) {
		// redirect all stdio to a new file
		this.output.redirectStream = fs.createWriteStream(path.resolve(this.options.redirect));
	} else {
		this.output.redirectStream = null;
	}
};

SimpleCommand.prototype._doSpawn = function (stdio) {
	var spawnopts = {
		cwd: path.relative('./', this.workdir),
		env: process.env,
		stdio: stdio
	};
	return childProcess.spawn(this.exec, this.args, spawnopts);
};

SimpleCommand.prototype._installCallback = function (child, callback) {
	var command = this;
	child.on('exit', function(code, signal) {
		if (command.options.progress) {
			command.output.progressTee.log('\nDone', command.commandLine);
		}
		if (signal) {
			command.output.progressTee.log('\nCommand stopped by signal:', signal);
		}
		__doCallback(code);
	});
	child.on('error', function(err) {
		if (command.options.progress) {
			command.output.progressTee.log('\nError running', command.commandLine);
		}
		command.output.progressTee.log(err);
		__doCallback(-1);
	});
	// child.on('close', function () {
	// 	if (command.output.redirectStream && command.stdioType === 'pipe') {
	// 		// we're responsible for closing the redirect stream
	// 		console.log('closing stream:', command.output.redirectStream);
	// 		process.nextTick(function () {
	// 			command.output.redirectStream.end();
	// 		});
	// 	}
	// });
	return child;

	function __doCallback(code) {
		if (callback) {
			var cb = callback;
			callback = null;
			cb(code);
		}
	}
};
