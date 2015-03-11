N_POSTS = 1000

Meteor.startup ->
  if Posts.find().count() is 0
    console.log "creating fake posts"
    
    for j in [0...N_POSTS]
      Posts.insert
        title: Fake.sentence(3)
        date: Date.now()

Meteor.publish 'posts', (limit) ->
  Posts.find( {}, {sort: {name: 1, date: -1}, limit: limit} )