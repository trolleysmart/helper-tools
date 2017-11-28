// @flow

import commandLineArgs from 'command-line-args';
import {
  CountdownWebCrawlerService,
  Health2000WebCrawlerService,
  ValuemartWebCrawlerService,
  WarehouseWebCrawlerService,
} from 'trolley-smart-store-crawler';
import util from 'util';
import { initializeParse } from './Common';

const optionDefinitions = [
  { name: 'storeKeys', type: String },
  { name: 'concurrentCrawlingCount', type: Number },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'masterKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

const setTimeoutPromise = util.promisify(setTimeout);
let countdownStoreTags;
let health2000StoreTags;
let warehouseStoreTags;

const crawlCountdownProductsDetailsAndCurrentPrice = async () => {
  const service = new CountdownWebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken: global.parseServerSessionToken,
    concurrentCrawlingCount: options.concurrentCrawlingCount,
  });

  countdownStoreTags = countdownStoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(countdownStoreTags)
    .then((count) => {
      if (count === 0) {
        setTimeoutPromise(1000 * 60 * 30).then(() => crawlCountdownProductsDetailsAndCurrentPrice());

        return;
      }

      crawlCountdownProductsDetailsAndCurrentPrice();
    })
    .catch(() => crawlCountdownProductsDetailsAndCurrentPrice());
};

const crawlHealth2000ProductsDetailsAndCurrentPrice = async () => {
  const service = new Health2000WebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken: global.parseServerSessionToken,
    concurrentCrawlingCount: options.concurrentCrawlingCount,
  });

  health2000StoreTags = health2000StoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(health2000StoreTags)
    .then((count) => {
      if (count === 0) {
        setTimeoutPromise(1000 * 60 * 30).then(() => crawlHealth2000ProductsDetailsAndCurrentPrice());

        return;
      }

      crawlHealth2000ProductsDetailsAndCurrentPrice();
    })
    .catch(() => crawlHealth2000ProductsDetailsAndCurrentPrice());
};

const crawlValuemartProductsDetailsAndCurrentPrice = async () => {
  const service = new ValuemartWebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken: global.parseServerSessionToken,
    concurrentCrawlingCount: options.concurrentCrawlingCount,
  });

  health2000StoreTags = health2000StoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(health2000StoreTags)
    .then((count) => {
      if (count === 0) {
        setTimeoutPromise(1000 * 60 * 30).then(() => crawlValuemartProductsDetailsAndCurrentPrice());

        return;
      }

      crawlValuemartProductsDetailsAndCurrentPrice();
    })
    .catch(() => crawlValuemartProductsDetailsAndCurrentPrice());
};

const crawlWarehouseProductsDetailsAndCurrentPrice = async () => {
  const service = new WarehouseWebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken: global.parseServerSessionToken,
    concurrentCrawlingCount: options.concurrentCrawlingCount,
  });

  warehouseStoreTags = warehouseStoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(warehouseStoreTags)
    .then((count) => {
      if (count === 0) {
        setTimeoutPromise(1000 * 60 * 30).then(() => crawlWarehouseProductsDetailsAndCurrentPrice());

        return;
      }

      crawlWarehouseProductsDetailsAndCurrentPrice();
    })
    .catch(() => crawlWarehouseProductsDetailsAndCurrentPrice());
};

const start = async () => {
  try {
    await initializeParse(options);

    const storeKeys = (options.storeKeys || '').split(',');

    if (storeKeys.find(_ => _.localeCompare('countdown') === 0)) {
      crawlCountdownProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
    }

    if (storeKeys.find(_ => _.localeCompare('health2000') === 0)) {
      crawlHealth2000ProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
    }

    if (storeKeys.find(_ => _.localeCompare('valuemart') === 0)) {
      crawlValuemartProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
    }
    if (storeKeys.find(_ => _.localeCompare('warehouse') === 0)) {
      crawlWarehouseProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
    }
  } catch (ex) {
    console.error(ex);
  }
};

start();
