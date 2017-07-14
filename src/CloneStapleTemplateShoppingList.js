// @flow

import commandLineArgs from 'command-line-args';
import Parse from 'parse/node';
import { StapleShoppingListService } from 'smart-grocery-parse-server-common';

const optionDefinitions = [
  { name: 'userId', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(options.applicationId ? options.applicationId : 'app_id', options.javaScriptKey ? options.javaScriptKey : 'javascript_key');
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const start = async () => {
  await StapleShoppingListService.cloneStapleShoppingList(options.userId);
};

start();
