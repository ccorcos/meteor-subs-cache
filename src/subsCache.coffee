# debug = (args...) -> console.log.apply(console, args)
debug = (args...) -> return

makeCallbackDelegatorFn = (cachedSub, listName)->
  ->
    originalThis = @
    originalArgs = arguments
    _.each cachedSub[listName], (f)->
      f.apply originalThis, originalArgs

class @SubsCache
  @caches: []
  
  constructor: (obj) ->
    expireAfter = undefined
    cacheLimit = undefined
    if obj
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
    SubsCache.caches.push(@)

  ready: ->
    @allReady.get()

  onReady: (callback) ->
    Tracker.autorun (c) =>
      if @ready()
        c.stop()
        callback()

  @clearAll: ->
    @caches.map (s) -> s.clear()

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
      # extract any callbacks fom the arguments
      # this logic is copied from Meteor.subscribe found in
      # https://github.com/meteor/meteor/blob/master/packages/ddp/livedata_connection.js
      callbacks = {}
      if args.length
        [..., lastArg] = args
        if _.isFunction(lastArg) # onReady callback
          callbacks.onReady = args.pop()
        else if lastArg and _.any([
            lastArg.onReady,
            lastArg.onError,
            lastArg.onStop
          ], _.isFunction)
          callbacks = args.pop()

      hash = EJSON.stringify(args)
      cache = @cache
      if hash of cache
        # if we find this subscription in the cache, then rescue the callbacks
        # and restart the cached subscription
        if _.isFunction callbacks.onReady
          cache[hash].onReady callbacks.onReady
        if _.isFunction callbacks.onError
          cache[hash].errorCallbacks.push callbacks.onError
        if _.isFunction callbacks.onStop
          cache[hash].stopCallbacks.push callbacks.onStop
        cache[hash].restart()

      else
        # create an object to represent this subscription in the cache
        cachedSub =
          sub: null
          hash: hash
          timerId: null
          expireTime: expireTime
          when: null
          stopCallbacks: []
          errorCallbacks: []
          ready: ->
            @sub.ready()
          onReady: (callback)->
            if @ready() 
              Tracker.nonreactive -> callback()
            else
              Tracker.autorun (c) =>
                if @ready()
                  c.stop()
                  Tracker.nonreactive -> callback()
          start: ->
            # so we know what to throw out when the cache overflows
            @when = Date.now() 
            # if the computation stops, then delayedStop
            c = Tracker.currentComputation
            c?.onInvalidate => 
              @delayedStop()
          stop: -> @delayedStop()
          delayedStop: ->
            if expireTime >= 0
              @timerId = Meteor.setTimeout(@stopNow.bind(this), expireTime*1000*60)
          restart: ->
            # if we'are restarting, then stop the timer
            Meteor.clearTimeout(@timerId)
            @start()
          stopNow: ->
            @sub.stop()
            delete cache[@hash]

        # The semantics of an onReady callback are handled by cachedSub.onReady, so we
        # use that for future such callbacks. We replace the other callbacks with a
        # delegation function that calls all of the callbacks of that type that we may
        # be given in the future.
        if _.isFunction callbacks.onError
          cachedSub.errorCallbacks.push callbacks.onError
        if _.isFunction callbacks.onStop
          cachedSub.stopCallbacks.push callbacks.onStop
        callbacks.onError = makeCallbackDelegatorFn cachedSub, "errorCallbacks"
        callbacks.onStop = makeCallbackDelegatorFn cachedSub, "stopCallbacks"
        args.push callbacks

        # make sure the subscription won't be stopped if we are in a reactive computation
        sub = Tracker.nonreactive -> Meteor.subscribe.apply(Meteor, args)
        cachedSub.sub = sub

        # delete the oldest subscription if the cache has overflown
        if @cacheLimit > 0
          allSubs = _.sortBy(_.values(cache), (x) -> x.when)
          numSubs = allSubs.length
          if numSubs >= @cacheLimit
            needToDelete = numSubs - @cacheLimit + 1
            for i in [0...needToDelete]
              debug "overflow", allSubs[i]
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