// @flow

import BluebirdPromise from 'bluebird';
import { List, Map, Range } from 'immutable';
import commandLineArgs from 'command-line-args';
import Parse from 'parse/node';
import { StapleShoppingListService, StapleTemplateShoppingListService } from 'smart-grocery-parse-server-common';

const optionDefinitions = [
  { name: 'userId', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(options.applicationId ? options.applicationId : 'app_id', options.javaScriptKey ? options.javaScriptKey : 'javascript_key');
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const loadAllStapleTemplateShoppingList = async () => {
  let stapleTemplateShoppingListItems = List();
  const result = await StapleTemplateShoppingListService.searchAll(Map({}));

  try {
    result.event.subscribe(info => (stapleTemplateShoppingListItems = stapleTemplateShoppingListItems.push(info)));

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return stapleTemplateShoppingListItems;
};

const splitIntoChunks = (list, chunkSize) => Range(0, list.count(), chunkSize).map(chunkStart => list.slice(chunkStart, chunkStart + chunkSize));

const start = async () => {
  const items = await loadAllStapleTemplateShoppingList();
  const splittedItems = splitIntoChunks(items, 100);
  await BluebirdPromise.each(splittedItems.toArray(), chunck =>
    Promise.all(chunck.map(item => StapleShoppingListService.create(item.set('userId', options.userId))).toArray()),
  );
};

start();
