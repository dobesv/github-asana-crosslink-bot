# github-asana-crosslink-bot

Automatically reverse-link github PRs / Issues and Asana tasks

## Setup

1. Typically you will want to setup a special purpose github account for this purpose.  This user should have push access
   to all the repos you want to use this bot on.

2. Copy secrets-template.yml to secrets.yml and fill in the blanks
   
   To get project IDs and section IDs you can use the API:
   
   ASANA_ACCESS_TOKEN=$(yq r secrets.yml dev.ASANA_ACCESS_TOKEN)
   curl -X GET https://app.asana.com/api/1.0/projects \
     -H 'Accept: application/json' \
     -H "Authorization: Bearer ${ASANA_ACCESS_TOKEN}" | yq read --prettyPrint -
   ASANA_PROJECT=xxx
   curl -X GET https://app.asana.com/api/1.0/projects/${ASANA_PROJECT}/sections \
     -H 'Accept: application/json' \
     -H "Authorization: Bearer ${ASANA_ACCESS_TOKEN}" | yq read --prettyPrint -

   If you don't have the `yq` command then you can hopefully figure out how to replicate these
   `yq` operations in another way.
   
        
3. Install serverless on your PATH:

```
    $ yarn global add serverless
    $ export PATH="$(yarn global bin):$PATH"
```

## Deployment

`serverless deploy`

## Connect to repo

Add the webhook URL displayed by serverless as a webhook to your repository.  Make sure the secret matches and
you choose events for pull requests, issues, and all kinds of comments you want to have backlinks in Asana for.

## Watch logs

`serverless logs -f github_webhook -t`

