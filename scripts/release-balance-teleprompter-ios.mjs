import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const apiRoot = 'https://api.appstoreconnect.apple.com';
const bundleId = 'com.balance.teleprompter';
const versionString = '1.0';
const productId = 'balance_teleprompter_lifetime';
const locale = 'en-AU';
const screenshotDirectory = process.env.APP_STORE_SCREENSHOT_DIR
  || 'apps/balance-teleprompter/store-listing/app-store-assets';

const description = `Speak naturally. Stay connected.

Balance Teleprompter puts your script beside the camera so you can deliver confident videos without looking away from your audience.

Set up your shot before showing the script, choose your preferred recording quality, and adjust the prompt until it feels effortless. Your scripts and recordings stay on your device.

FEATURES

• Record in 720p, Full HD 1080p or 4K when supported by your device
• Portrait mode keeps you sharp and blurs the background in preview and recordings
• Hide or show the script whenever you like
• Smooth auto-scroll with adjustable speed
• Adjustable text size and mirrored text
• Camera zoom controls
• Front and rear camera switching
• Full-screen recording mode
• Save or share recordings from your phone
• Script and preferences saved locally

PRICING

Try three recordings free. Unlock unlimited lifetime use with one non-consumable in-app purchase. No subscription.

Your camera, microphone, scripts and recordings are processed on your device. Apple processes the optional lifetime purchase.`;

const versionMetadata = {
  description,
  keywords: 'teleprompter,video,script,camera,creator,reels,presenter,speech,recording,autocue',
  marketingUrl: 'https://sightline-teleprompter.shanizle.chatgpt.site',
  promotionalText: 'Keep your script beside the lens, add Portrait background blur, then record in Full HD or 4K with simple speed, text and zoom controls.',
  supportUrl: 'https://plantbased-balance.org/contact.html',
};

const reviewNotes = `No sign-in is required. A fresh install provides three completed recordings with every feature enabled. The lifetime purchase only unlocks continued use after those recordings. Portrait mode uses native camera blur when available, otherwise it performs on-device person segmentation and records at up to 1080p. The Restore Purchase button is available on the lifetime access screen. Camera, microphone, scripts, and recordings stay on the device.`;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const keyId = requiredEnv('APP_STORE_CONNECT_API_KEY_ID');
const issuerId = requiredEnv('APP_STORE_CONNECT_ISSUER_ID');
const privateKey = createPrivateKey(
  Buffer.from(requiredEnv('APP_STORE_CONNECT_API_KEY_BASE64'), 'base64').toString('utf8'),
);

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const payload = encode({ iss: issuerId, iat: now, exp: now + 1_200, aud: 'appstoreconnect-v1' });
  const unsigned = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `${unsigned}.${signature}`;
}

function formatErrors(body) {
  return (body?.errors || [])
    .map((error) => [error.status, error.code, error.title, error.detail].filter(Boolean).join(' - '))
    .join('\n');
}

async function asc(apiPath, options = {}, allow = []) {
  const response = await fetch(`${apiRoot}${apiPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${makeToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`App Store Connect API ${response.status} for ${apiPath}\n${formatErrors(body) || text}`);
  }
  return { status: response.status, body };
}

function query(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getApp(identifier = bundleId) {
  const { body } = await asc(`/v1/apps?${query({ 'filter[bundleId]': identifier, limit: 1 })}`);
  const app = body.data?.[0];
  if (!app) throw new Error(`No App Store Connect app record found for ${identifier}`);
  return app;
}

async function updateAppDeclaration(app) {
  await asc(`/v1/apps/${app.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'apps',
        id: app.id,
        attributes: {
          contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
        },
      },
    }),
  });
  console.log('Confirmed the app does not use third-party content.');
}

async function getOrCreateVersion(app) {
  const { body } = await asc(`/v1/apps/${app.id}/appStoreVersions?${query({
    'filter[platform]': 'IOS',
    'filter[versionString]': versionString,
    limit: 10,
  })}`);
  if (body.data?.[0]) return body.data[0];

  const created = await asc('/v1/appStoreVersions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersions',
        attributes: {
          platform: 'IOS',
          versionString,
          copyright: '2026 Balance',
          releaseType: 'AFTER_APPROVAL',
          reviewType: 'APP_STORE',
        },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    }),
  });
  return created.body.data;
}

