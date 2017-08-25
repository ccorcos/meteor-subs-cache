import { EJSON } from 'meteor/ejson'
import {ReactiveVar} from 'meteor/reactive-var';

function hasCallbacks(args){
  // this logic is copied from Meteor.subscribe found in
  // https://github.com/meteor/meteor/blob/master/packages/ddp/livedata_connection.js
  if (args && args.length) {
    var lastArg = args[args.length-1];
    var isFct = _.isFunction(lastArg);
    var retValue = !!(lastArg && _.any([lastArg.onReady, lastArg.onError, lastArg.onStop], _.isFunction));
    return  isFct || retValue;
  }else{
    return false;
  }
};

function withoutCallbacks(args){
  if (hasCallbacks(args)) {
    return args.slice(0,args.length-1);
  } else {
    return args && args.length > 0 ? args.slice() : [];
  }
};

function callbacksFromArgs(args){
  if (hasCallbacks(args)) {
    if (_.isFunction(args[args.length-1])) {
      return {onReady: args[args.length-1]};
    } else {
      return args[args.length-1];
    }
  } else {
    return {};
  }
};

SubsCache = function(expireAfter, cacheLimit, debug=false) {
  var self = this;

  this.debug = false;
  this.expireAfter = expireAfter || 5;
  this.cacheLimit = cacheLimit || 10;
  this.cache = {};
  this.allReady = new ReactiveVar(true);

  SubsCache.caches.push(this);

  this.ready = function() {
    return this.allReady.get();
  }

  this.onReady = function(callback) {
    Tracker.autorun(function(c) {
      if (self.allReady.get()) {
        c.stop();
        return callback();
      }
    });
  }

  this.clear = function() {
    return _.values(this.cache).map(function(sub) { sub.stopNow() });
  }

  this.subscribe = function(...args) {
    if (SubsCache.debug)
      console.log('SubsCache - subscribe',args);
    args.unshift(this.expireAfter);
    return this.subscribeFor.apply(this, args);
  }

  this.subscribeFor = function(expireTime, ...args) {
    var hash = EJSON.stringify(withoutCallbacks(args));

    if (hash in this.cache) {
      // if we find this subscription in the cache, then save the callbacks
      // and restart the cached subscription
      if (hasCallbacks(args)) {
        // TODO: remove duplicate callbacks -- in case of reactive subscriptions
        this.cache[hash].addHooks(callbacksFromArgs(args));
      }
      this.cache[hash].restart();
    }
    else {
      // create an object to represent this subscription in the cache
      var cachedSub = {
        sub: null,
        hash,
        count: 0,
        timerId: null,
        expireTime: expireTime,
        startedAt: null,
        hooks: [],
        ready: function() {
          return this.sub.ready();
        },
        onReady: function(callback) {
          if (this.sub.ready()) {
            return Tracker.nonreactive(function() { callback() });
          } else {
            var cachedSub = this;
            return Tracker.autorun(function(c) {
              if (cachedSub.sub.ready()) {
                c.stop();
                return Tracker.nonreactive(function() { callback() });
              }
            });
          }
        },
        addHooks: function(callbacks){
          // @onReady has the correct behaviour for new onReady callbacks, the
          // rest are stored for calling later
          if (_.isFunction(callbacks.onReady)) {
            this.onReady(callbacks.onReady);
            delete callbacks.onReady;
          }
          return this.hooks.push(callbacks);
        },
        makeCallHooksFn: function(hookName){
          // returns a function that passes its this argument and arguments list
          // to each of the hooks with the given name
          cachedSub = this;
          return function() {
            let originalThis = this;
            let originalArgs = arguments;
            return _.each(cachedSub.hooks, function(hookDict) {
              if (_.isFunction(hookDict[hookName])) {
                return hookDict[hookName].apply(originalThis, originalArgs);
              }
            });
          };
        },
        start: function() {
          // so we know what to throw out when the cache overflows
          this.startedAt = Date.now();
          // we need to count the number of computations that have called
          // this subscription so that we don't release it too early
          this.count += 1;

          // if we are inside a Tracker computation, we stop when it stops -- e.g. for convenience in templates
          var c = Tracker.currentComputation;
          if (c) {
            var self = this;
            c.onInvalidate(function() {
              self.stop();
            });
          }
        },
        stop: function() {
          if (SubsCache.debug) console.log('SubsCache - stop: ' + this.hash);
          if (this.expireTime >= 0) {
            this.timerId = setTimeout(this.stopNow.bind(this), this.expireTime*1000*60);
          }
          else {
            this.stopNow();
          }
        },
        restart: function() {
          // if we'are restarting, then stop the current timer (previous ones still tick otherwise we would have inconsistencies)
          if (this.timerId) clearTimeout(this.timerId);
          return this.start();
        },
        stopNow: function() {
          this.count -= 1;
          if (this.count <= 0) {
            if (SubsCache.debug) console.log('SubsCache - stopping: ' + this.hash);
            this.sub.stop();
            return delete self.cache[this.hash];
          }
          else {
            if (SubsCache.debug)
              console.log('SubsCache - stopNow: ' + this.count + ' remaining computation(s) for ' + this.hash);
          }
        }
      };

      // create the subscription, giving it callbacks that call our stored hooks
      var newArgs = withoutCallbacks(args);
      newArgs.push({
        onError: cachedSub.makeCallHooksFn('onError'),
        onStop: cachedSub.makeCallHooksFn('onStop')
      });

      // make sure the subscription won't be stopped if we are in a reactive computation
      cachedSub.sub = Tracker.nonreactive(function() { return Meteor.subscribe.apply(Meteor, newArgs) });

      if (hasCallbacks(args)) {
        cachedSub.addHooks(callbacksFromArgs(args));
      }

      // delete the oldest subscription if the cache has overflown
      if (this.cacheLimit > 0) {
        var allSubs = _.values(this.cache);
        var numSubs = allSubs.length;
        if (numSubs >= this.cacheLimit) {
          var sortedSubs = _.sortBy(allSubs, function(x) { return x.startedAt });
          var needToDelete = (numSubs - this.cacheLimit) + 1;
          if (SubsCache.debug)
            console.log("SubsCache - overflow: Need to clear " + needToDelete + " subscription(s)");
          for (var i = 0; i < needToDelete; i++) {
            allSubs[i].count = 0;
            allSubs[i].stopNow();
          }
        }
      }

      this.cache[hash] = cachedSub;
      cachedSub.start();

      // reactively set the allReady reactive variable
      if (this.allReadyComp != null) this.allReadyComp.stop();
      Tracker.autorun(function(c) {
        self.allReadyComp = c;
        let subs = _.values(self.cache);
        if (subs.length > 0) {
          return self.allReady.set(subs.map(function(x) { return x.ready()}).reduce(function(a,b) {return a && b}));
        }
      });
    }

    return this.cache[hash];
  } // end of this.subscribeFor

}

SubsCache.caches = [];
SubsCache.clearAll = function() {
  this.caches.map(function(s) { s.clear()});
};

SubsCache.computeHash = function(...args) {
  return EJSON.stringify(withoutCallbacks(args));
};

// required in order to make
// to make helpers accessible
// to unit tests
SubsCache.helpers = {
	hasCallbacks: hasCallbacks,
	withoutCallbacks: withoutCallbacks,
	callbacksFromArgs: callbacksFromArgs
}
