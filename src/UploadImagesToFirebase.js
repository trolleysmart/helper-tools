// @flow

import BluebirdPromise from 'bluebird';
import path from 'path';
import { List, Map } from 'immutable';
import commandLineArgs from 'command-line-args';
import fse from 'fs-extra';
import googleCloudStorage from '@google-cloud/storage';
import mime from 'mime';
import Parse from 'parse/node';
import { ParseWrapperService } from 'micro-business-parse-server-common';
import requestPromise from 'request-promise';
import { MasterProductService } from 'smart-grocery-parse-server-common';

const optionDefinitions = [
  { name: 'userId', type: String },
  { name: 'applicationId', type: String },
  { name: 'javaScriptKey', type: String },
  { name: 'parseServerUrl', type: String },
];
const options = commandLineArgs(optionDefinitions);

Parse.initialize(options.applicationId ? options.applicationId : 'app_id', options.javaScriptKey ? options.javaScriptKey : 'javascript_key');
Parse.serverURL = options.parseServerUrl ? options.parseServerUrl : 'http://localhost:12345/parse';

const loadAllMasterProductWithoutImageUrl = async (sessionToken) => {
  let masterProducts = List();
  const result = await MasterProductService.searchAll(Map({ conditions: Map({ without_imageUrl: true }) }), sessionToken);

  try {
    result.event.subscribe(info => (masterProducts = masterProducts.push(info)));

    await result.promise;
  } finally {
    result.event.unsubscribeAll();
  }

  return masterProducts;
};

let uploadedFiles = Map();

const updateMasterProductImageUrl = async (sessionToken, masterProduct, bucket, bucketName) => {
  const imageUrl = masterProduct.get('importedImageUrl');

  if (imageUrl.indexOf('default.CD.png') !== -1) {
    const filename = 'coming-soon.jpg';
    const downloadPath = `/home/morteza/tmp/${filename}`;
    const uploadFilePath = `MasterProducts/${filename}`;
    const publicFileUrl = `http://storage.googleapis.com/${bucketName}/${encodeURIComponent(uploadFilePath)}`;

    if (!uploadedFiles.has(publicFileUrl)) {
      const fileMime = mime.lookup(downloadPath);

      await bucket.upload(downloadPath, { destination: uploadFilePath, public: true, metadata: { contentType: fileMime } });

      uploadedFiles = uploadedFiles.set(publicFileUrl, true);
    }

    await MasterProductService.update(masterProduct.set('imageUrl', publicFileUrl), sessionToken);

    console.log(`Finished updating: ${masterProduct.get('name')}`);

    return;
  }

  const fileContent = await requestPromise(imageUrl, { encoding: null });
  const filename = `${imageUrl.substring('https://shop.countdown.co.nz/'.length).replace(/\//g, '-').toLowerCase()}`;
  const downloadPath = `/home/morteza/tmp/${filename}`;
  const uploadFilePath = `MasterProducts/${filename}`;
  const publicFileUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(uploadFilePath)}`;

  if (!uploadedFiles.has(publicFileUrl)) {
    await fse.outputFile(downloadPath, fileContent);

    const fileMime = mime.lookup(downloadPath);

    await bucket.upload(downloadPath, { destination: uploadFilePath, public: true, metadata: { contentType: fileMime } });

    uploadedFiles = uploadedFiles.set(publicFileUrl, true);
  }

  await MasterProductService.update(masterProduct.set('imageUrl', publicFileUrl), sessionToken);

  console.log(`Finished updating: ${masterProduct.get('name')}`);
};

const start = async () => {
  const user = await ParseWrapperService.logIn(process.env.CRAWLER_USERNAME, process.env.CRAWLER_PASSWORD);
  const sessionToken = user.getSessionToken();
  const masterProducts = await loadAllMasterProductWithoutImageUrl(sessionToken);
  const keyFilename = path.resolve(__dirname, 'smart-grocery-modern-firebase-private-key.json');
  const projectId = 'smart-grocery-modern';
  const bucketName = `${projectId}.appspot.com`;
  const gcs = googleCloudStorage({ projectId, keyFilename });
  const bucket = gcs.bucket(bucketName);

  await BluebirdPromise.each(masterProducts.toArray(), masterProduct => updateMasterProductImageUrl(sessionToken, masterProduct, bucket, bucketName));
};

start();