async function updateVersion(version) {
  await asc(`/v1/appStoreVersions/${version.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersions',
        id: version.id,
        attributes: {
          copyright: '2026 Balance',
          releaseType: 'AFTER_APPROVAL',
          reviewType: 'APP_STORE',
        },
      },
    }),
  });
}

async function getOrCreateVersionLocalization(version) {
  const { body } = await asc(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?${query({ limit: 50 })}`);
  const existing = (body.data || []).find((item) => item.attributes?.locale === locale) || body.data?.[0];
  if (existing) {
    await asc(`/v1/appStoreVersionLocalizations/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersionLocalizations',
          id: existing.id,
          attributes: versionMetadata,
        },
      }),
    });
    return existing;
  }

  const created = await asc('/v1/appStoreVersionLocalizations', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: { locale, ...versionMetadata },
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
        },
      },
    }),
  });
  return created.body.data;
}

async function configureAppInfo(app) {
  const { body } = await asc(`/v1/apps/${app.id}/appInfos?${query({
    include: 'appInfoLocalizations,ageRatingDeclaration',
    limit: 50,
  })}`);
  const appInfo = body.data?.[0];
  if (!appInfo) throw new Error('Apple did not create App Info for the new app record.');

  await asc(`/v1/appInfos/${appInfo.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appInfos',
        id: appInfo.id,
        relationships: {
          primaryCategory: { data: { type: 'appCategories', id: 'PHOTO_AND_VIDEO' } },
        },
      },
    }),
  });

  const localizations = (body.included || []).filter((item) => item.type === 'appInfoLocalizations');
  const localization = localizations.find((item) => item.attributes?.locale === locale) || localizations[0];
  if (!localization) throw new Error('Apple did not create an App Info localization.');
  await asc(`/v1/appInfoLocalizations/${localization.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appInfoLocalizations',
        id: localization.id,
        attributes: {
          name: 'Balance Teleprompter',
          subtitle: 'Record naturally in 4K',
          privacyPolicyUrl: 'https://sightline-teleprompter.shanizle.chatgpt.site/privacy',
        },
      },
    }),
  });

  const ageRating = (body.included || []).find((item) => item.type === 'ageRatingDeclarations');
  if (!ageRating) throw new Error('Apple did not create an age-rating declaration.');
  const none = 'NONE';
  await asc(`/v1/ageRatingDeclarations/${ageRating.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'ageRatingDeclarations',
        id: ageRating.id,
        attributes: {
          advertising: false,
          alcoholTobaccoOrDrugUseOrReferences: none,
          contests: none,
          gambling: false,
          gamblingSimulated: none,
          gunsOrOtherWeapons: none,
          healthOrWellnessTopics: false,
          lootBox: false,
          medicalOrTreatmentInformation: none,
          messagingAndChat: false,
          parentalControls: false,
          profanityOrCrudeHumor: none,
          ageAssurance: false,
          sexualContentGraphicAndNudity: none,
          sexualContentOrNudity: none,
          socialMedia: false,
          socialMediaAgeRestricted: false,
          horrorOrFearThemes: none,
          matureOrSuggestiveThemes: none,
          unrestrictedWebAccess: false,
          userGeneratedContent: false,
          violenceCartoonOrFantasy: none,
          violenceRealisticProlongedGraphicOrSadistic: none,
          violenceRealistic: none,
          ageRatingOverrideV2: none,
          koreaAgeRatingOverride: none,
        },
      },
    }),
  });
  console.log('Configured category, product-page identity, privacy URL, and age rating.');
}

