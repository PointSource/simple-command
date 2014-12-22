#!/usr/bin/env node

var Command = require('../');

var commands = [
	new Command('ls', ['-l'], '/etc'),
	new Command('grep', ['sh', '-r', '/usr/bin'], './'),
	new Command('npm', ['update'], './')
];

doTests(commands);

function doTests(commands) {
	if (commands.length === 0) {
		return;
	}
	var command = commands.shift();
	return testDefault();

	function testDefault() {
		console.log('** default');
		command.run(testRedirect);
	}

	function testRedirect(code) {
		console.log('return code:', code);
		console.log('** redirect');
		command.setOptions({
			redirect: command.exec + '_redirect.out'
		});
		command.run(testRecord);
	}

	function testRecord(code) {
		console.log('return code:', code);
		console.log('** record');
		command.run({record: command.exec + '_record.out'}, testProgress);
	}

	function testProgress(code) {
		console.log('return code:', code);
		console.log('** progress true');
		command.run({progress: true}, function (code) {
			console.log('return code:', code);
			console.log('** progress 5');
			command.run({progress: 5}, testProgressRedirect);
		});
	}

	function testProgressRedirect(code) {
		console.log('return code:', code);
		console.log('** redirect + progress 1');
		command.setOptions({
			redirect: command.exec + '_redirect-progress_1.out',
			progress: 1
		});
		command.run(function (code) {
			console.log('return code:', code);
			console.log('** redirect + progress true');
			command.setOptions({
				redirect: command.exec + '_redirect-progress_true.out',
				progress: true
			});
			command.run(testRecordRedirect);
		});
	}

	function testRecordRedirect(code) {
		console.log('return code:', code);
		console.log('** record + redirect');
		command.setOptions({
			record: command.exec + '_record-with-redirect.out',
			redirect: command.exec + '_redirect-with-record.out'
		});
		command.run(testRecordProgress);
	}

	function testRecordProgress(code) {
		console.log('return code:', code);
		console.log('** record + progress 3');
		command.setOptions({
			record: command.exec + '_record-progress_3.out',
			progress: 3
		});
		command.run(testRecordProgressRedirect);
	}

	function testRecordProgressRedirect(code) {
		console.log('return code:', code);
		console.log('** record + redirect + progress 8');
		command.run({
				record: command.exec + '_record-with-redirct-progress_8.out',
				redirect: command.exec + '_redirect-with-record-progress_8.out',
				progress: 8
			},
			function (code) {
				console.log('return code:', code);
				doTests(commands);
			}
		);
	}
}
