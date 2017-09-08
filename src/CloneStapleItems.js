// @flow

import Immutable, { List, Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import Parse from 'parse/node';
import { ParseWrapperService, UserService } from 'micro-business-parse-server-common';
import { StapleItemService, StapleTemplateItemService } from 'trolley-smart-parse-server-common';

const stapleItemService = new StapleItemService();
const stapleTemplateItemService = new StapleTemplateItemService();

const optionDefinitions = [
  { name: 'userIds', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(options.applicationId ? options.applicationId : 'app_id', options.javaScriptKey ? options.javaScriptKey : 'javascript_key');
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const loadAllStapleTemplateItems = async () => {
  let stapleTemplateItems = List();
  const result = await stapleTemplateItemService.searchAll(Map({}));

  try {
    result.event.subscribe((info) => {
      stapleTemplateItems = stapleTemplateItems.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return stapleTemplateItems;
};

const loadAllStapleItems = async (userId) => {
  let stapleItems = List();
  const result = await stapleItemService.searchAll(Map({ conditions: Map({ userId }) }));

  try {
    result.event.subscribe((info) => {
      stapleItems = stapleItems.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return stapleItems;
};

const cloneStapleTemplateItems = async (stapleTemplateItems, userId) => {
  const stapleItems = await loadAllStapleItems(userId);

  if (!stapleItems.isEmpty()) {
    await Promise.all(stapleItems.map(stapleItem => stapleItemService.delete(stapleItem.get('id'))).toArray());
  }

  const acl = ParseWrapperService.createACL(await UserService.getUserById(userId));

  await Promise.all(
    stapleTemplateItems
      .map(stapleTemplateItem =>
        stapleItemService.create(stapleTemplateItem.merge({ userId, stapleTemplateItemId: stapleTemplateItem.get('id') }), acl),
      )
      .toArray(),
  );
};

const start = async () => {
  const userIds = Immutable.fromJS(options.userIds.trim().split(','))
    .map(userId => userId.trim())
    .filterNot(userId => userId);

  if (!userIds.isEmpty()) {
    const stapleTemplateItems = await loadAllStapleTemplateItems();

    await Promise.all(userIds.map(userId => cloneStapleTemplateItems(stapleTemplateItems, userId)).toArray());
  }

  console.log('Finised cloning staple template items for provided users');
};

start();
