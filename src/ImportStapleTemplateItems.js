// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { List, Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import Parse from 'parse/node';
import { ImmutableEx } from 'micro-business-common-javascript';
import { StapleTemplateItemService, TagService } from 'trolley-smart-parse-server-common';

const tagService = new TagService();
const stapleTemplateItemService = new StapleTemplateItemService();

const optionDefinitions = [
  { name: 'csvFilePath', type: String },
  { name: 'delimiter', type: String },
  { name: 'rowDelimiter', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'masterKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(
  options.applicationId ? options.applicationId : 'app_id',
  options.javaScriptKey ? options.javaScriptKey : 'javascript_key',
  options.masterKey ? options.masterKey : 'master_key',
);
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const loadTags = async () => {
  let tags = List();
  const result = await tagService.searchAll(Map({}));

  try {
    result.event.subscribe((info) => {
      tags = tags.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return tags;
};

const loadStapleTemplateItems = async () => {
  let stapleTemplateItems = List();
  const result = await stapleTemplateItemService.searchAll(Map({}));

  try {
    result.event.subscribe((info) => {
      stapleTemplateItems = stapleTemplateItems.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return stapleTemplateItems;
};

const start = async () => {
  const allTags = await loadTags();
  const stapleTemplateItems = await loadStapleTemplateItems();

  const parser = csvParser(
    { delimiter: options.delimiter ? options.delimiter : ',', trim: true, rowDelimiter: options.rowDelimiter ? options.rowDelimiter : '\n' },
    async (err, data) => {
      if (err) {
        console.log(err);

        return;
      }

      const splittedRows = ImmutableEx.splitIntoChunks(Immutable.fromJS(data).skip(1), 100); // Skipping the first item as it is the CSV header

      await BluebirdPromise.each(splittedRows.toArray(), rowChunck =>
        Promise.all(
          rowChunck.map(async (rawRow) => {
            const row = Immutable.fromJS(rawRow);
            const name = row.first();
            const popular = row.skip(1).first();
            const tags = Immutable.fromJS(
              row
                .skip(2)
                .first()
                .split('|'),
            ).toSet();

            if (tags.filterNot(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0)).isEmpty()) {
              const foundItem = stapleTemplateItems.find(_ => _.get('name').localeCompare(name) === 0);

              if (foundItem) {
                await stapleTemplateItemService.update(
                  foundItem
                    .set('tagIds', tags.map(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0).get('id')))
                    .set('popular', !!(popular && popular.trim())),
                );
              } else {
                await stapleTemplateItemService.create(
                  Map({
                    name,
                    tagIds: tags.map(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0).get('id')),
                    popular: !!(popular && popular.trim()),
                  }),
                );
              }
            } else {
              console.log(`Provided tags not found: ${tags.toJS()}`);
            }
          }),
        ),
      );
    },
  );

  fs.createReadStream(options.csvFilePath).pipe(parser);
};

start();
