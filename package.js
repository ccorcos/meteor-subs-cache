Package.describe({
  name: 'ccorcos:subs-cache',
  summary: 'A package for caching Meteor subscriptions.',
  version: '0.0.1',
  git: 'https://github.com/ccorcos/meteor-subs-cache'
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1');

  api.use([
    'coffeescript',
    'underscore',
    'ejson',
    'tracker',
    'reactive-var'
  ], ['client', 'server']);

  api.addFiles([
    'src/subsCache.coffee',
  ], ['client', 'server']);

});