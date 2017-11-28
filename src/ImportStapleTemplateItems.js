// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import { ImmutableEx } from 'micro-business-common-javascript';
import { StapleTemplateItemService } from 'trolley-smart-parse-server-common';
import { initializeParse, loadTags, loadStapleTemplateItems } from './Common';

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

initializeParse(options);

const start = async () => {
  try {
    const allTags = await loadTags();
    const stapleTemplateItems = await loadStapleTemplateItems();
    const stapleTemplateItemService = new StapleTemplateItemService();

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
            const name = row.first();
            const popular = row.skip(1).first();
            const tags = Immutable.fromJS(row
              .skip(2)
              .first()
              .split('|')).toSet();

            if (tags.filterNot(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0)).isEmpty()) {
              const foundItem = stapleTemplateItems.find(_ => _.get('name').localeCompare(name) === 0);

              if (foundItem) {
                await stapleTemplateItemService.update(
                  foundItem
                    .set('tagIds', tags.map(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0).get('id')))
                    .set('popular', !!(popular && popular.trim())),
                  global.parseServerSessionToken,
                );
              } else {
                await stapleTemplateItemService.create(
                  Map({
                    name,
                    tagIds: tags.map(_ => allTags.find(tag => tag.get('key').localeCompare(_) === 0).get('id')),
                    popular: !!(popular && popular.trim()),
                  }),
                  null,
                  global.parseServerSessionToken,
                );
              }
            } else {
              console.log(`Provided tags not found: ${tags.toJS()}`);
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
