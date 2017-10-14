// @flow

import commandLineArgs from 'command-line-args';
import fs from 'fs';
import csvWriter from 'csv-write-stream';
import { initializeParse, getStore, loadCrawledStoreProducts } from './Common';

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
  const tags = await loadTags();
  const separator = options.delimiter ? options.delimiter : '|';
  const newLineDelimiter = options.rowDelimiter ? options.rowDelimiter : '\n';

  const writer = csvWriter({
    separator,
    newLine: newLineDelimiter,
    headers: ['id', 'name', 'description', 'barcode', 'size', 'productPageUrl', 'imageUrl'],
  });

  writer.pipe(fs.createWriteStream(options.csvFilePath));

  crawledStoreProducts.forEach((crawledStoreProduct) => {
    const id = (crawledStoreProduct.get('id') || '').replace(separator, ' - ');
    const name = (crawledStoreProduct.get('name') || '').replace(separator, ' - ');
    const description = (crawledStoreProduct.get('description') || '').replace(separator, ' - ');
    const barcode = (crawledStoreProduct.get('barcode') || '').replace(separator, ' - ');
    const size = (crawledStoreProduct.get('size') || '').replace(separator, ' - ');
    const productPageUrl = (crawledStoreProduct.get('productPageUrl') || '').replace(separator, ' - ');
    const imageUrl = (crawledStoreProduct.get('imageUrl') || '').replace(separator, ' - ');

    writer.write({
      id: id.replace('\r\n', ' ').replace('\n', ' '),
      name: name.replace('\r\n', ' ').replace('\n', ' '),
      description: description.replace('\r\n', ' ').replace('\n', ' '),
      barcode: barcode.replace('\r\n', ' ').replace('\n', ' '),
      size: size.replace('\r\n', ' ').replace('\n', ' '),
      productPageUrl: productPageUrl.replace('\r\n', ' ').replace('\n', ' '),
      imageUrl: imageUrl.replace('\r\n', ' ').replace('\n', ' '),
    });
  });

  writer.end();
};

start();
