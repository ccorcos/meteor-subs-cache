/* eslint-env mocha */
import {Meteor} from 'meteor/meteor';
import {chai, assert} from 'meteor/practicalmeteor:chai';

var exists = function (value) {
	assert.isDefined(value);
	assert.isNotNull(value);
};

describe("SubsCache", function () {

	it("is globally accessible", function () {
		exists(SubsCache);
	});

	it("has global 'helpers' accessible", function () {
		exists(SubsCache.helpers);
	});

	it("has global 'caches' accessible", function () {
		exists(SubsCache.caches);
	});

	it("has global 'clearAll' accessible", function () {
		exists(SubsCache.clearAll);
	});

	it("has global 'computeHash' accessible", function () {
		exists(SubsCache.computeHash);
	});
});

describe("SubsCache.helpers", function () {

	var cb = function (err, res) {};

	describe("hasCallbacks", function () {

		it("returns true, if last argument is a callback", function () {
			var hasCallbacks = SubsCache.helpers.hasCallbacks;
			assert.isTrue(hasCallbacks.call(null, [cb]));
			assert.isTrue(hasCallbacks.call(null, [null, cb]));
			assert.isTrue(hasCallbacks.call(null, [null, null, cb]));
		});

		it("returns false, if last argument is not a callback", function () {
			var hasCallbacks = SubsCache.helpers.hasCallbacks;
			assert.isFalse(hasCallbacks.call(null, [1]));
			assert.isFalse(hasCallbacks.call(null, ["foo"]));
			assert.isFalse(hasCallbacks.call(null, [{}]));
			assert.isFalse(hasCallbacks.call(null, [undefined]));
			assert.isFalse(hasCallbacks.call(null, [null]));
		});

		it("returns false if no arguments are given", function () {
			var hasCallbacks = SubsCache.helpers.hasCallbacks;
			assert.isFalse(hasCallbacks.call(null, []));
			assert.isFalse(hasCallbacks.call(null));
		});
	});

	describe("withoutCallbacks", function () {

		it ("returns an array without callbacks on an array with callbacks", function () {
			var withoutCallbacks = SubsCache.helpers.withoutCallbacks;

			var withoutCb1 = withoutCallbacks.call(null, [cb]);
			assert.deepEqual(withoutCb1, []);

			var withoutCb2 = withoutCallbacks.call(null, [1,2,3, cb]);
			assert.deepEqual(withoutCb2, [1,2,3]);
		});

		it ("returns an empty array on empty or non existent input", function () {
			var withoutCallbacks = SubsCache.helpers.withoutCallbacks;

			assert.deepEqual(withoutCallbacks.call(null), []);
			assert.deepEqual(withoutCallbacks.call(null, null), []);
			assert.deepEqual(withoutCallbacks.call(null, undefined), []);
		});
	});


	describe("callbacksFromArgs", function () {

		it ("extracts callbacks from args if existent", function () {
			var callbacksFromArgs = SubsCache.helpers.callbacksFromArgs;

			assert.deepEqual(callbacksFromArgs.call(null, [null, cb]), {onReady: cb});
		});

		it ("returns an empty object of no callback is existent in args", function () {
			var callbacksFromArgs = SubsCache.helpers.callbacksFromArgs;

			assert.deepEqual(callbacksFromArgs.call(null), {});
			assert.deepEqual(callbacksFromArgs.call(null, []), {});
			assert.deepEqual(callbacksFromArgs.call(null, [1]), {});
			assert.deepEqual(callbacksFromArgs.call(null, ["foo"]), {});
			assert.deepEqual(callbacksFromArgs.call(null, [null]), {});
			assert.deepEqual(callbacksFromArgs.call(null, null), {});
			assert.deepEqual(callbacksFromArgs.call(null, undefined), {});
		});
	});
})

describe("SubsCache - instantiation", function () {

	it("is instatiated with default settings", function () {
		assert.fail("not yet implemented");
	});

	it("is instantiated with custom settings", function () {
		assert.fail("not yet implemented");
	});
});

describe("SubsCache - subscribe", function () {

	it("creates a subscription just like Meteor.subscribe", function () {
		assert.fail("not yet implemented");
		//sub = subsCache.subscribe(...)
	});

	it("allow you to set the expiration other than the defualt", function () {
		assert.fail("not yet implemented");
		//subsCache.subscribeFor(expireIn, ...)
	});

	it("allow you to set the expiration other than the defualt", function () {
		assert.fail("not yet implemented");
		//subsCache.subscribeFor(expireIn, ...)
	});
});

describe("SubsCache - ready", function () {

	describe("individual", function () {

		it("tells you if an individual subscription is ready", function () {
			assert.fail("not yet implemented");
			//sub.ready()
		});

		it("will call a function once an individual subscription is ready", function () {
			assert.fail("not yet implemented");
			//sub.onReady(func)
		});
	})

	describe("all", function () {

		it("tells you if all subscriptions in the cache are ready", function () {
			assert.fail("not yet implemented");
			//subsCache.allReady()
		});

		it("will call a function once all subscription are ready", function () {
			assert.fail("not yet implemented");
			//subsCache.onReady(func)
		});

	})

});


describe("SubsCache - stop", function () {

	it("will cache a subscription and stop after expireAfter unless restarted with sub.restart()", function () {
		assert.fail("not yet implemented");
		//sub.stop()
	});

	it("will stop a subscription immediately and remove it from the cache.", function () {
		assert.fail("not yet implemented");
		//sub.stopNow()
	});

	it("will stop all subscription immediately", function () {
		assert.fail("not yet implemented");
		//subsCache.clear()
	});
});
