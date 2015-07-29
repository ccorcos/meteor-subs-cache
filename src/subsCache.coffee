# debug = (args...) -> console.log.apply(console, args)
debug = (args...) -> return


hasCallbacks = (args)->
  # this logic is copied from Meteor.subscribe found in
  # https://github.com/meteor/meteor/blob/master/packages/ddp/livedata_connection.js
  if args.length
    lastArg = args[args.length-1]
    _.isFunction(lastArg) or
      (lastArg and _.any([
        lastArg.onReady,
        lastArg.onError,
        lastArg.onStop
      ], _.isFunction))

withoutCallbacks = (args)->
  if hasCallbacks args
    args[..-1]
  else
    args[..]

callbacksFromArgs = (args)->
  if hasCallbacks args
    if _.isFunction args[args.length-1]
      onReady: args[args.length-1]
    else
      args[args.length-1]
  else
    {}

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
      hash = EJSON.stringify(withoutCallbacks args)
      cache = @cache
      if hash of cache
        # if we find this subscription in the cache, then rescue the callbacks
        # and restart the cached subscription
        if hasCallbacks args
          cache[hash].addHooks callbacksFromArgs args
        cache[hash].restart()
      else
        # create an object to represent this subscription in the cache
        cachedSub =
          sub: null
          hash: hash
          timerId: null
          expireTime: expireTime
          when: null
          hooks: []
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
          addHooks: (callbacks)->
            # @onReady has the correct behaviour for new onReady callbacks, the
            # rest are stored for calling later
            if _.isFunction callbacks.onReady
              @onReady callbacks.onReady
              delete callbacks.onReady
            @hooks.push callbacks
          makeCallHooksFn: (hookName)->
            # returns a function that passes its this argument and arguments list
            # to each of the hooks with the given name
            cachedSub = @
            ->
              originalThis = @
              originalArgs = arguments
              _.each cachedSub.hooks, (hookDict)->
                if _.isFunction hookDict[hookName]
                  hookDict[hookName].apply originalThis, originalArgs
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

        # create the subscription, giving it callbacks that call our stored hooks
        newArgs = withoutCallbacks args
        newArgs.push
          onError: cachedSub.makeCallHooksFn 'onError'
          onStop: cachedSub.makeCallHooksFn 'onStop'
        # make sure the subscription won't be stopped if we are in a reactive computation
        cachedSub.sub = Tracker.nonreactive -> Meteor.subscribe.apply(Meteor, newArgs)

        if hasCallbacks args
          cachedSub.addHooks callbacksFromArgs args

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