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

const createServiceInstance = async Service =>
  new Service({
    logVerboseFunc: message => console.log(message),
    logInfoFunc: message => console.log(message),
    logErrorFunc: message => console.log(message),
    sessionToken: global.parseServerSessionToken,
    concurrentCrawlingCount: options.concurrentCrawlingCount,
  });

const crawlProductsDetailsAndCurrentPrice = async (service, storeTags) => {
  const finalStoreTags = storeTags || (await service.getStoreTags());

  service
    .crawlProductsDetailsAndCurrentPrice(finalStoreTags)
    .then((count) => {
      if (count === 0) {
        setTimeoutPromise(1000 * 60 * 30).then(() => crawlProductsDetailsAndCurrentPrice(service, finalStoreTags));

        return;
      }

      crawlProductsDetailsAndCurrentPrice(service, finalStoreTags);
    })
    .catch(() => crawlProductsDetailsAndCurrentPrice(service, finalStoreTags));
};

const start = async () => {
  try {
    await initializeParse(options);

    const storeKeys = (options.storeKeys || '').split(',');

    if (storeKeys.find(_ => _.localeCompare('countdown') === 0)) {
      crawlProductsDetailsAndCurrentPrice(createServiceInstance(CountdownWebCrawlerService));
    }

    if (storeKeys.find(_ => _.localeCompare('health2000') === 0)) {
      crawlProductsDetailsAndCurrentPrice(createServiceInstance(Health2000WebCrawlerService));
    }

    if (storeKeys.find(_ => _.localeCompare('valuemart') === 0)) {
      crawlProductsDetailsAndCurrentPrice(createServiceInstance(ValuemartWebCrawlerService));
    }

    if (storeKeys.find(_ => _.localeCompare('warehouse') === 0)) {
      crawlProductsDetailsAndCurrentPrice(createServiceInstance(WarehouseWebCrawlerService));
    }
  } catch (ex) {
    console.error(ex);
  }
};

start();
