'use strict';

const get = require('lodash/get');
const fs = require('fs');
const github = require('./github');
const settings = {
  github_token: process.env.GITHUB_TOKEN,
  login: process.env.GITHUB_LOGIN,
  webhook_secret: process.env.WEBHOOK_SECRET || 'x',
  debug: false,
};
const asana = require('asana')
  .Client.create()
  .useAccessToken(process.env.ASANA_ACCESS_TOKEN);

// Helpers for returning a response
const badRequest = err => ({ statusCode: 400, body: String(err) });

// Convert async function into lambda handler
const handler = fn => (event, context, callback) => {
  const data = event.body[0] === '{' ? JSON.parse(event.body) : event.body;
  if (settings.debug)
    console.log('Request body:\n' + JSON.stringify(data, null, 2));
  Promise.resolve(null)
    .then(() => fn(data, event, context))
    .then(resp => {
      if (!resp) resp = { statusCode: resp === false ? 400 : 200, body: '' };
      else if (typeof resp === 'string') resp = { statusCode: 200, body: resp };
      else if (typeof resp === 'number') resp = { statusCode: resp };
      else if (!resp.statusCode) resp.statusCode = 200;
      if (resp.body && typeof resp.body !== 'string')
        resp.body = JSON.stringify(resp.body);
      if (settings.debug)
        console.log('Response: ' + JSON.stringify(resp, null, 2));
      callback(null, resp);
    })
    .catch(err => {
      console.log(`Error preparing response: ${err.stack || err}`);
      callback(null, { statusCode: 500, body: String(err) });
    });
};

const extract_asana_task_links = text =>
  Array.from(
    new Set(text.match(/https:\/\/app.asana.com\/0\/[0-9]+\/[0-9]+/g)),
  );

const extract_asana_task_link_id = asana_link => parseInt(get(/https:\/\/app.asana.com\/0\/[0-9]+\/([0-9]+)/.exec(asana_link), [1], '0'));

const add_backlinks_for_asana_tasks = async (text, old_text, target_url) => {
  let asana_links_found = extract_asana_task_links(text || '');
  let links_already_there = extract_asana_task_links(old_text || '');
  return Promise.all(
    asana_links_found.map(async asana_link => {
      if (links_already_there.includes(asana_link)) return;
      const task_id = extract_asana_task_link_id(asana_link);
      if (task_id) {
        try {
          const task = await asana.tasks.findById(task_id);
          await asana.tasks.addComment(task_id, {
            task: task_id,
            text: target_url,
          });
        } catch (err) {
          console.warn(err);
        }
      }
    }),
  );
};

// Actual body of the lambda handler
module.exports.github_webhook = handler(async (data, event, context) => {
  if (!data) return badRequest('No request body');

  const entity = data.comment || data.issue || data.pull_request;

  if (
    entity &&
    entity.body &&
    entity.html_url &&
    (['created', 'opened'].includes(data.action) ||
      (data.action === 'edited' && data.changes.body.from))
  ) {
    await add_backlinks_for_asana_tasks(
      entity.body,
      data.action === 'edited' ? data.changes.body.from : '',
      entity.html_url,
    );
  }
});
