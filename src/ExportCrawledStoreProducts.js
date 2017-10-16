// @flow

import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvWriter from 'csv-write-stream';
import { initializeParse, getStore, loadCrawledStoreProducts, loadLatestCrawledProductPrice, loadStoreTags } from './Common';

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
  const crawledStoreProducts = await loadCrawledStoreProducts(storeId);
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
    ],
  });

  const crawledProductPricesPromises = crawledStoreProducts
    .map(crawledStoreProduct => loadLatestCrawledProductPrice(storeId, crawledStoreProduct.get('id')))
    .toArray();
  const crawledProductPrices = await Promise.all(crawledProductPricesPromises);

  writer.pipe(fs.createWriteStream(options.csvFilePath));
  try {
    crawledStoreProducts.forEach((crawledStoreProduct) => {
      const id = (crawledStoreProduct.get('id') || '').replace(separator, ' - ');
      const name = (crawledStoreProduct.get('name') || '').replace(separator, ' - ');
      const description = (crawledStoreProduct.get('description') || '').replace(separator, ' - ');
      const barcode = (crawledStoreProduct.get('barcode') || '').replace(separator, ' - ');
      const size = (crawledStoreProduct.get('size') || '').replace(separator, ' - ');
      const productPageUrl = (crawledStoreProduct.get('productPageUrl') || '').replace(separator, ' - ');
      const imageUrl = (crawledStoreProduct.get('imageUrl') || '').replace(separator, ' - ');
      const crawledProductPrice = crawledProductPrices
        .find(_ => _.get('crawledStoreProductId').localeCompare(crawledStoreProduct.get('id')) === 0)
        .get('crawledProductPrice');
      const priceToDisplay = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().get('priceToDisplay') || '';
      const status = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().get('status') || '';
      const offerEndDate = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().get('offerEndDate') || '';
      const saving = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().get('saving') || '';
      const savingPercentage = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().get('savingPercentage') || '';
      const specialType = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().getIn(['priceDetails', 'specialType']) || '';
      const currentPrice = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().getIn(['priceDetails', 'currentPrice']) || '';
      const wasPrice = crawledProductPrice.isNone() ? '' : crawledProductPrice.some().getIn(['priceDetails', 'wasPrice']) || '';
      const unitPrice = crawledProductPrice.isNone()
        ? ''
        : `${crawledProductPrice.some().getIn(['priceDetails', 'unitPrice', 'price']) || ''}, ${crawledProductPrice
          .some()
          .getIn(['priceDetails', 'unitPrice', 'size']) || ''}`;

      writer.write({
        id: id.replace('\r\n', ' ').replace('\n', ' '),
        name: name.replace('\r\n', ' ').replace('\n', ' '),
        description: description.replace('\r\n', ' ').replace('\n', ' '),
        barcode: barcode.replace('\r\n', ' ').replace('\n', ' '),
        size: size.replace('\r\n', ' ').replace('\n', ' '),
        productPageUrl: productPageUrl.replace('\r\n', ' ').replace('\n', ' '),
        imageUrl: imageUrl.replace('\r\n', ' ').replace('\n', ' '),
        storeTags: crawledStoreProduct
          .get('storeTagIds')
          .map(storeTagId => storeTags.find(_ => _.get('id').localeCompare(storeTagId) === 0).get('key'))
          .join(),
        tags: crawledStoreProduct
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
      });
    });

    writer.end();
  } catch (e) {
    console.log(e);
  }
};

start();
