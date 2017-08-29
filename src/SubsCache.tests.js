/* eslint-env mocha */
import {Meteor} from 'meteor/meteor';
import {Mongo} from 'meteor/mongo';
import {chai, assert} from 'meteor/practicalmeteor:chai';

//==========================//
// CREATE SOME PUBLICATIONS //
//==========================//

var FakeCollection = new Mongo.Collection("tests");
var publicationAllDocuments     = "FakeCollection.publication.all"
var publicationSomeDOcuments    = "FakeCollection.publication.some"
var methodAddDocument           = "FakeCollection.methods.add";

if (Meteor.isServer) {
	FakeCollection.remove({});
	FakeCollection.insert({value:0});
	FakeCollection.insert({value:0});
	FakeCollection.insert({value:0});
	FakeCollection.insert({value:1});
	FakeCollection.insert({value:1});
	FakeCollection.insert({value:1});
	Meteor.publish(publicationAllDocuments, function () {
		return FakeCollection.find();
	});

	Meteor.publish(publicationSomeDOcuments, function () {
		return FakeCollection.find({value:1});
	});

	var methods = {};
	methods[methodAddDocument] = function () {
		FakeCollection.insert({value:0});
	};
	Meteor.methods(methods)
}

//==========================//
// TEST HELPERS             //
//==========================//

var exists = function (value) {
	assert.isDefined(value);
	assert.isNotNull(value);
};

var notExists = function(value) {
	var isUndefined = typeof value === "undefined";
	var isNull = value === null;
	assert.isTrue(isUndefined || isNull);
}

//==========================//
// TESTS                    //
//==========================//

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

	it ("is instantiated as SubsCache instance", function () {
		var subsCache = new SubsCache();
		exists(subsCache);
		assert.instanceOf(subsCache, SubsCache);
	});

	it("is instatiated with default settings", function () {
		var subsCache = new SubsCache();
		assert.equal(subsCache.cacheLimit, 10);
		assert.equal(subsCache.expireAfter, 5);
		assert.equal(subsCache.debug, false);
	});

	it("is instantiated with custom settings", function () {

		var subsCache = new SubsCache(100,100,true);
		assert.equal(subsCache.cacheLimit, 100);
		assert.equal(subsCache.expireAfter, 100);
		assert.equal(subsCache.debug, true);
	});
});

if (!Meteor.isClient) return;

describe("SubsCache - subscribe", function () {

	it("creates a subscription just like Meteor.subscribe", function () {
		var subsCache = new SubsCache();
		var sub = subsCache.subscribe(publicationAllDocuments);

		assert.equal(sub.count, 1);
		assert.equal(sub.expireTime, 5);
		exists(sub.sub);

		assert.equal(Object.keys(subsCache.cache).length, 1);
	});

	it ("has sub stored in instance's cache object", function () {
		var subsCache = new SubsCache();
		var sub = subsCache.subscribe(publicationAllDocuments);
		var hash = SubsCache.computeHash(publicationAllDocuments);
		assert.equal(sub.hash, hash);

		var ref = subsCache.cache[hash];
		assert.deepEqual(ref, sub);
	});

	it("allow you to set the expiration other than the defualt", function () {
		var subsCache = new SubsCache();
		var subAll = subsCache.subscribeFor(25,publicationAllDocuments);
		assert.equal(subAll.expireTime, 25);
		assert.notEqual(subAll.expireTime, subsCache.expireAfter);
	});

	it ("expires after given time", function (done) {
		var subsCache = new SubsCache();
		var subAll = subsCache.subscribeFor(0.000001,publicationAllDocuments);
		subAll.stop();
		setTimeout(function(){
			assert.equal(Object.keys(subsCache.cache).length, 0);
			done();
		}, 1000);
	});

	it ("delete the oldest subscription if the cache has overflown", function () {
		var subsCache = new SubsCache(5,1);
		var subAll = subsCache.subscribe(publicationAllDocuments);
		var subSome = subsCache.subscribe(publicationSomeDOcuments);
		assert.equal(Object.keys(subsCache.cache).length, 1);

		var hashAll = SubsCache.computeHash(publicationAllDocuments);
		var hashSome = SubsCache.computeHash(publicationSomeDOcuments);

		exists(subsCache.cache[hashSome]);
		notExists(subsCache.cache[hashAll]);
	});

	it ("resets the time when restarted", function () {
		var subsCache = new SubsCache();
		var subAll = subsCache.subscribeFor(10,publicationAllDocuments);
		notExists(subAll.timerId);
		subAll.stop();
		exists(subAll.timerId);
		subAll.restart();
		notExists(subAll.timerId);
	})
});

