// @flow

import BluebirdPromise from 'bluebird';
import Immutable from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import { ImmutableEx } from '@microbusiness/common-javascript';
import { StoreTagService } from '@trolleysmart/parse-server-common';
import { initializeParse, getStore, loadStoreTags, loadTags } from './Common';

const optionDefinitions = [
  { name: 'storeKey', type: String },
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

    const storeTags = await loadStoreTags((await getStore(options.storeKey)).get('id'));
    const tags = await loadTags();
    const storeTagService = new StoreTagService();

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
            const storeTagKey = row.first();
            const tagKey = row.skip(6).first();

            if (!tagKey) {
              console.log(`Warning: No tag set for storeTag: ${storeTagKey}`);

              return;
            }

            const storeTag = storeTags.find(_ => _.get('key').localeCompare(storeTagKey) === 0);

            if (!storeTag) {
              console.log(`Warning: No store tag found in DB for storeTag: ${storeTagKey}`);

              return;
            }

            const tag = tags.find(_ => _.get('key').localeCompare(tagKey) === 0);

            if (!tag) {
              console.log(`Warning: No tag found in DB for tag: ${tagKey}`);

              return;
            }

            await storeTagService.update(storeTag.set('tagId', tag.get('id')), global.parseServerSessionToken);
          })));
      },
    );

    fs.createReadStream(options.csvFilePath).pipe(parser);
  } catch (ex) {
    console.error(ex);
  }
};

start();
