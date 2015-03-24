# 0.0.4

Using onInvalidate instead of onStop because it makes much more sense. Suppose you have a global subscription like this:

```coffee
Tracker.autorun ->
  subsCache.subscribe('post', Session.get('postId'))
```

We want the `delayedStop` to start whenever this computation is rerun, not when its stopped because it will never be stopped during the lifetime of the app.

# 0.0.3

Error if you didnt pass an object!

# 0.0.2

Added onReady callbacks. Also forgot the reactive-var dependency