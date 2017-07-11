// @flow

import BluebirdPromise from 'bluebird';
import { List, Map, Range } from 'immutable';
import commandLineArgs from 'command-line-args';
import Parse from 'parse/node';
import { StoreMasterProductService } from 'smart-grocery-parse-server-common';

const optionDefinitions = [
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(options.applicationId ? options.applicationId : 'app_id', options.javaScriptKey ? options.javaScriptKey : 'javascript_key');
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const loadAllStoreMasterProducts = async () => {
  let products = List();
  const result = await StoreMasterProductService.searchAll(
    Map({
      with_masterProduct: true,
    }),
  );

  try {
    result.event.subscribe(info => (products = products.push(info)));

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return products;
};

const splitIntoChunks = (list, chunkSize) => Range(0, list.count(), chunkSize).map(chunkStart => list.slice(chunkStart, chunkStart + chunkSize));

const start = async () => {
  const products = await loadAllStoreMasterProducts();
  const splittedItems = splitIntoChunks(products, 100);
  await BluebirdPromise.each(splittedItems.toArray(), productChunk =>
    Promise.all(productChunk.map(product => StoreMasterProductService.update(product.set('lastCrawlDateTime', new Date(1970, 1, 1)))).toArray()),
  );

  console.log('Reset last crawl date/time done.');
};

start();
