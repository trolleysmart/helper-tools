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

  const crawledStoreProducts = await loadCrawledStoreProducts((await getStore(options.storeKey)).get('id'));
  const separator = options.delimiter ? options.delimiter : '|';
  const newLineDelimiter = options.rowDelimiter ? options.rowDelimiter : '\n';

  const writer = csvWriter({
    separator,
    newLine: newLineDelimiter,
    headers: ['id', 'name', 'description', 'barcode', 'size', 'productPageUrl', 'imageUrl'],
  });

  writer.pipe(fs.createWriteStream(options.csvFilePath));

  crawledStoreProducts.forEach((crawledStoreProduct) => {
    const id = crawledStoreProduct.get('id') || '';
    const name = crawledStoreProduct.get('name') || '';
    const description = crawledStoreProduct.get('description') || '';
    const barcode = crawledStoreProduct.get('barcode') || '';
    const size = crawledStoreProduct.get('size') || '';
    const productPageUrl = crawledStoreProduct.get('productPageUrl') || '';
    const imageUrl = crawledStoreProduct.get('imageUrl') || '';

    if (id.indexOf(separator) !== -1) {
      throw new Error(`Id: ${id} cannot contain ${separator}`);
    }

    if (name.indexOf(separator) !== -1) {
      throw new Error(`Name: ${name} cannot contain ${separator}`);
    }

    if (description.indexOf(separator) !== -1) {
      throw new Error(`Description: ${description} cannot contain ${separator}`);
    }

    if (barcode.indexOf(separator) !== -1) {
      throw new Error(`Barcode: ${barcode} cannot contain ${separator}`);
    }

    if (size.indexOf(separator) !== -1) {
      throw new Error(`Size: ${size} cannot contain ${separator}`);
    }

    if (productPageUrl.indexOf(separator) !== -1) {
      throw new Error(`ProductPageUrl: ${productPageUrl} cannot contain ${separator}`);
    }

    if (imageUrl.indexOf(separator) !== -1) {
      throw new Error(`ImageUrl: ${imageUrl} cannot contain ${separator}`);
    }

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
