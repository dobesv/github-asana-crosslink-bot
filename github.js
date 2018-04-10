const rp = require('request-promise');
const URL = require('url').URL;

const settings = {
  github_token: process.env.GITHUB_TOKEN,
  login: process.env.GITHUB_LOGIN,
  webhook_secret: process.env.WEBHOOK_SECRET || 'x',
  debug: process.env.NODE_DEBUG === 'true',
};

const request = async options => {
  if (typeof options === 'string') {
    return request({ uri: options, method: 'GET' });
  }
  options.url = new URL(options.url, 'https://api.github.com').toString();
  if (!options.headers) options.headers = {};
  if (!options.headers.Authorization)
    options.headers.Authorization = `token ${settings.github_token}`;
  if (!options.headers['User-Agent'])
    options.headers['User-Agent'] = 'rebasebot';
  options.json = true;
  if (typeof options.body === 'object' && !options.headers['Content-Type'])
    options.headers['Content-Type'] = 'application/json';
  if (!options.headers.Accept)
    options.headers.Accept = 'application/vnd.github.v3+json';
  if (settings.debug) console.log('request', options);
  return rp(options);
};

const add_reaction_to_comment = (url, reaction) =>
  request({
    method: 'POST',
    url: `${url}/reactions`,
    headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
    json: true,
    body: {
      content: reaction,
    },
  });

const delete_reaction = reaction =>
  request({
    method: 'DELETE',
    url: `/reactions/${reaction.id}`,
    headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
    json: true,
  });

const add_comment_to_issue = (url, body) =>
  request({
    method: 'POST',
    uri: `${url}/comments`,
    body: { body: body },
  });

module.exports = {
  request: request,
  add_reaction_to_comment: add_reaction_to_comment,
  delete_reaction: delete_reaction,
  add_comment_to_issue: add_comment_to_issue,
};
