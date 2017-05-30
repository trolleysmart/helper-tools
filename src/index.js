// @flow

import Immutable, { Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csv from 'fast-csv';
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
  const result = await TagService.search(Map({ limit: 1000 }));

  return result;
};

const start = async () => {
  const allTags = await loadAllTags();

  fs
    .createReadStream(options.csvFilePath)
    .pipe(csv.parse({ headers: false, delimiter: options.delimiter ? options.delimiter : ',', trim: true }))
    .pipe(csv.format({ headers: false, rowDelimiter: options.rowDelimiter ? options.rowDelimiter : '\n' }))
    .transform(async (rarRow, next) => {
      const row = Immutable.fromJS(rarRow);
      const description = row.first();
      const tags = row.skip(1).toSet();

      if (tags.filterNot(_ => allTags.find(tag => tag.get('name').localeCompare(_) === 0)).isEmpty()) {
        await StapleTemplateShoppingListService.create(
          Map({
            description,
            tagIds: tags.map(_ => allTags.find(tag => tag.get('name').localeCompare(_) === 0).get('id')),
          }),
        );
        next();
      } else {
        console.log(`Provided tags not found: ${row.skip(1).toJS()}`);
        next(`Provided tags not found: ${row.skip(1).toJS()}`);
      }
    });
};

start();
