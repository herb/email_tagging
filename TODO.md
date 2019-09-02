1. proper validation of query parameters
2. unit tests for url detection code
    * most of the pieces have been assembled, need to string it all together
      (and figure out jasmine et al)
    * use node-mbox and messages in a local MBOX file for unit test
3. figure out how webpack/namespacing best practices for nodejs web apps on the
   browser
4. return direct URL to emails in results
5. do better than `any` on types for various function parameters
6. support scanning > 1 mailboxes at a time
    * will require persisting the oauth token and then usual async magic to
      make that efficient
7. breakup callback nesting hell
    * promises? async.waterfall?
8. 'parameterize' startup options--specifically location of config
