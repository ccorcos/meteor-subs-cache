import { EJSON } from "meteor/ejson";
import { ReactiveVar } from "meteor/reactive-var";

function hasCallbacks(args) {
  // this logic is copied from Meteor.subscribe found in
  // https://github.com/meteor/meteor/blob/master/packages/ddp/livedata_connection.js
  if (args && args.length) {
    var lastArg = args[args.length - 1];
    var isFct = typeof lastArg === "function";
    var retValue = !!(
      lastArg &&
      [lastArg.onReady, lastArg.onError, lastArg.onStop].some(
        f => typeof f === "function"
      )
    );
    return isFct || retValue;
  } else {
    return false;
  }
}

function withoutCallbacks(args) {
  if (hasCallbacks(args)) {
    return args.slice(0, args.length - 1);
  } else {
    return args && args.length > 0 ? args.slice() : [];
  }
}

function callbacksFromArgs(args) {
  if (hasCallbacks(args)) {
    if (typeof args[args.length - 1] === "function") {
      return { onReady: args[args.length - 1] };
    } else {
      return args[args.length - 1];
    }
  } else {
    return {};
  }
}

function argsChanged(oldargs, newargs) {
  //obvious case
  if (oldargs.length !== newargs.length) return true;

  var cleanOldargs = withoutCallbacks(oldargs);
  var cleanNewargs = withoutCallbacks(newargs);

  var val1 = EJSON.stringify(cleanOldargs);
  var val2 = EJSON.stringify(cleanNewargs);

  return val1 !== val2;
}

