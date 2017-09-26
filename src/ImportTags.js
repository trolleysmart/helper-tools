// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { List, Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import Parse from 'parse/node';
import { ImmutableEx } from 'micro-business-common-javascript';
import { TagService } from 'trolley-smart-parse-server-common';

const tagService = new TagService();

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

const start = async () => {
  const tags = await loadTags();

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
            const key = row.first();

            if (!tags.find(_ => _.get('key').localeCompare(key) === 0)) {
              await tagService.create(Map({ key, level: 1, forDisplay: true, name: key }));
            }
          }),
        ),
      );
    },
  );

  fs.createReadStream(options.csvFilePath).pipe(parser);
};

start();
