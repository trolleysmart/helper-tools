// @flow

import { List, Map } from 'immutable';
import { Maybe } from 'monet';
import Parse from 'parse/node';
import { ParseWrapperService, UserService } from 'micro-business-parse-server-common';
import {
  ProductPriceService,
  StapleItemService,
  StoreProductService,
  StapleTemplateItemService,
  StoreService,
  StoreTagService,
  TagService,
} from 'trolley-smart-parse-server-common';

export const initializeParse = async (options) => {
  Parse.initialize(
    options.applicationId ? options.applicationId : 'app_id',
    options.javaScriptKey ? options.javaScriptKey : 'javascript_key',
    options.masterKey ? options.masterKey : 'master_key',
  );

  Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

  const user = await ParseWrapperService.logIn(process.env.CRAWLER_USERNAME, process.env.CRAWLER_PASSWORD);

  global.parseServerSessionToken = user.getSessionToken();
};

export const getStore = async (key) => {
  const criteria = Map({
    conditions: Map({
      key,
    }),
  });
  const storeService = new StoreService();
  const stores = await storeService.search(criteria, global.parseServerSessionToken);

  if (stores.count() > 1) {
    throw new Error(`Multiple store found with store key: ${this.storeKey}.`);
  }

  return stores.isEmpty() ? storeService.read(await storeService.create(Map({ key })), null, global.parseServerSessionToken) : stores.first();
};

export const loadStoreTags = async (storeId, { includeTag } = {}) => {
  let storeTags = List();
  const result = await new StoreTagService().searchAll(
    Map({ include_tag: includeTag || undefined, conditions: Map({ storeId }) }),
    global.parseServerSessionToken,
  );

  try {
    result.event.subscribe((info) => {
      storeTags = storeTags.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return storeTags;
};

export const loadTags = async () => {
  let tags = List();
  const result = await new TagService().searchAll(Map({}), global.parseServerSessionToken);

  try {
    result.event.subscribe((info) => {
      tags = tags.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return tags;
};

export const loadStapleTemplateItems = async () => {
  let stapleTemplateItems = List();
  const result = await new StapleTemplateItemService().searchAll(Map({}), global.parseServerSessionToken);

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

export const cloneStapleTemplateItems = async (stapleTemplateItems, userId) => {
  const acl = ParseWrapperService.createACL(await UserService.getUserById(userId));
  const stapleItemService = new StapleItemService();

  await Promise.all(stapleTemplateItems
    .map(stapleTemplateItem =>
      stapleItemService.create(
        stapleTemplateItem.merge({ userId, stapleTemplateItemId: stapleTemplateItem.get('id') }),
        acl,
        global.parseServerSessionToken,
      ))
    .toArray());
};

export const loadStoreProduct = async (storeId, createdByCrawler, name) => {
  const criteria = Map({ conditions: Map({ storeId, createdByCrawler, name }) });

  const storeProducts = await new StoreProductService().search(criteria, global.parseServerSessionToken);

  if (storeProducts.isEmpty()) {
    return Maybe.None();
  } else if (storeProducts.count() === 1) {
    return Maybe.Some(storeProducts.first());
  }

  throw new Error(`Multiple store product found for provided name: ${name}`);
};

export const loadStoreProducts = async (storeId, createdByCrawler) => {
  let storeProducts = List();
  const result = await new StoreProductService().searchAll(Map({ conditions: Map({ storeId, createdByCrawler }) }), global.parseServerSessionToken);

  try {
    result.event.subscribe((info) => {
      storeProducts = storeProducts.push(info);
    });

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return storeProducts;
};

export const loadLatestProductPrice = async (storeId, storeProductId, createdByCrawler) => {
  const productPrices = await new ProductPriceService().search(
    Map({ topMost: true, conditions: Map({ storeId, storeProductId, createdByCrawler }) }),
    global.parseServerSessionToken,
  );

  if (productPrices.isEmpty()) {
    return Map({ storeProductId, productPrice: Maybe.None() });
  }

  return Map({ storeProductId, productPrice: Maybe.Some(productPrices.first()) });
};
