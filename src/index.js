// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { List, Map, Range } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import Parse from 'parse/node';
import { StapleTemplateShoppingListService, TagService } from 'smart-grocery-parse-server-common';

const optionDefinitions = [
  { name: 'csvFilePath', type: String },
  { name: 'delimiter', type: String },
  { name: 'rowDelimiter', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(options.applicationId ? options.applicationId : 'app_id', options.javaScriptKey ? options.javaScriptKey : 'javascript_key');
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const loadAllTags = async () => {
  let tags = List();
  const result = await TagService.searchAll(Map({}));

  try {
    result.event.subscribe(info => (tags = tags.push(info)));

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return tags;
};

const loadAllStapleTemplateShoppingList = async () => {
  let stapleTemplateShoppingListItems = List();
  const result = await StapleTemplateShoppingListService.searchAll(Map({}));

  try {
    result.event.subscribe(info => (stapleTemplateShoppingListItems = stapleTemplateShoppingListItems.push(info)));

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return stapleTemplateShoppingListItems;
};

const splitIntoChunks = (list, chunkSize) => Range(0, list.count(), chunkSize).map(chunkStart => list.slice(chunkStart, chunkStart + chunkSize));

const start = async () => {
  const allTags = await loadAllTags();
  const allStapleTemplateShoppingListItems = await loadAllStapleTemplateShoppingList();

  const parser = csvParser(
    { delimiter: options.delimiter ? options.delimiter : ',', trim: true, rowDelimiter: options.rowDelimiter ? options.rowDelimiter : '\n' },
    async (err, data) => {
      if (err) {
        console.log(err);

        return;
      }

      const splittedRows = splitIntoChunks(Immutable.fromJS(data), 100);

      await BluebirdPromise.each(splittedRows.toArray(), rowChunck =>
        Promise.all(
          rowChunck.map(async (rawRow) => {
            const row = Immutable.fromJS(rawRow);
            const description = row.first();
            const tags = row.skip(1).toSet();

            if (tags.filterNot(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0)).isEmpty()) {
              const foundItem = allStapleTemplateShoppingListItems.find(_ => _.get('description').localeCompare(description) === 0);

              if (foundItem) {
                await StapleTemplateShoppingListService.update(
                  foundItem.set('tagIds', tags.map(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0).get('id'))),
                );
              } else {
                await StapleTemplateShoppingListService.create(
                  Map({
                    description,
                    tagIds: tags.map(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0).get('id')),
                  }),
                );
              }
            } else {
              console.log(`Provided tags not found: ${row.skip(1).toJS()}`);
            }
          }),
        ),
      );
    },
  );

  fs.createReadStream(options.csvFilePath).pipe(parser);
};

start();
