# github-asana-crosslink-bot
Automatically reverse-link github PRs / Issues and Asana tasks

## Setup

1. Typically you will want to setup a special purpose github account for this purpose.  This user should have push access
   to all the repos you want to use this bot on.

2. Copy secrets-template.yml to secrets.yml and fill in the blanks
   
   To get project IDs and section IDs you can use the API explorer:
   
   https://asana.com/developers/api-reference/projects#   
      
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

