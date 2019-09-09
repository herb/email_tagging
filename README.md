# intro

This is a scanner for your gmail messages. It currently scans for
* unrestricted shares on dropbox and gdrive
* potential lateral phishing attempts

It also scans multiple mailboxes at the same time assuming you've oauth access
for each mailbox.

Everything is very hacky at this point. No tests to speak of. Hardcoded paths
for config files and persisted credentials. But the bones are there. Feedback
welcome. :)

# install and running

It's assumed you have a `config.json` in the parent directory, `../`, of where
you run this that has credentials for a gmail api app.

`config.json` should have the following form:
```
{
  "base_url": "http://localhost:3000",
  "googleapi": {
    "client_id": "<YOUR CLIENT ID>",
    "client_secret": "<YOUR CLIENT SECRET>",
    "client_callback_url": "http://localhost:3000/gmail/auth/callback"
  },
}

It's also assumed the Gmail API is enabled in the API console with
`http://localhost:3000/gmail/auth/callback` listed as an `authorized redirect
URIs`.
```

then yarn install, build, and start

```
$ yarn
$ yarn build && yarn start
```

# using it

1. visit http://localhost:3000
    * this should redirect you to `/gmail/auth`
    * and grant your app authorization to read your mailbox.
2. if everything worked it'll redirect you back to the homepage and start
   processing your emails
3. if you have oauth'd to multiple mailboxes you can visit
   http://localhost:3000/all and it'll scan all the mailboxes it knowns about
   all at once.
3. yay
