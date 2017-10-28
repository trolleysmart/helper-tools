// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import { ImmutableEx } from 'micro-business-common-javascript';
import moment from 'moment';
import { ProductPriceService, StoreProductService } from 'trolley-smart-parse-server-common';
import { getStore, initializeParse, loadTags, loadStoreProduct, loadLatestProductPrice } from './Common';

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

  const allTags = await loadTags();
  const storeId = (await getStore(options.storeKey)).get('id');
  const storeProductService = await new StoreProductService();
  const productPriceService = await new ProductPriceService();

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
          const tags = Immutable.fromJS(row
            .skip(4)
            .first()
            .split(','));
          const offerEndDateStr = row.skip(6).first();
          const currentPriceStr = row.skip(7).first();
          const wasPriceStr = row.skip(8).first();
          const savingStr = row.skip(9).first();
          const savingPercentageStr = row.skip(10).first();
          const unitPrice = Immutable.fromJS(row
            .skip(11)
            .first()
            .split(','));
          const multiBuy = Immutable.fromJS(row
            .skip(12)
            .first()
            .split(','));
          const barcode = row.skip(13).first();
          const imageUrl = row.skip(14).first();

          const storeProduct = await loadStoreProduct(storeId, false, name);
          const tagIds = allTags.filter(tag => tags.find(_ => tag.get('key').localeCompare(_) === 0)).map(tag => tag.get('id'));
          let storeProductId;

          if (storeProduct.isNone()) {
            storeProductId = await storeProductService.create(
              Map({
                name,
                description,
                barcode,
                size,
                storeId,
                createdByCrawler: false,
                imageUrl,
                tagIds,
              }),
              null,
              global.parseServerSessionToken,
            );
          } else {
            await storeProductService.update(
              storeProduct.some().merge(Map({
                description,
                barcode,
                size,
                storeId,
                createdByCrawler: false,
                imageUrl,
                tagIds,
              })),
              global.parseServerSessionToken,
            );

            storeProductId = storeProduct.some().get('id');

            const result = await loadLatestProductPrice(storeId, storeProductId, false);
            const currentPrice = currentPriceStr ? parseFloat(currentPriceStr) : 0;
            const wasPrice = wasPriceStr ? parseFloat(wasPriceStr) : undefined;
            const savingPercentage = savingPercentageStr ? parseFloat(savingPercentageStr) : 0;
            const saving = savingStr ? parseFloat(savingStr) : 0;
            const offerEndDate = offerEndDateStr ? moment(offerEndDateStr, 'DD/MM/YYYY').toDate() : undefined;
            const special = specialType ? specialType.localeCompare('node') === 0 : false;
            const priceDetails = ImmutableEx.removeNullAndUndefinedProps(Map({
              specialType,
              saving,
              savingPercentage,
              currentPrice,
              wasPrice,
              offerEndDate,
              multiBuy:
                    multiBuy.count() === 2
                      ? Map({
                        awardQuantity: multiBuy.first(),
                        awardValue: parseFloat(multiBuy.last()),
                      })
                      : undefined,
              unitPrice:
                    unitPrice.count() === 2
                      ? Map({
                        size: unitPrice.first(),
                        price: parseFloat(unitPrice.last()),
                      })
                      : undefined,
            }));

            if (result.get('productPrice').isNone()) {
              console.log(JSON.stringify(priceDetails.toJS(), null, 2));
              await productPriceService.create(
                Map({
                  name,
                  description,
                  barcode,
                  size,
                  storeId,
                  imageUrl,
                  tagIds,
                  special,
                  saving,
                  savingPercentage,
                  offerEndDate,
                  storeProductId,
                  status: 'A',
                  priceDetails,
                  createdByCrawler: false,
                }),
                null,
                global.parseServerSessionToken,
              );
            } else {
              const productPrice = result.get('productPrice').some();
              const currentPriceDetails = productPrice.get('priceDetails');

              if (priceDetails.equals(currentPriceDetails)) {
                return;
              }

              await productPriceService.update(
                productPrice.merge(Map({
                  name,
                  description,
                  barcode,
                  size,
                  storeId,
                  imageUrl,
                  tagIds,
                  special,
                  saving,
                  savingPercentage,
                  offerEndDate,
                  storeProductId,
                  status: 'A',
                  priceDetails,
                  createdByCrawler: false,
                })),
                global.parseServerSessionToken,
              );
            }
          }
        })));
    },
  );

  fs.createReadStream(options.csvFilePath).pipe(parser);
};

start();
