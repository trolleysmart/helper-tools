// @flow

import Immutable from 'immutable';
import commandLineArgs from 'command-line-args';
import { initializeParse, loadStapleTemplateItems, cloneStapleTemplateItems } from './Common';

const optionDefinitions = [
  { name: 'userIds', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'masterKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

const start = async () => {
  await initializeParse(options);

  const userIds = Immutable.fromJS(options.userIds.trim().split(','))
    .map(userId => userId.trim())
    .filter(userId => userId);

  if (!userIds.isEmpty()) {
    const stapleTemplateItems = await loadStapleTemplateItems();

    await Promise.all(userIds.map(userId => cloneStapleTemplateItems(stapleTemplateItems, userId)).toArray());
  }

  console.log('Finised cloning staple template items for provided users');
};

start();