async function uploadReservedAsset({ createPath, updatePath, type, relationshipName, relationshipType, relationshipId, filePath, includeChecksum = true }) {
  const fileBuffer = await readFile(filePath);
  const fileName = path.basename(filePath);
  const reservation = await asc(createPath, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type,
        attributes: { fileName, fileSize: fileBuffer.length },
        relationships: {
          [relationshipName]: { data: { type: relationshipType, id: relationshipId } },
        },
      },
    }),
  });

  const asset = reservation.body.data;
  for (const operation of asset.attributes?.uploadOperations || []) {
    const headers = Object.fromEntries((operation.requestHeaders || []).map((header) => [header.name, header.value]));
    const body = fileBuffer.subarray(operation.offset, operation.offset + operation.length);
    const upload = await fetch(operation.url, { method: operation.method, headers, body });
    if (!upload.ok) throw new Error(`Apple asset upload failed for ${fileName}: HTTP ${upload.status}`);
  }

  await asc(`${updatePath}/${asset.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type,
        id: asset.id,
        attributes: {
          uploaded: true,
          ...(includeChecksum
            ? { sourceFileChecksum: createHash('md5').update(fileBuffer).digest('hex') }
            : {}),
        },
      },
    }),
  });

  return waitForAssetCompletion(updatePath, asset.id, fileName);
}

async function waitForAssetCompletion(updatePath, assetId, fileName) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await asc(`${updatePath}/${assetId}`);
    const state = result.body.data?.attributes?.assetDeliveryState?.state;
    if (state === 'COMPLETE') return assetId;
    if (state === 'FAILED') throw new Error(`Apple rejected asset ${fileName}.`);
    await sleep(5_000);
  }
  throw new Error(`Timed out while Apple processed ${fileName}.`);
}

async function configureScreenshots(localization) {
  const sets = await asc(`/v1/appStoreVersionLocalizations/${localization.id}/appScreenshotSets?${query({ include: 'appScreenshots', limit: 50 })}`);
  let set = (sets.body.data || []).find((item) => item.attributes?.screenshotDisplayType === 'APP_IPHONE_67');
  if (!set) {
    const created = await asc('/v1/appScreenshotSets', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: localization.id },
            },
          },
        },
      }),
    });
    set = created.body.data;
  }

  const existing = await asc(`/v1/appScreenshotSets/${set.id}/appScreenshots?${query({ limit: 50 })}`);
  if (existing.body.data?.length) {
    console.log(`App Store screenshots already present (${existing.body.data.length}).`);
    return;
  }

  const files = (await readdir(screenshotDirectory))
    .filter((name) => /^0[1-4]-.*-1320x2868\.jpg$/i.test(name))
    .sort();
  for (const file of files) {
    await uploadReservedAsset({
      createPath: '/v1/appScreenshots',
      updatePath: '/v1/appScreenshots',
      type: 'appScreenshots',
      relationshipName: 'appScreenshotSet',
      relationshipType: 'appScreenshotSets',
      relationshipId: set.id,
      filePath: path.join(screenshotDirectory, file),
    });
    console.log(`Uploaded App Store screenshot: ${file}`);
  }
}

async function copyReviewContact() {
  try {
    const balanceApp = await getApp('com.fitgotchi.app');
    const versions = await asc(`/v1/apps/${balanceApp.id}/appStoreVersions?${query({
      'filter[platform]': 'IOS',
      limit: 50,
    })}`);
    for (const version of versions.body.data || []) {
      const detail = await asc(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`, {}, [404]);
      const attrs = detail.body.data?.attributes;
      if (attrs?.contactFirstName && attrs?.contactLastName && attrs?.contactPhone && attrs?.contactEmail) {
        return {
          contactFirstName: attrs.contactFirstName,
          contactLastName: attrs.contactLastName,
          contactPhone: attrs.contactPhone,
          contactEmail: attrs.contactEmail,
        };
      }
    }
  } catch (error) {
    console.log(`Could not copy the existing Balance review contact: ${error.message}`);
  }
  return {
    contactFirstName: 'Shannon',
    contactLastName: 'Birch',
    contactEmail: 'shannonrhysbirch@gmail.com',
  };
}

async function configureReviewDetails(version) {
  const existing = await asc(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`, {}, [404]);
  const attributes = {
    ...(await copyReviewContact()),
    demoAccountRequired: false,
    notes: reviewNotes,
  };
  if (existing.body.data?.id) {
    await asc(`/v1/appStoreReviewDetails/${existing.body.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { type: 'appStoreReviewDetails', id: existing.body.data.id, attributes },
      }),
    });
  } else {
    await asc('/v1/appStoreReviewDetails', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreReviewDetails',
          attributes,
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      }),
    });
  }
  console.log('Configured App Review instructions and contact details.');
}

async function getTerritories() {
  const result = await asc(`/v1/territories?${query({ limit: 200 })}`);
  return result.body.data || [];
}

async function ensureAppAvailability(app, territories) {
  const existing = await asc(`/v1/apps/${app.id}/appAvailabilityV2`, {}, [404]);
  if (existing.body.data?.id) return;
  const included = territories.map((territory, index) => ({
    type: 'territoryAvailabilities',
    id: `\${territory${index}}`,
    attributes: { available: true, preOrderEnabled: false },
    relationships: { territory: { data: { type: 'territories', id: territory.id } } },
  }));
  await asc('/v2/appAvailabilities', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appAvailabilities',
        attributes: { availableInNewTerritories: true },
        relationships: {
          app: { data: { type: 'apps', id: app.id } },
          territoryAvailabilities: {
            data: included.map((item) => ({ type: item.type, id: item.id })),
          },
        },
      },
      included,
    }),
  });
  console.log(`Made the app available in ${territories.length} storefronts.`);
}

