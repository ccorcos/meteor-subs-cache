/* eslint-env mocha */
import {Meteor} from 'meteor/meteor';
import {chai, assert} from 'meteor/practicalmeteor:chai';

describe("SubsCache - Common", function () {

	it("is globally accessible", function () {
		assert.isDefined(SubsCache);
		assert.isNotNull(SubsCache);
	});

});

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
