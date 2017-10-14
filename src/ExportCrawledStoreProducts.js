// @flow

import commandLineArgs from 'command-line-args';
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

  const crawledStoreProducts = await loadCrawledStoreProducts((await getStore(options.storeKey)).get('id'));

  console.log(crawledStoreProducts.toJS());
};

start();
