// @flow

import commandLineArgs from 'command-line-args';
import { Countdown, Guruji, Health2000, Valuemart, Warehouse } from 'trolley-smart-store-crawler';
import util from 'util';
import { initializeParse } from './Common';

const optionDefinitions = [
  { name: 'storeKeys', type: String },
  { name: 'concurrentCrawlingCount', type: Number },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'masterKey', type: String },
  { name: 'parseServerUrl', type: String },
  { name: 'crawlStoreTags', type: Boolean },
  { name: 'crawlProducts', type: Boolean },
  { name: 'crawlProductPrices', type: Boolean },
];
const options = commandLineArgs(optionDefinitions);

const setTimeoutPromise = util.promisify(setTimeout);

const createServiceInstance = Service =>
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

    const countdownService = createServiceInstance(Countdown);
    const gurujiService = createServiceInstance(Guruji);
    const health2000Service = createServiceInstance(Health2000);
    const valuemartService = createServiceInstance(Valuemart);
    const warehouseService = createServiceInstance(Warehouse);

    if (options.crawlStoreTags) {
      if (storeKeys.find(_ => _.localeCompare('countdown') === 0)) {
        await countdownService.crawlAndSyncProductCategoriesToStoreTags();
      }

      if (storeKeys.find(_ => _.localeCompare('guruji') === 0)) {
        await gurujiService.crawlAndSyncProductCategoriesToStoreTags();
      }

      if (storeKeys.find(_ => _.localeCompare('health2000') === 0)) {
        await health2000Service.crawlAndSyncProductCategoriesToStoreTags();
      }

      if (storeKeys.find(_ => _.localeCompare('valuemart') === 0)) {
        await valuemartService.crawlAndSyncProductCategoriesToStoreTags();
      }

      if (storeKeys.find(_ => _.localeCompare('warehouse') === 0)) {
        await warehouseService.crawlAndSyncProductCategoriesToStoreTags();
      }
    }

    if (options.crawlProducts) {
      if (storeKeys.find(_ => _.localeCompare('countdown') === 0)) {
        await countdownService.crawlProducts();
      }

      if (storeKeys.find(_ => _.localeCompare('guruji') === 0)) {
        await gurujiService.crawlProducts();
      }

      if (storeKeys.find(_ => _.localeCompare('health2000') === 0)) {
        await health2000Service.crawlProducts();
      }

      if (storeKeys.find(_ => _.localeCompare('valuemart') === 0)) {
        await valuemartService.crawlProducts();
      }

      if (storeKeys.find(_ => _.localeCompare('warehouse') === 0)) {
        await warehouseService.crawlProducts();
      }
    }

    if (options.crawlProductPrices) {
      if (storeKeys.find(_ => _.localeCompare('countdown') === 0)) {
        crawlProductsDetailsAndCurrentPrice(countdownService);
      }

      if (storeKeys.find(_ => _.localeCompare('guruji') === 0)) {
        crawlProductsDetailsAndCurrentPrice(gurujiService);
      }

      if (storeKeys.find(_ => _.localeCompare('health2000') === 0)) {
        crawlProductsDetailsAndCurrentPrice(health2000Service);
      }

      if (storeKeys.find(_ => _.localeCompare('valuemart') === 0)) {
        crawlProductsDetailsAndCurrentPrice(valuemartService);
      }

      if (storeKeys.find(_ => _.localeCompare('warehouse') === 0)) {
        crawlProductsDetailsAndCurrentPrice(warehouseService);
      }
    }
  } catch (ex) {
    console.error(ex);
  }
};

start();
