// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import { ImmutableEx } from 'micro-business-common-javascript';
import { TagService } from 'trolley-smart-parse-server-common';
import { initializeParse, loadTags } from './Common';

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

const start = async () => {
  try {
    initializeParse(options);

    const tags = await loadTags();
    const tagService = new TagService();

    const parser = csvParser(
      { delimiter: options.delimiter ? options.delimiter : ',', trim: true, rowDelimiter: options.rowDelimiter ? options.rowDelimiter : '\n' },
      async (err, data) => {
        if (err) {
          console.log(err);

          return;
        }

        const splittedRows = ImmutableEx.splitIntoChunks(Immutable.fromJS(data).skip(1), 100); // Skipping the first item as it is the CSV header

        await BluebirdPromise.each(splittedRows.toArray(), rowChunck =>
          Promise.all(rowChunck.map(async (rawRow) => {
            const row = Immutable.fromJS(rawRow);
            const key = row.first();
            const name = row.skip(1).first();
            const tag = tags.find(_ => _.get('key').localeCompare(key) === 0);

            if (tag) {
              await tagService.update(tag.merge(Map({ level: 1, forDisplay: true, name })), global.parseServerSessionToken);
            } else {
              await tagService.create(
                Map({
                  key,
                  level: 1,
                  forDisplay: true,
                  name,
                }),
                null,
                global.parseServerSessionToken,
              );
            }
          })));
      },
    );

    fs.createReadStream(options.csvFilePath).pipe(parser);
  } catch (ex) {
    console.error(ex);
  }
};

start();
