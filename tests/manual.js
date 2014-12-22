#!/usr/bin/env node

var Command = require('../');

var lsetc = new Command('ls', ['-l'], '/etc');

console.log('** default');
lsetc.run(function () {
	console.log('** redirect');
	lsetc.setOptions({
		redirect: 'redirect.out'
	});
	lsetc.run(function () {
		console.log('** progress true');
		lsetc.run({progress: true}, function () {
			console.log('** progress 5');
			lsetc.run({progress: 5}, function () {
				console.log('** redirect + progress 1');
				lsetc.setOptions({
					redirect: 'redirect2.out',
					progress: 1
				});
				lsetc.run(function () {
					console.log('** redirect + progress true');
					lsetc.setOptions({
						redirect: 'redirect3.out',
						progress: true
					});
					lsetc.run(function () {
						console.log('** record');
						lsetc.run({record: 'direct.out'}, function () {
							console.log('** record + progress 3');
							lsetc.setOptions({
								record: 'direct2.out',
								progress: 3
							});
							lsetc.run(function () {
								console.log('** record + redirect');
								lsetc.setOptions({
									record: 'direct3.out',
									redirect: 'redirect4.out'
								});
								lsetc.run(function () {
									console.log('** record + redirect + progress 8');
									lsetc.run({
										record: 'direct4.out',
										redirect: 'redirect5.out',
										progress: 8
									});
								});
							});
						});
					});
				});
			});
		});
	});
});
