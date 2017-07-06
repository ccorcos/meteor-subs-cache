Package.describe({
  name: 'ccorcos:subs-cache',
  summary: 'A package for caching Meteor subscriptions.',
  version: '0.9.0',
  git: 'https://github.com/ccorcos/meteor-subs-cache'
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1');

  api.use([
    'ecmascript',
    'underscore',
    'ejson',
    'tracker',
    'reactive-var'
  ], ['client', 'server']);

  api.addFiles([
    'src/SubsCache.js',
  ], ['client','server']);

  api.export("SubsCache", ['client','server']);
});
