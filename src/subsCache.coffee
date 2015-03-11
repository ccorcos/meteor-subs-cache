# Fires a function when computation stops. 
Tracker.Computation.prototype.onStop = (func) ->
  checkNextInvalidate = =>
    this.onInvalidate (comp) ->
      if comp.stopped
        func()
      else
        Tracker.afterFlush(checkNextInvalidate)
        
  checkNextInvalidate()
  return

# debug = (args...) -> console.log.apply(console, args)
debug = (args...) -> return

class @SubsCache
  constructor: (obj) ->
    {expireAfter, cacheLimit} = obj
    # defaults
    if expireAfter is undefined
      expireAfter = 5
    if cacheLimit is undefined
      cacheLimit = 10
    # catch an odd error
    if cacheLimit is 0
      console.warn "cacheLimit cannot be zero!"
      cacheLimit = 1
    # initialize instance variables
    @expireAfter = expireAfter
    @cacheLimit = cacheLimit
    @cache = {}
    @allReady = new ReactiveVar(true)

  ready: ->
    @allReady.get()

  clear: ->
    _.values(@cache).map((sub)-> sub.stopNow())

  subscribe: (args...) ->
    args.unshift(@expireAfter)
    @subscribeFor.apply(this, args)

  subscribeFor: (expireTime, args...) ->
    if Meteor.isServer
      # If we're using fast-render for SSR
      Meteor.subscribe.apply(Meteor.args)
    else
      hash = EJSON.stringify(args)
      cache = @cache
      if hash of cache
        # if we find this subscription in the cache, then restart it
        cache[hash].restart()
      else
        # make sure the subscription won't be stopped if we are in a reactive computation
        sub = Tracker.nonreactive -> Meteor.subscribe.apply(Meteor, args)
        # create an object to represent this subscription in the cache
        cachedSub =
          sub: sub
          hash: hash
          timerId: null
          expireTime: expireTime
          when: null
          ready: -> 
            @sub.ready()
          start: ->
            # so we know what to throw out when the cache overflows
            @when = Date.now() 
            # if the computation stops, then delayedStop
            c = Tracker.currentComputation
            c?.onStop => 
              @delayedStop()
          stop: -> @delayedStop()
          delayedStop: ->
            if expireTime >= 0
              @timerId = Meteor.setTimeout(@stopNow.bind(this), expireTime)
          restart: ->
            # if we'are restarting, then stop the timer
            Meteor.clearTimeout(@timerId)
            @start()
          stopNow: ->
            @sub.stop()
            delete cache[@hash]

        # delete the oldest subscription if the cache has overflown
        if @cacheLimit > 0
          allSubs = _.sortBy(_.values(cache), (x) -> x.when)
          numSubs = allSubs.length
          if numSubs >= @cacheLimit
            needToDelete = numSubs - @cacheLimit + 1
            for i in [0...needToDelete]
              allSubs[i].stopNow()


        cache[hash] = cachedSub
        cachedSub.start()

        # reactively set the allReady reactive variable
        @allReadyComp?.stop() 
        Tracker.autorun (c) =>
          @allReadyComp = c
          subs = _.values(@cache)
          if subs.length > 0
            @allReady.set subs.map((x) -> x.ready()).reduce((a,b) -> a and b)

      return cache[hash]