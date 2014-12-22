# simple-command

Simply invoke a CLI command from a Node script

## usage

Get it: `npm install --save simple-command`

Use it:

```javascript
var SimpleCommand = require('simple-command');

var greptest = new SimpleCommand('grep', ['sh', '-r', '/usr/bin'], '/');
greptest.run(function () {
	greptest.setOptions({
		record: 'greptest-console-output-copy.txt',
		redirect: 'greptest-command-output.txt',
		progress: 5
	});
	greptest.run();
});

var npmupdate = new SimpleCommand('npm', ['update'], './');
npmupdate.run({record: 'copy-of-npm-output.txt'}, function (code) {
	console.log('complete with return code', code);
});
```
## docs

[Generated API docs](docs/md/SimpleCommand.md)