import { Tracker } from 'meteor/tracker'

describe("SubsCache - ready", function () {

	describe("individual", function () {

		it("tells you if an individual subscription is ready", function (done) {
			var subsCache = new SubsCache();
			var subAll = subsCache.subscribe(publicationAllDocuments);
			assert.isFalse(subAll.ready());
			subAll.onReady(function () {
				assert.equal(FakeCollection.find().count(), 6);
				assert.isTrue(subAll.ready());
				done();
			})

		});

		it("will call a function once an individual subscription is ready", function (done) {
			var subsCache = new SubsCache();
			var subAll = subsCache.subscribe(publicationAllDocuments);
			subAll.onReady(function () {
				assert.equal(FakeCollection.find().count(), 6);
				done();
			})
		});
	})

	describe("all", function () {

		it("tells you if all subscriptions in the cache are ready", function (done) {
			var subsCache = new SubsCache();
			var sub1 = subsCache.subscribe(publicationAllDocuments);
			var sub2 = subsCache.subscribe(publicationSomeDOcuments);
			assert.isFalse(subsCache.ready());
			subsCache.onReady(function () {
				assert.isTrue(subsCache.ready());
				done();
			})
		});

		it("will call a function once all subscription are ready", function (done) {
			var subsCache = new SubsCache();
			var sub1 = subsCache.subscribe(publicationAllDocuments);
			var sub2 = subsCache.subscribe(publicationSomeDOcuments);
			subsCache.onReady(function () {
				assert.equal(FakeCollection.find().count(), 6);
				assert.equal(Object.keys(subsCache.cache).length, 2);
				assert.isTrue(sub1.ready());
				assert.isTrue(sub2.ready());
				done();
			})

		});

	})

});


describe("SubsCache - stop", function () {

	it("will cache a subscription and stop after expireAfter unless restarted with sub.restart()", function (done) {
		var subsCache = new SubsCache();
		var subAll = subsCache.subscribe(publicationAllDocuments);
		subAll.onReady(function () {
			subAll.stop();
			assert.equal(Object.keys(subsCache.cache).length, 1);
			assert.equal(FakeCollection.find().count(), 6);
			done();
		});
	});

	it("will stop a subscription immediately and remove it from the cache.", function (done) {
		var subsCache = new SubsCache();
		var subAll = subsCache.subscribe(publicationAllDocuments);
		subAll.onReady(function () {
			assert.equal(FakeCollection.find().count(), 6);
			assert.isTrue(subAll.stopNow());
			assert.equal(Object.keys(subsCache.cache).length, 0);
			assert.isFalse(subAll.ready());
			done();
		});
	});

	it("will stop all subscription immediately", function (done) {
		var subsCache = new SubsCache();
		var sub1 = subsCache.subscribe(publicationAllDocuments);
		var sub2 = subsCache.subscribe(publicationSomeDOcuments);
		assert.equal(Object.keys(subsCache.cache).length, 2);
		subsCache.onReady(function () {
			subsCache.clear();
			assert.equal(Object.keys(subsCache.cache).length, 0);
			assert.isFalse(sub1.ready());
			assert.isFalse(sub2.ready());
			done();
		});
	});
});
