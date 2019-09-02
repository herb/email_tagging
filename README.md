# prep

It's assumed you have a `config.json` in the parent directory of where you run
this that has credentials for a gmail api app.

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
```

# install and running

```
$ yarn
$ yarn build && yarn start
```
