// @flow

import commandLineArgs from 'command-line-args';
import { CountdownWebCrawlerService, Health2000WebCrawlerService, WarehouseWebCrawlerService } from 'trolley-smart-store-crawler';
import { initializeParse } from './Common';

const optionDefinitions = [
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'masterKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

let countdownStoreTags;
let health2000StoreTags;
let warehouseStoreTags;

const crawlCountdownProductsDetailsAndCurrentPrice = async (sessionToken) => {
  const service = new CountdownWebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken,
  });

  countdownStoreTags = countdownStoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(countdownStoreTags)
    .then(() => crawlCountdownProductsDetailsAndCurrentPrice(sessionToken))
    .catch(() => crawlCountdownProductsDetailsAndCurrentPrice(sessionToken));
};

const crawlHealth2000ProductsDetailsAndCurrentPrice = async (sessionToken) => {
  const service = new Health2000WebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken,
  });

  health2000StoreTags = health2000StoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(health2000StoreTags)
    .then(() => crawlHealth2000ProductsDetailsAndCurrentPrice(sessionToken))
    .catch(() => crawlHealth2000ProductsDetailsAndCurrentPrice(sessionToken));
};

const crawlWarehouseProductsDetailsAndCurrentPrice = async (sessionToken) => {
  const service = new WarehouseWebCrawlerService({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken,
  });

  warehouseStoreTags = warehouseStoreTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(warehouseStoreTags)
    .then(() => crawlWarehouseProductsDetailsAndCurrentPrice(sessionToken))
    .catch(() => crawlWarehouseProductsDetailsAndCurrentPrice(sessionToken));
};

const start = async () => {
  await initializeParse(options);

  crawlCountdownProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
  crawlHealth2000ProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
  crawlWarehouseProductsDetailsAndCurrentPrice(global.parseServerSessionToken);
};

start();
