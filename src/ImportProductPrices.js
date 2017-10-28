// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import { ImmutableEx } from 'micro-business-common-javascript';
import { TagService } from 'trolley-smart-parse-server-common';
import { getStore, initializeParse, loadTags } from './Common';

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

initializeParse(options);

const start = async () => {
  if (!options.storeKey) {
    console.error('Error: store key must be provided.');

    return;
  }

  const tags = await loadTags();
  const store = await getStore(options.storeKey);

  const parser = csvParser(
    { delimiter: options.delimiter ? options.delimiter : ',', trim: true, rowDelimiter: options.rowDelimiter ? options.rowDelimiter : '\r\n' },
    async (err, data) => {
      if (err) {
        console.error(err);

        return;
      }

      const splittedRows = ImmutableEx.splitIntoChunks(Immutable.fromJS(data).skip(1), 100); // Skipping the first item as it is the CSV header

      await BluebirdPromise.each(splittedRows.toArray(), rowChunck =>
        Promise.all(rowChunck.map(async (rawRow) => {
          const row = Immutable.fromJS(rawRow);
          const name = row.first();
          const description = row.skip(1).first();
          const size = row.skip(2).first();
          const specialType = row.skip(3).first();
          const tags = row.skip(4).first();
          const offerStartDate = row.skip(5).first();
          const offerEndDate = row.skip(6).first();
          const currentPrice = row.skip(7).first();
          const wasPrice = row.skip(8).first();
          const saving = row.skip(9).first();
          const savingPercentage = row.skip(10).first();
          const unitPrice = row.skip(11).first();
          const multiBuy = row.skip(12).first();
          const barcode = row.skip(13).first();
          const imageUrl = row.skip(14).first();
        })));
    },
  );

  fs.createReadStream(options.csvFilePath).pipe(parser);
};

start();
