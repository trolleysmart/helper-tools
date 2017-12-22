// @flow

import BluebirdPromise from 'bluebird';
import commandLineArgs from 'command-line-args';
import csvWriter from 'csv-write-stream';
import fs from 'fs';
import { ImmutableEx } from '@microbusiness/common-javascript';
import { initializeParse, getStore, loadStoreProducts, loadLatestProductPrice, loadStoreTags } from './Common';

const optionDefinitions = [
  { name: 'exportCrawledData', type: Boolean },
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
    await initializeParse(options);

    if (!options.storeKey) {
      console.log('Error: storeKey must be provided.');

      return;
    }

    if (!options.csvFilePath) {
      console.log('Error: csvFilePath must be provided.');

      return;
    }

    const storeId = (await getStore(options.storeKey)).get('id');
    const exportCrawledData = options.exportCrawledData || false;
    const storeProducts = await loadStoreProducts(storeId, exportCrawledData);
    const storeTags = await loadStoreTags(storeId, { includeTag: true });
    const separator = options.delimiter ? options.delimiter : '|';
    const newLineDelimiter = options.rowDelimiter ? options.rowDelimiter : '\n';
    const writer = csvWriter({
      separator,
      newLine: newLineDelimiter,
      headers: [
        'id',
        'name',
        'description',
        'barcode',
        'size',
        'productPageUrl',
        'imageUrl',
        'storeTags',
        'tags',
        'priceToDisplay',
        'status',
        'offerEndDate',
        'saving',
        'savingPercentage',
        'specialType',
        'currentPrice',
        'wasPrice',
        'unitPrice',
        'multiBuy',
      ],
    });

    writer.pipe(fs.createWriteStream(options.csvFilePath));

    const splittedStoreProducts = ImmutableEx.splitIntoChunks(storeProducts, 100);

    await BluebirdPromise.each(splittedStoreProducts.toArray(), async (storeProductsChunck) => {
      const productPricesPromises = storeProductsChunck.map(storeProduct =>
        loadLatestProductPrice(storeId, storeProduct.get('id'), exportCrawledData));
      const productPrices = await Promise.all(productPricesPromises.toArray());

      storeProductsChunck.forEach((storeProduct) => {
        const id = (storeProduct.get('id') || '').replace(separator, ' - ');
        const name = (storeProduct.get('name') || '').replace(separator, ' - ');
        const description = (storeProduct.get('description') || '').replace(separator, ' - ');
        const barcode = (storeProduct.get('barcode') || '').replace(separator, ' - ');
        const size = (storeProduct.get('size') || '').replace(separator, ' - ');
        const productPageUrl = (storeProduct.get('productPageUrl') || '').replace(separator, ' - ');
        const imageUrl = (storeProduct.get('imageUrl') || '').replace(separator, ' - ');
        const productPrice = productPrices.find(_ => _.get('storeProductId').localeCompare(storeProduct.get('id')) === 0).get('productPrice');
        const priceToDisplay = productPrice.isNone() ? '' : productPrice.some().get('priceToDisplay') || '';
        const status = productPrice.isNone() ? '' : productPrice.some().get('status') || '';
        const offerEndDate = productPrice.isNone() ? '' : productPrice.some().get('offerEndDate') || '';
        const saving = productPrice.isNone() ? '' : productPrice.some().get('saving') || '';
        const savingPercentage = productPrice.isNone() ? '' : productPrice.some().get('savingPercentage') || '';
        const specialType = productPrice.isNone() ? '' : productPrice.some().getIn(['priceDetails', 'specialType']) || '';
        const currentPrice = productPrice.isNone() ? '' : productPrice.some().getIn(['priceDetails', 'currentPrice']) || '';
        const wasPrice = productPrice.isNone() ? '' : productPrice.some().getIn(['priceDetails', 'wasPrice']) || '';
        const unitPrice = productPrice.isNone()
          ? ''
          : `${productPrice.some().getIn(['priceDetails', 'unitPrice', 'price']) || ''}, ${productPrice
            .some()
            .getIn(['priceDetails', 'unitPrice', 'size']) || ''}`;
        const multiBuy = productPrice.isNone()
          ? ''
          : `${productPrice.some().getIn(['priceDetails', 'multiBuyInfo', 'awardQuantity']) || ''}, ${productPrice
            .some()
            .getIn(['priceDetails', 'multiBuyInfo', 'awardValue']) || ''}`;

        writer.write({
          id: id.replace('\r\n', ' ').replace('\n', ' '),
          name: name.replace('\r\n', ' ').replace('\n', ' '),
          description: description.replace('\r\n', ' ').replace('\n', ' '),
          barcode: barcode.replace('\r\n', ' ').replace('\n', ' '),
          size: size.replace('\r\n', ' ').replace('\n', ' '),
          productPageUrl: productPageUrl.replace('\r\n', ' ').replace('\n', ' '),
          imageUrl: imageUrl.replace('\r\n', ' ').replace('\n', ' '),
          storeTags: storeProduct
            .get('storeTagIds')
            .map(storeTagId => storeTags.find(_ => _.get('id').localeCompare(storeTagId) === 0).get('key'))
            .join(),
          tags: storeProduct
            .get('storeTagIds')
            .map(storeTagId => storeTags.find(_ => _.get('id').localeCompare(storeTagId) === 0).getIn(['tag', 'key']))
            .join(),
          priceToDisplay,
          status,
          offerEndDate,
          saving,
          savingPercentage,
          specialType,
          currentPrice,
          wasPrice,
          unitPrice,
          multiBuy,
        });
      });
    });

    writer.end();
  } catch (ex) {
    console.error(ex);
  }
};

start();
