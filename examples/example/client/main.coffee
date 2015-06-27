
subsCache = new SubsCache
  expireAfter: 0.1
  cacheLimit: 2

delay = (s, func) -> Meteor.setTimeout(func, s*1000)

Meteor.startup ->
  s1 = subsCache.subscribe('posts', 1)
  console.log "here"
  s1.onReady ->
    console.log "number of posts should be 1", Posts.find().count()
    s2 = subsCache.subscribe('posts', 2)
    s2.onReady ->
      console.log "number of posts should be 2", Posts.find().count()
      console.log "s1 should be ready", s1.ready()
      s3 = subsCache.subscribe('posts', 3)
      s3.onReady ->
        # should have dropped the 1 post
        console.log "number of posts should be 3", Posts.find().count()
        console.log "s1 should not be ready because cache overflow", s1.ready()
        a = subsCache.subscribe('posts', 1)
        a.onReady ->
          console.log "number of posts should still be 3", Posts.find().count()
          b = subsCache.subscribe('posts', 1)
          b.onReady ->
            console.log "number of posts should still be 3 because subscription b came from the cache", s3.ready()
            c = subsCache.subscribe('posts', 2)
            delay 1, ->
              console.log "number of posts should now be 2", Posts.find().count()
              c.stopNow()
              delay 1, ->
                console.log "number of posts should be 1", Posts.find().count()
                # only one left in the cache
                a.stop()
                console.log "number of posts should be 1 until 6 seconds later"
                delay 2, ->
                  console.log "2 seconds later...", Posts.find().count()
                  delay 6, ->
                    console.log "8 seconds later...", Posts.find().count()
                    testCallbacks()
