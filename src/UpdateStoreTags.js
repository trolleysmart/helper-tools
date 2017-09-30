// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { List, Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import Parse from 'parse/node';
import { ImmutableEx } from 'micro-business-common-javascript';
import { StoreService, StoreTagService, TagService } from 'trolley-smart-parse-server-common';

const storeService = new StoreService();
const storeTagService = new StoreTagService();
const tagService = new TagService();

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

Parse.initialize(
  options.applicationId ? options.applicationId : 'app_id',
  options.javaScriptKey ? options.javaScriptKey : 'javascript_key',
  options.masterKey ? options.masterKey : 'master_key',
);
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const getStore = async (key) => {
  const criteria = Map({
    conditions: Map({
      key,
    }),
  });

  const stores = await storeService.search(criteria);

  if (stores.count() > 1) {
    throw new Error(`Multiple store found with store key: ${this.storeKey}.`);
  }

  return stores.isEmpty() ? storeService.read(await storeService.create(Map({ key }))) : stores.first();
};

const loadStoreTags = async (storeId) => {
  let storeTags = List();
  const result = await storeTagService.searchAll(Map({ conditions: Map({ storeId }) }));

  try {
    result.event.subscribe((info) => {
      storeTags = storeTags.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return storeTags;
};

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
  const storeTags = await loadStoreTags((await getStore(options.storeKey)).get('id'));
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

            await storeTagService.update(storeTag.set('tagId', tag.get('id')));
          }),
        ),
      );
    },
  );

  fs.createReadStream(options.csvFilePath).pipe(parser);
};

start();
