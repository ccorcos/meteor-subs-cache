Package.describe({
  name: 'ccorcos:subs-cache',
  summary: 'A package for caching Meteor subscriptions.',
  version: '0.9.2',
  git: 'https://github.com/ccorcos/meteor-subs-cache'
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1');

  api.use([
    'underscore',
    'ecmascript',
    'ejson',
    'tracker',
    'reactive-var'
  ], ['client', 'server']);

  api.addFiles([
    'src/SubsCache.js',
  ], ['client','server']);

  api.export("SubsCache", ['client','server']);
});

Package.onTest(function(api) {
  api.use([
    'underscore',
    'ecmascript',
    'ejson',
    'tracker',
    'reactive-var',
    'ccorcos:subs-cache',
    'practicalmeteor:chai'
	], ['client', 'server']);
  api.mainModule('src/SubsCache.tests.js');
});