async function ensureFreeAppPrice(app) {
  const existing = await asc(`/v1/apps/${app.id}/appPriceSchedule`, {}, [404]);
  if (existing.body.data?.id) return;
  const points = await asc(`/v1/apps/${app.id}/appPricePoints?${query({
    'filter[territory]': 'AUS',
    'fields[appPricePoints]': 'customerPrice',
    limit: 200,
  })}`);
  const freePoint = (points.body.data || []).find((point) => Number(point.attributes?.customerPrice) === 0);
  if (!freePoint) throw new Error('Apple did not return a free app price point for Australia.');
  const priceId = 'free-aus';
  await asc('/v1/appPriceSchedules', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appPriceSchedules',
        relationships: {
          app: { data: { type: 'apps', id: app.id } },
          baseTerritory: { data: { type: 'territories', id: 'AUS' } },
          manualPrices: { data: [{ type: 'appPrices', id: priceId }] },
        },
      },
      included: [{
        type: 'appPrices',
        id: priceId,
        attributes: { startDate: null },
        relationships: {
          appPricePoint: { data: { type: 'appPricePoints', id: freePoint.id } },
        },
      }],
    }),
  });
  console.log('Set the app download price to Free.');
}

async function getOrCreateIap(app) {
  const listed = await asc(`/v1/apps/${app.id}/inAppPurchasesV2?${query({ limit: 50 })}`);
  let iap = (listed.body.data || []).find((item) => item.attributes?.productId === productId);
  if (!iap) {
    const created = await asc('/v2/inAppPurchases', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'inAppPurchases',
          attributes: {
            name: 'Balance Teleprompter Lifetime',
            productId,
            inAppPurchaseType: 'NON_CONSUMABLE',
            familySharable: false,
            reviewNote: reviewNotes,
          },
          relationships: { app: { data: { type: 'apps', id: app.id } } },
        },
      }),
    });
    iap = created.body.data;
    console.log(`Created non-consumable purchase ${productId}.`);
  }
  return iap;
}

async function getOrCreateIapVersion(iap) {
  const listed = await asc(`/v2/inAppPurchases/${iap.id}/versions?${query({ limit: 50 })}`);
  if (listed.body.data?.[0]) return listed.body.data[0];
  const created = await asc('/v1/inAppPurchaseVersions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchaseVersions',
        relationships: { inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } } },
      },
    }),
  });
  return created.body.data;
}

async function configureIapLocalization(iapVersion) {
  const listed = await asc(`/v1/inAppPurchaseVersions/${iapVersion.id}/localizations?${query({ limit: 50 })}`);
  if (listed.body.data?.length) return;
  await asc('/v2/inAppPurchaseLocalizations', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchaseLocalizations',
        attributes: {
          locale,
          name: 'Lifetime Access',
          description: 'Unlock Balance Teleprompter forever. One payment.',
        },
        relationships: { version: { data: { type: 'inAppPurchaseVersions', id: iapVersion.id } } },
      },
    }),
  });
}

async function configureIapReviewImage(iap, iapVersion) {
  const promotionImages = await asc(`/v1/inAppPurchaseVersions/${iapVersion.id}/images?${query({ limit: 50 })}`);
  for (const image of promotionImages.body.data || []) {
    await asc(`/v2/inAppPurchaseImages/${image.id}`, { method: 'DELETE' });
    console.log(`Removed rejected temporary promotion image ${image.id}.`);
  }

  const reviewFile = path.join(screenshotDirectory, 'lifetime-purchase-review-1320x2868.jpg');
  await stat(reviewFile);
  const existing = await asc(`/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`, {}, [404]);
  if (existing.body.data?.attributes?.assetDeliveryState?.state === 'COMPLETE') {
    console.log('Lifetime-purchase App Review screenshot already present.');
    return;
  }

  await uploadReservedAsset({
    createPath: '/v1/inAppPurchaseAppStoreReviewScreenshots',
    updatePath: '/v1/inAppPurchaseAppStoreReviewScreenshots',
    type: 'inAppPurchaseAppStoreReviewScreenshots',
    relationshipName: 'inAppPurchaseV2',
    relationshipType: 'inAppPurchases',
    relationshipId: iap.id,
    filePath: reviewFile,
  });
  console.log('Uploaded the lifetime-purchase App Review screenshot.');
}

async function ensureIapAvailability(iap, territories) {
  const existing = await asc(`/v2/inAppPurchases/${iap.id}/inAppPurchaseAvailability`, {}, [404]);
  if (existing.body.data?.id) return;
  await asc('/v1/inAppPurchaseAvailabilities', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchaseAvailabilities',
        attributes: { availableInNewTerritories: true },
        relationships: {
          inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
          availableTerritories: {
            data: territories.map((territory) => ({ type: 'territories', id: territory.id })),
          },
        },
      },
    }),
  });
}

