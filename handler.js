"use strict";

const difference = require("lodash/difference");
const uniq = require("lodash/uniq");
const settings = {
  debug: false,
  devProject: process.env.ASANA_PROJECT,
  prSection: process.env.ASANA_PR_OPEN_SECTION,
  mergedSection: process.env.ASANA_MERGED_SECTION
};
const asana = require("asana")
  .Client.create({
    defaultHeaders: {
      "asana-enable": "string_ids,new_rich_text,new_sections"
    }
  })
  .useAccessToken(process.env.ASANA_ACCESS_TOKEN);
const marked = require("marked");
const he = require("he");
const renderer = new marked.Renderer();

renderer.paragraph = text => `\n${text}\n`;
renderer.br = () => "\n";
renderer.checkbox = checked => (checked ? "\u2611" : "\u2610");
renderer.code = code => `<code>${code}</code>`;

marked.setOptions({
  renderer: renderer,
  baseUrl: "https://github.com",
  pedantic: false,
  gfm: true,
  breaks: true,
  smartLists: true,
  smartypants: false,
  xhtml: true
});

// Helpers for returning a response
const badRequest = err => ({ statusCode: 400, body: String(err) });

// Convert async function into lambda handler
const handler = fn => (event, context, callback) => {
  const data = event.body[0] === "{" ? JSON.parse(event.body) : event.body;
  if (settings.debug)
    console.log("Request body:\n" + JSON.stringify(data, null, 2));
  Promise.resolve(null)
    .then(() => fn(data, event, context))
    .then(resp => {
      if (!resp) resp = { statusCode: resp === false ? 400 : 200, body: "" };
      else if (typeof resp === "string") resp = { statusCode: 200, body: resp };
      else if (typeof resp === "number") resp = { statusCode: resp };
      else if (!resp.statusCode) resp.statusCode = 200;
      if (resp.body && typeof resp.body !== "string")
        resp.body = JSON.stringify(resp.body);
      if (settings.debug)
        console.log("Response: " + JSON.stringify(resp, null, 2));
      callback(null, resp);
    })
    .catch(err => {
      console.log(`Error preparing response: ${err.stack || err}`);
      callback(null, { statusCode: 500, body: String(err) });
    });
};

const extract_asana_task_links = text => {
  const links = [];
  const re = /([*-] ([a-z]+) )?(\[.*]\()?(https:\/\/app.asana.com\/0\/([0-9]+)\/([0-9]+))/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    links.push({
      action: m[2] && m[2].toLowerCase(),
      url: m[4],
      project_gid: m[5],
      task_gid: m[6]
    });
  }
  return links;
};

const add_backlinks_for_asana_tasks = async (
  text,
  old_text,
  title,
  target_url,
  action
) => {
  const links = extract_asana_task_links(text || "");
  const old_links = extract_asana_task_links(old_text || "");
  const task_gids = uniq(links.map(link => link.task_gid));
  const old_task_gids = uniq(old_links.map(link => link.task_gid));
  const new_task_gids = difference(task_gids, old_task_gids);
  const controlled_task_gids = uniq(
    links
      .filter(link => link.action === "fixes" || link.action === "resolves")
      .map(link => link.task_gid)
  );
  return Promise.all(
    new_task_gids.map(async task_gid => {
      if (task_gid) {
        try {
          let html_text = [
            "<body>",
            he.decode(
              marked(
                [
                  title,
                  target_url,
                  action,
                  "\n\n",
                  ["opened", "created", "edited"].includes(action) ? text : ""
                ]
                  .filter(Boolean)
                  .join(" ")
              )
            ),
            "</body>"
          ].join("");
          let is_controlled = controlled_task_gids.includes(task_gid);
          console.log({
            task_gid: task_gid,
            action: action,
            is_controlled: is_controlled,
            html_text: html_text,
            target_url: target_url
          });
          await asana.tasks.addComment(task_gid, {
            task_gid: task_gid,
            html_text: html_text
          });

          console.log({
            is_controlled: is_controlled,
            devProject: settings.devProject,
            is_pr: /\/pull\/[0-9]+/.test(target_url),
            action: action
          });
          if (
            is_controlled &&
            settings.devProject &&
            /\/pull\/[0-9]+/.test(target_url) &&
            action !== "closed"
          ) {
            const section =
              action === "merged" ? settings.mergedSection : settings.prSection;
            console.log({
              task_gid: task_gid,
              action: action,
              project: settings.devProject,
              section: section
            });
            await asana.tasks.addProject(task_gid, {
              task_gid: task_gid,
              project: settings.devProject,
              section: section
            });
          }
        } catch (err) {
          console.warn(err);
          const errors = (err.value && err.value.errors) || err.errors || [];
          errors.forEach(e => console.warn(e));
        }
      }
    })
  );
};

// Actual body of the lambda handler
module.exports.github_webhook = handler(async (data, event, context) => {
  if (!data) return badRequest("No request body");

  const entity = data.comment || data.issue || data.pull_request;

  if (
    entity &&
    entity.body &&
    entity.html_url &&
    ([
      "created",
      "opened",
      "closed",
      "reopened",
      "labeled",
      "unlabeled"
    ].includes(data.action) ||
      (data.action === "edited" && data.changes.body.from))
  ) {
    const title = [
      entity.title || (data.comment && "comment") || (data.issue && "issue"),
      ...((data.pull_request &&
        data.pull_request.labels &&
        data.pull_request.labels.map(label => "(" + label.name + ")")) ||
        [])
    ].join(" ");
    const oldText = data.action === "edited" ? data.changes.body.from : "";
    const action =
      data.action === "closed" && entity.merged ? "merged" : data.action || "";
    await add_backlinks_for_asana_tasks(
      entity.body,
      oldText,
      title,
      entity.html_url,
      action
    );
  }
});