SubsCache = function(expireAfter, cacheLimit, debug = false) {
  var self = this;
  var optionsObj = typeof expireAfter == "object";

  this.debug = optionsObj ? expireAfter.debug : debug;
  this.expireAfter = (optionsObj ? expireAfter.expireAfter : expireAfter) || 5;
  this.cacheLimit = (optionsObj ? expireAfter.cacheLimit : cacheLimit) || 10;
  this.cache = {};
  this.allReady = new ReactiveVar(true);

  SubsCache.caches.push(this);

  this.ready = function() {
    return this.allReady.get();
  };

  this.onReady = function(callback) {
    Tracker.autorun(function(c) {
      if (self.allReady.get()) {
        c.stop();
        return callback();
      }
    });
  };

  this.clear = function() {
    return Object.values(this.cache).map(function(sub) {
      sub.clear();
      sub.stopNow();
    });
  };

  this.subscribe = function(...args) {
    if (this.debug) console.log("SubsCache - subscribe", args);
    if (!args || args.length === 0 || typeof args[0] !== "string")
      throw new Meteor.Error(
        "500",
        "Invalid subscription call, first arg is expected to be a String."
      );
    args.unshift(this.expireAfter);
    return this.subscribeFor.apply(this, args);
  };

  this.subscribeFor = function(expireTime, ...args) {
    if (Meteor.isServer) {
      // If we're using fast-render for SSR
      return Meteor.subscribe.apply(Meteor, args);
    } else {
      var hash = EJSON.stringify(withoutCallbacks(args));
      var self = this;

      if (hash in this.cache && !argsChanged(this.cache[hash].args, args)) {
        // if we find this subscription in the cache, then save the callbacks
        // and restart the cached subscription
        if (hasCallbacks(args)) {
          // TODO: remove duplicate callbacks -- in case of reactive subscriptions
          this.cache[hash].addHooks(callbacksFromArgs(args));
        }

        this.cache[hash].restart();
      } else {
        // create an object to represent this subscription in the cache
        var cachedSub = {
          sub: null,
          args: null,
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
              return Tracker.nonreactive(function() {
                callback();
              });
            } else {
              var cachedSub = this;
              return Tracker.autorun(function(c) {
                if (cachedSub.sub.ready()) {
                  c.stop();
                  return Tracker.nonreactive(function() {
                    callback();
                  });
                }
              });
            }
          },
          addHooks: function(callbacks) {
            // @onReady has the correct behaviour for new onReady callbacks, the
            // rest are stored for calling later
            if (typeof callbacks.onReady === "function") {
              this.onReady(callbacks.onReady);
              delete callbacks.onReady;
            }
            return this.hooks.push(callbacks);
          },
          makeCallHooksFn: function(hookName) {
            // returns a function that passes its this argument and arguments list
            // to each of the hooks with the given name
            cachedSub = this;
            return function() {
              let originalThis = this;
              let originalArgs = arguments;
              return cachedSub.hooks.forEach(function(hookDict) {
                if (typeof hookDict[hookName] === "function") {
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
            if (self.debug) console.log("SubsCache - stop: " + this.hash);
            if (this.expireTime >= 0) {
              this.timerId = setTimeout(
                this.stopNow.bind(this),
                this.expireTime * 1000 * 60
              );
            } else {
              //inifinte expirations don't expire until the cache is full
              //just update the counter
              this.count -= 1;
            }
          },
          restart: function() {
            if (self.debug) console.log("SubsCache - restart: " + this.hash);
            // if we'are restarting, then stop the current timer (previous ones still tick otherwise we would have inconsistencies)
            if (this.timerId) {
              clearTimeout(this.timerId);
              this.timerId = null;
            }
            this.count -= 1;
            return this.start();
          },
          stopNow: function() {
            this.count -= 1;
            if (this.count <= 0) {
              if (self.debug) console.log("SubsCache - stopping: " + this.hash);
              this.sub.stop();
              return delete self.cache[this.hash];
            } else {
              if (self.debug)
                console.log(
                  "SubsCache - stopNow: " +
                    this.count +
                    " remaining computation(s) for " +
                    this.hash
                );
            }
          },
          clear() {
            // clear timer if exists
            if (this.timerId) {
              clearInterval(this.timerId);
              this.timerId = null;
            }
          }
        };

        // create the subscription, giving it callbacks that call our stored hooks
        var newArgs = withoutCallbacks(args);
        newArgs.push({
          onError: cachedSub.makeCallHooksFn("onError"),
          onStop: cachedSub.makeCallHooksFn("onStop")
        });

        // keep the current call's args
        // to allow clients to compare
        // their values
        cachedSub.args = args;

        // make sure the subscription won't be stopped if we are in a reactive computation
        cachedSub.sub = Tracker.nonreactive(function() {
          return Meteor.subscribe.apply(Meteor, newArgs);
        });

        if (hasCallbacks(args)) {
          cachedSub.addHooks(callbacksFromArgs(args));
        }

        // delete the oldest subscription
        if (this.cacheLimit > 0) {
          var allSubs = Object.values(this.cache);
          var numSubs = allSubs.length;
          if (numSubs >= this.cacheLimit) {
            var sortedSubs = allSubs.sort(function(a, b) {
              return a.startedAt - b.startedAt;
            });
            var needToDelete = numSubs - this.cacheLimit + 1;
            if (self.debug)
              console.log(
                "SubsCache - overflow: Need to clear " +
                  needToDelete +
                  " subscription(s)"
              );
            for (var i = 0; needToDelete && i < sortedSubs.length; i++) {
              var currentSub = sortedSubs[i];
              currentSub.clear();
              currentSub.stopNow();
              needToDelete--;
            }
            if (self.debug && needToDelete)
              console.log(
                "SubsCache - overflow: Still need to clear " +
                  needToDelete +
                  " subscription(s), but all are still active."
              );
          }
        }

        this.cache[hash] = cachedSub;
        cachedSub.start();

        // reactively set the allReady reactive variable
        if (this.allReadyComp != null) this.allReadyComp.stop();
        Tracker.nonreactive(() => {
          Tracker.autorun(function(c) {
            self.allReadyComp = c;
            let subs = Object.values(self.cache);
            if (subs.length > 0) {
              return self.allReady.set(
                subs
                  .map(function(x) {
                    return x.ready();
                  })
                  .reduce(function(a, b) {
                    return a && b;
                  })
              );
            }
          });
        });
      }

      return this.cache[hash];
    } // end of this.subscribeFor
  };
};

SubsCache.caches = [];
SubsCache.clearAll = function() {
  this.caches.map(function(s) {
    s.clear();
  });
};

SubsCache.computeHash = function(...args) {
  if (!args || args.length === 0 || typeof args[0] !== "string")
    throw new Meteor.Error(
      "500",
      "Invalid compute hash call, first is expected to be a String."
    );
  return EJSON.stringify(withoutCallbacks(args));
};

// required in order to make
// to make helpers accessible
// to unit tests
SubsCache.helpers = {
  hasCallbacks: hasCallbacks,
  withoutCallbacks: withoutCallbacks,
  callbacksFromArgs: callbacksFromArgs,
  argsChanged: argsChanged
};
