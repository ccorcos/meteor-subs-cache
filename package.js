Package.describe({
  name: "ccorcos:subs-cache",
  summary: "A package for caching Meteor subscriptions.",
  version: "0.9.12",
  git: "https://github.com/ccorcos/meteor-subs-cache"
});

Package.onUse(function(api) {
  api.versionsFrom("METEOR@1.6.1");

  api.use(
    ["ecmascript@0.8.3", "ejson", "tracker", "reactive-var"],
    ["client", "server"]
  );

  api.addFiles(["src/SubsCache.js"], ["client", "server"]);

  api.export("SubsCache", ["client", "server"]);
});

Package.onTest(function(api) {
  api.use(
    [
      "ecmascript",
      "ejson",
      "tracker",
      "reactive-var",
      "ccorcos:subs-cache",
      "practicalmeteor:chai",
      "cultofcoders:mocha"
    ],
    ["client", "server"]
  );
  api.mainModule("src/SubsCache.tests.js");
});
