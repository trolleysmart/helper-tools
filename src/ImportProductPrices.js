// @flow

import BluebirdPromise from 'bluebird';
import Immutable, { Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvParser from 'csv-parse';
import { ImmutableEx } from 'micro-business-common-javascript';
import moment from 'moment';
import { ProductPriceService, StoreProductService } from 'trolley-smart-parse-server-common';
import { getStore, initializeParse, loadTags, loadStoreProduct, loadStoreProducts, loadActiveProductPrices } from './Common';

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
    if (!options.storeKey) {
      console.error('Error: store key must be provided.');

      return;
    }

    await initializeParse(options);

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

        const storeProductsAndPrices = Immutable.fromJS(data)
          .skip(1) // Skipping the first item as it is the CSV header
          .map((rawRow) => {
            const row = Immutable.fromJS(rawRow);

            return Map({
              name: row.first(),
              description: row.skip(1).first(),
              size: row.skip(2).first(),
              specialType: row.skip(3).first(),
              tags: Immutable.fromJS(row
                .skip(4)
                .first()
                .split(',')),
              offerEndDate: row.skip(6).first(),
              currentPrice: row.skip(7).first(),
              wasPrice: row.skip(8).first(),
              saving: row.skip(9).first(),
              savingPercentage: row.skip(10).first(),
              unitPrice: Immutable.fromJS(row
                .skip(11)
                .first()
                .split(',')),
              multiBuy: Immutable.fromJS(row
                .skip(12)
                .first()
                .split(',')),
              barcode: row.skip(13).first(),
              imageUrl: row.skip(14).first(),
            });
          });

        const splittedStoreProductsAndPrices = ImmutableEx.splitIntoChunks(storeProductsAndPrices, 100);

        // Updating store products details
        await BluebirdPromise.each(splittedStoreProductsAndPrices.toArray(), storeProductsAndPricesChunck =>
          Promise.all(storeProductsAndPricesChunck.map(async (storeProductAndPrice) => {
            const storeProduct = await loadStoreProduct(storeId, false, storeProductAndPrice.get('name'));
            const tagIds = allTags
              .filter(tag => storeProductAndPrice.get('tags').find(_ => tag.get('key').localeCompare(_) === 0))
              .map(tag => tag.get('id'))
              .toSet()
              .toList();
            const storeProductDetails = Map({
              name: storeProductAndPrice.get('name'),
              description: storeProductAndPrice.get('description'),
              barcode: storeProductAndPrice.get('barcode'),
              size: storeProductAndPrice.get('size'),
              storeId,
              createdByCrawler: false,
              authorizedToDisplay: true,
              imageUrl: storeProductAndPrice.get('imageUrl'),
              tagIds,
            });

            if (storeProduct.isNone()) {
              await storeProductService.create(storeProductDetails, null, global.parseServerSessionToken);
            } else {
              await storeProductService.update(storeProduct.some().merge(storeProductDetails), global.parseServerSessionToken);
            }
          })));

        const storeProducts = await loadStoreProducts(storeId, false);
        const splittedStoreProducts = ImmutableEx.splitIntoChunks(storeProducts, 100);

        // Updating products price details
        await BluebirdPromise.each(splittedStoreProducts.toArray(), storeProductsChunck =>
          Promise.all(storeProductsChunck.map(async (storeProduct) => {
            const productPrices = await loadActiveProductPrices(storeId, storeProduct.get('id'), false);
            const storeProductAndPrice = storeProductsAndPrices.find(_ => _.get('name').localeCompare(storeProduct.get('name')) === 0);

            if (!storeProductAndPrice) {
              if (!productPrices.isEmpty()) {
                await Promise.all(productPrices
                  .map(_ =>
                    productPriceService.update(
                      _.merge(Map({ status: 'I', createdByCrawler: false, authorizedToDisplay: true })),
                      global.parseServerSessionToken,
                    ))
                  .toArray());
              }

              return;
            }

            let currentPrice = storeProductAndPrice.get('currentPrice') ? parseFloat(storeProductAndPrice.get('currentPrice')) : 0;
            let wasPrice = storeProductAndPrice.get('wasPrice') ? parseFloat(storeProductAndPrice.get('wasPrice')) : undefined;
            let savingPercentage = storeProductAndPrice.get('savingPercentage') ? parseFloat(storeProductAndPrice.get('savingPercentage')) : 0;
            let saving = storeProductAndPrice.get('saving') ? parseFloat(storeProductAndPrice.get('saving')) : 0;
            const offerEndDate = storeProductAndPrice.get('offerEndDate')
              ? moment(storeProductAndPrice.get('offerEndDate'), 'DD/MM/YYYY').toDate()
              : undefined;
            const multiBuy = storeProductAndPrice.get('multiBuy');
            const unitPrice = storeProductAndPrice.get('unitPrice');

            if (!currentPrice && multiBuy.count() === 2) {
              currentPrice = parseFloat(multiBuy.last()) / parseInt(multiBuy.first(), 10);
            }

            if (wasPrice) {
              saving = wasPrice - currentPrice;

              const temp = saving * 100;

              savingPercentage = temp / wasPrice;
            } else if (saving) {
              wasPrice = currentPrice + saving;

              const temp = saving * 100;

              savingPercentage = temp / wasPrice;
            }

            const priceToDisplay = multiBuy.count() === 2 ? parseFloat(multiBuy.last()) : currentPrice;
            const priceDetails = ImmutableEx.removeNullAndUndefinedProps(Map({
              specialType: storeProductAndPrice.get('specialType'),
              saving,
              savingPercentage,
              currentPrice,
              wasPrice,
              offerEndDate,
              multiBuy:
                    multiBuy.count() === 2
                      ? Map({
                        awardQuantity: multiBuy.first(),
                        awardValue: parseInt(multiBuy.last(), 10),
                      })
                      : undefined,
              unitPrice:
                    unitPrice.count() === 2
                      ? Map({
                        size: unitPrice.last(),
                        price: parseFloat(unitPrice.first()),
                      })
                      : undefined,
            }));
            const productPrice = Map({
              name: storeProductAndPrice.get('name'),
              description: storeProductAndPrice.get('description'),
              barcode: storeProductAndPrice.get('barcode'),
              size: storeProductAndPrice.get('size'),
              storeId,
              storeProductId: storeProduct.get('id'),
              createdByCrawler: false,
              authorizedToDisplay: true,
              imageUrl: storeProductAndPrice.get('imageUrl'),
              tagIds: storeProduct.get('tagIds'),
              status: 'A',
              special: storeProductAndPrice.get('specialType') ? storeProductAndPrice.get('specialType').localeCompare('none') !== 0 : false,
              priceToDisplay,
              priceDetails,
              saving,
              savingPercentage,
              offerEndDate,
            });

            if (productPrices.isEmpty()) {
              await productPriceService.create(productPrice, null, global.parseServerSessionToken);
            } else {
              const notMatchedProductPrices = productPrices.filterNot(_ =>
                ImmutableEx.removeUndefinedProps(_.get('priceDetails')).equals(ImmutableEx.removeUndefinedProps(priceDetails)));

              if (!notMatchedProductPrices.isEmpty()) {
                await Promise.all(notMatchedProductPrices
                  .map(_ =>
                    productPriceService.update(
                      _.merge(Map({ status: 'I', createdByCrawler: false, authorizedToDisplay: true })),
                      global.parseServerSessionToken,
                    ))
                  .toArray());
              }

              const matchedProductPrices = productPrices.filter(_ =>
                ImmutableEx.removeUndefinedProps(_.get('priceDetails')).equals(ImmutableEx.removeUndefinedProps(priceDetails)));

              if (matchedProductPrices.count() > 1) {
                await Promise.all(matchedProductPrices
                  .skip(1)
                  .map(_ =>
                    productPriceService.update(
                      _.merge(Map({ status: 'I', createdByCrawler: false, authorizedToDisplay: true })),
                      global.parseServerSessionToken,
                    ))
                  .toArray());
              } else if (matchedProductPrices.count() === 0) {
                await productPriceService.create(
                  productPrice.set('createdByCrawler', false).set('authorizedToDisplay', true),
                  null,
                  global.parseServerSessionToken,
                );
              }
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
