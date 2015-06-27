testCallbacks = function(done) {
	"use strict";

	/** Record that a function was called. */
	var record = function(o, f) {
		return function() { o[f] = true; };
	};

	/**
	 * Test two idenical concurrent subscriptions' onReady callbacks using the single
	 * callback syntax.
	 */
	var testSingleCallbackSyntax = function(subscriber, results, done) {
		var s1 = subscriber.subscribe("posts", 3, record(results, "fn onready 1"));
		var s2 = subscriber.subscribe("posts", 3, record(results, "fn onready 2"));
		setTimeout(function(){
			s1.stop();
			s2.stop();
			setTimeout(done, 1000);
		}, 1000);
	};

	/**
	 * Test two idenical concurrent subscriptions' onReady callbacks using the object
	 * callback syntax.
	 */
	var testObjectCallbackSyntaxOnReady = function(subscriber, results, done) {
		var s1 = subscriber.subscribe("posts", 3, {onReady: record(results, "obj onready 1")});
		var s2 = subscriber.subscribe("posts", 3, {onReady: record(results, "obj onready 2")});
		setTimeout(function(){
			s1.stop();
			s2.stop();
			setTimeout(done, 1000);
		}, 1000);
	};

	/**
	 * Test two idenical concurrent subscriptions' onStop callbacks.
	 */
	var testOnStopCallbacks = function(subscriber, results, done) {
		var s1 = subscriber.subscribe("posts", 3, {onStop: record(results, "onstop 1")});
		var s2 = subscriber.subscribe("posts", 3, {onStop: record(results, "onstop 2")});
		setTimeout(function(){
			s1.stop();
			s2.stop();
			setTimeout(done, 1000);
		}, 1000);
	};

	var cacheSettings = {expireAfter: 0.0001, cacheLimit: 10};
	var desired = {};
	var actual = {};

	console.log("Starting callback tests...");
	testSingleCallbackSyntax(Meteor, desired, function(){
		testSingleCallbackSyntax(new SubsCache(cacheSettings), actual, function() {
			testObjectCallbackSyntaxOnReady(Meteor, desired, function(){
				testObjectCallbackSyntaxOnReady(new SubsCache(cacheSettings), actual, function() {
					testOnStopCallbacks(Meteor, desired, function(){
						testOnStopCallbacks(new SubsCache(cacheSettings), actual, function() {

							console.log("Desired behavior", desired);
							console.log("SubsCache behavior", actual);
							console.log("Success is", _.isEqual(desired, actual));

							if (_.isFunction(done)) done();
						});
					});
				});
			});
		});
	});
};