async function ensureIapPrice(iap) {
  const existing = await asc(`/v2/inAppPurchases/${iap.id}/iapPriceSchedule`, {}, [404]);
  if (existing.body.data?.id) return;
  const points = await asc(`/v2/inAppPurchases/${iap.id}/pricePoints?${query({
    'filter[territory]': 'AUS',
    'fields[inAppPurchasePricePoints]': 'customerPrice',
    limit: 8000,
  })}`);
  const point = (points.body.data || []).find((item) => Number(item.attributes?.customerPrice) === 9.99);
  if (!point) throw new Error('Apple did not return an AUD $9.99 in-app purchase price point.');
  const priceId = 'lifetime-aus';
  await asc('/v1/inAppPurchasePriceSchedules', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchasePriceSchedules',
        relationships: {
          inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
          baseTerritory: { data: { type: 'territories', id: 'AUS' } },
          manualPrices: { data: [{ type: 'inAppPurchasePrices', id: priceId }] },
        },
      },
      included: [{
        type: 'inAppPurchasePrices',
        id: priceId,
        attributes: { startDate: null },
        relationships: {
          inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
          inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: point.id } },
        },
      }],
    }),
  });
  console.log('Set lifetime access to AUD $9.99 with automatic regional pricing.');
}

async function waitForBuild(app) {
  const buildNumber = process.env.IOS_BUILD_NUMBER;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const buildQuery = {
      'filter[app]': app.id,
      include: 'preReleaseVersion',
      sort: '-uploadedDate',
      limit: 50,
    };
    if (buildNumber) buildQuery['filter[version]'] = buildNumber;
    const builds = await asc(`/v1/builds?${query(buildQuery)}`);
    const preRelease = new Map((builds.body.included || []).map((item) => [item.id, item]));
    const build = (builds.body.data || []).find((item) => {
      const preId = item.relationships?.preReleaseVersion?.data?.id;
      return preRelease.get(preId)?.attributes?.version === versionString;
    });
    if (build?.attributes?.processingState === 'VALID') return build;
    if (['FAILED', 'INVALID'].includes(build?.attributes?.processingState)) {
      throw new Error(`Apple rejected build ${buildNumber} during processing.`);
    }
    console.log(`Waiting for Apple to process build ${buildNumber || 'for version 1.0'} (${attempt + 1}/30).`);
    await sleep(60_000);
  }
  throw new Error('Timed out waiting for the uploaded build to finish processing.');
}

async function attachBuild(version, build) {
  if (!build) return;
  await asc(`/v1/builds/${build.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
    }),
  }, [409]);
  await asc(`/v1/appStoreVersions/${version.id}/relationships/build`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'builds', id: build.id } }),
  });
  console.log(`Attached processed build ${build.attributes?.version} to version ${versionString}.`);
}

async function submitForReview(app, version, iapVersion) {
  if (!/^(1|true|yes)$/i.test(process.env.SUBMIT_FOR_REVIEW || 'false')) return;
  const created = await asc('/v1/reviewSubmissions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    }),
  });
  const submissionId = created.body.data.id;
  for (const relationship of [
    { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } },
    { inAppPurchaseVersion: { data: { type: 'inAppPurchaseVersions', id: iapVersion.id } } },
  ]) {
    await asc('/v1/reviewSubmissionItems', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
            ...relationship,
          },
        },
      }),
    });
  }
  await asc(`/v1/reviewSubmissions/${submissionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'reviewSubmissions', id: submissionId, attributes: { submitted: true } },
    }),
  });
  console.log(`Submitted App Store version ${versionString} and the lifetime purchase for review.`);
}

const app = await getApp();
console.log(`Preparing ${app.attributes?.name || bundleId} (${app.id}).`);
await updateAppDeclaration(app);
const version = await getOrCreateVersion(app);
await updateVersion(version);
await configureAppInfo(app);
const localization = await getOrCreateVersionLocalization(version);
await configureScreenshots(localization);
await configureReviewDetails(version);
const territories = await getTerritories();
await ensureAppAvailability(app, territories);
await ensureFreeAppPrice(app);
const iap = await getOrCreateIap(app);
const iapVersion = await getOrCreateIapVersion(iap);
await configureIapLocalization(iapVersion);
await configureIapReviewImage(iap, iapVersion);
await ensureIapAvailability(iap, territories);
await ensureIapPrice(iap);
const build = await waitForBuild(app);
await attachBuild(version, build);
await submitForReview(app, version, iapVersion);
