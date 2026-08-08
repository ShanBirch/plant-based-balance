import jwt from 'jsonwebtoken';

const apiBase = 'https://api.appstoreconnect.apple.com/v1';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return /^(1|true|yes)$/i.test(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function params(values) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

function formatErrors(body) {
  if (!body || !Array.isArray(body.errors)) return '';
  return body.errors
    .map((error) => {
      const pieces = [error.status, error.code, error.title, error.detail].filter(Boolean);
      return pieces.join(' - ');
    })
    .join('\n');
}

const keyId = requiredEnv('APP_STORE_CONNECT_API_KEY_ID');
const issuerId = requiredEnv('APP_STORE_CONNECT_ISSUER_ID');
const privateKey = Buffer.from(requiredEnv('APP_STORE_CONNECT_API_KEY_BASE64'), 'base64').toString('utf8');
const bundleId = requiredEnv('IOS_BUNDLE_ID');
const versionString = requiredEnv('IOS_VERSION_STRING');
const buildNumber = process.env.IOS_BUILD_NUMBER || '';
const submitForReview = boolEnv('SUBMIT_FOR_REVIEW', false);
const releaseNotes = requiredEnv('IOS_RELEASE_NOTES');
const reviewNotes = process.env.IOS_REVIEW_NOTES || '';
const waitMinutes = Number(process.env.PROCESSING_WAIT_MINUTES || 35);

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  keyid: keyId,
  issuer: issuerId,
  audience: 'appstoreconnect-v1',
  expiresIn: '20m',
});

async function asc(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = formatErrors(body) || text || response.statusText;
    throw new Error(`App Store Connect API ${response.status} for ${path}\n${detail}`);
  }
  return body;
}

async function getApp() {
  const body = await asc(`/apps?${params({ 'filter[bundleId]': bundleId, limit: 1 })}`);
  const app = body.data?.[0];
  if (!app) throw new Error(`No App Store Connect app found for bundle ID ${bundleId}`);
  console.log(`Found app ${app.attributes?.name || app.id} (${app.id})`);
  return app;
}

function includedById(body, type) {
  const map = new Map();
  for (const item of body.included || []) {
    if (!type || item.type === type) map.set(item.id, item);
  }
  return map;
}

async function findBuild(appId) {
  const query = {
    'filter[app]': appId,
    include: 'preReleaseVersion',
    sort: '-uploadedDate',
    limit: 50,
  };
  if (buildNumber) query['filter[version]'] = buildNumber;

  const body = await asc(`/builds?${params(query)}`);
  const preReleaseVersions = includedById(body, 'preReleaseVersions');
  const build = (body.data || []).find((candidate) => {
    const candidateBuild = candidate.attributes?.version;
    const preReleaseId = candidate.relationships?.preReleaseVersion?.data?.id;
    const candidateVersion = preReleaseVersions.get(preReleaseId)?.attributes?.version;
    return (!buildNumber || String(candidateBuild) === String(buildNumber))
      && (!versionString || String(candidateVersion) === String(versionString));
  });
  return build || null;
}

async function waitForValidBuild(appId) {
  const deadline = Date.now() + waitMinutes * 60 * 1000;
  let lastState = 'not found';

  while (Date.now() <= deadline) {
    const build = await findBuild(appId);
    if (build) {
      lastState = build.attributes?.processingState || 'unknown';
      console.log(`Build ${build.attributes?.version} processing state: ${lastState}`);
      if (lastState === 'VALID') return build;
      if (lastState === 'FAILED' || lastState === 'INVALID') {
        throw new Error(`Build ${build.attributes?.version} processing failed with state ${lastState}`);
      }
    } else {
      console.log(`Build ${buildNumber || '(latest)'} for version ${versionString} not visible yet.`);
    }
    await sleep(60_000);
  }

  throw new Error(`Timed out waiting for build to become VALID. Last state: ${lastState}`);
}

async function setEncryptionCompliance(build) {
  try {
    await asc(`/builds/${build.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'builds',
          id: build.id,
          attributes: { usesNonExemptEncryption: false },
        },
      }),
    });
    console.log('Set build export compliance: usesNonExemptEncryption=false');
  } catch (error) {
    console.log(`Could not set build export compliance automatically: ${error.message}`);
  }
}

async function getOrCreateAppStoreVersion(app) {
  const query = params({
    'filter[platform]': 'IOS',
    'filter[versionString]': versionString,
    limit: 10,
  });
  const existing = await asc(`/apps/${app.id}/appStoreVersions?${query}`);
  if (existing.data?.length) {
    const version = existing.data[0];
    console.log(`Using existing App Store version ${versionString} (${version.id}), state ${version.attributes?.appStoreState}`);
    return version;
  }

  try {
    const created = await asc('/appStoreVersions', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersions',
          attributes: {
            platform: 'IOS',
            versionString,
          },
          relationships: {
            app: {
              data: { type: 'apps', id: app.id },
            },
          },
        },
      }),
    });
    console.log(`Created App Store version ${versionString} (${created.data.id})`);
    return created.data;
  } catch (error) {
    console.log(`Could not create App Store version ${versionString}. Inspecting existing iOS version states.`);
    try {
      const versions = await asc(`/apps/${app.id}/appStoreVersions?${params({
        'filter[platform]': 'IOS',
        limit: 50,
      })}`);
      for (const version of versions.data || []) {
        console.log(`Existing iOS version ${version.attributes?.versionString || version.id}: ${version.attributes?.appStoreState || 'UNKNOWN'}`);
      }
    } catch (inspectionError) {
      console.log(`Could not inspect existing iOS versions: ${inspectionError.message}`);
    }
    throw error;
  }
}

function isSubmittedOrPastSubmissionState(state) {
  return [
    'WAITING_FOR_REVIEW',
    'IN_REVIEW',
    'PENDING_DEVELOPER_RELEASE',
    'PENDING_APPLE_RELEASE',
    'PROCESSING_FOR_APP_STORE',
    'READY_FOR_SALE',
  ].includes(state);
}

async function getAppStoreVersionState(appStoreVersion) {
  const body = await asc(`/appStoreVersions/${appStoreVersion.id}?${params({
    'fields[appStoreVersions]': 'appStoreState,versionString',
  })}`);
  const state = body.data?.attributes?.appStoreState || 'UNKNOWN';
  console.log(`App Store version ${versionString} state: ${state}`);
  return state;
}

async function getExistingSubmission(appStoreVersion) {
  try {
    const body = await asc(`/appStoreVersions/${appStoreVersion.id}/appStoreVersionSubmission`);
    return body.data || null;
  } catch (error) {
    console.log(`Could not inspect existing App Store version submission: ${error.message}`);
    return null;
  }
}

async function attachBuild(appStoreVersion, build) {
  await asc(`/appStoreVersions/${appStoreVersion.id}/relationships/build`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'builds', id: build.id },
    }),
  });
  console.log(`Attached build ${build.attributes?.version} to App Store version ${versionString}`);
}

async function updateReleaseNotes(appStoreVersion, app) {
  const localizations = await asc(`/appStoreVersions/${appStoreVersion.id}/appStoreVersionLocalizations?${params({ limit: 10 })}`);
  const primaryLocale = app.attributes?.primaryLocale || 'en-AU';
  const localization = localizations.data?.[0];

  if (localization) {
    await asc(`/appStoreVersionLocalizations/${localization.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersionLocalizations',
          id: localization.id,
          attributes: { whatsNew: releaseNotes },
        },
      }),
    });
    console.log(`Updated release notes for ${localization.attributes?.locale || primaryLocale}`);
    return;
  }

  await asc('/appStoreVersionLocalizations', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: {
          locale: primaryLocale,
          whatsNew: releaseNotes,
        },
        relationships: {
          appStoreVersion: {
            data: { type: 'appStoreVersions', id: appStoreVersion.id },
          },
        },
      },
    }),
  });
  console.log(`Created release notes for ${primaryLocale}`);
}

async function updateReviewNotes(appStoreVersion) {
  if (!reviewNotes) return;
  try {
    const detail = await asc(`/appStoreVersions/${appStoreVersion.id}/appStoreReviewDetail`);
    if (!detail.data?.id) return;
    await asc(`/appStoreReviewDetails/${detail.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appStoreReviewDetails',
          id: detail.data.id,
          attributes: { notes: reviewNotes },
        },
      }),
    });
    console.log('Updated App Review notes.');
  } catch (error) {
    console.log(`Could not update App Review notes automatically: ${error.message}`);
  }
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

async function inspectSubmissionReadiness(appStoreVersion, app) {
  console.log('Inspecting App Store submission readiness.');

  const version = await asc(`/appStoreVersions/${appStoreVersion.id}?${params({
    include: 'build',
  })}`);
  const versionAttributes = version.data?.attributes || {};
  console.log(`Version metadata: ${JSON.stringify({
    appStoreState: versionAttributes.appStoreState || null,
    copyrightPresent: present(versionAttributes.copyright),
    releaseType: versionAttributes.releaseType || null,
    buildAttached: (version.included || []).some((item) => item.type === 'builds'),
  })}`);

  const localizations = await asc(`/appStoreVersions/${appStoreVersion.id}/appStoreVersionLocalizations?${params({ limit: 50 })}`);
  const versionLocales = [];
  for (const localization of localizations.data || []) {
    const attributes = localization.attributes || {};
    const screenshotSets = await asc(`/appStoreVersionLocalizations/${localization.id}/appScreenshotSets?${params({
      include: 'appScreenshots',
      limit: 50,
    })}`);
    const screenshots = (screenshotSets.included || []).filter((item) => item.type === 'appScreenshots');
    versionLocales.push(attributes.locale);
    console.log(`Version localization ${attributes.locale || localization.id}: ${JSON.stringify({
      descriptionPresent: present(attributes.description),
      keywordsPresent: present(attributes.keywords),
      supportUrlPresent: present(attributes.supportUrl),
      whatsNewPresent: present(attributes.whatsNew),
      screenshotSetCount: screenshotSets.data?.length || 0,
      screenshotCount: screenshots.length,
    })}`);
  }

  try {
    const reviewDetail = await asc(`/appStoreVersions/${appStoreVersion.id}/appStoreReviewDetail`);
    const attributes = reviewDetail.data?.attributes || {};
    console.log(`App Review details: ${JSON.stringify({
      exists: Boolean(reviewDetail.data?.id),
      contactFirstNamePresent: present(attributes.contactFirstName),
      contactLastNamePresent: present(attributes.contactLastName),
      contactPhonePresent: present(attributes.contactPhone),
      contactEmailPresent: present(attributes.contactEmail),
      demoAccountRequired: attributes.demoAccountRequired ?? null,
      demoAccountNamePresent: present(attributes.demoAccountName),
      demoAccountPasswordPresent: present(attributes.demoAccountPassword),
      notesPresent: present(attributes.notes),
    })}`);
  } catch (error) {
    console.log(`App Review details unavailable: ${error.message}`);
  }

  try {
    const appInfos = await asc(`/apps/${app.id}/appInfos?${params({
      include: 'appInfoLocalizations',
      limit: 50,
    })}`);
    const appInfoLocales = [...new Set((appInfos.included || [])
      .filter((item) => item.type === 'appInfoLocalizations')
      .map((item) => item.attributes?.locale)
      .filter(Boolean))];
    console.log(`Localization parity: ${JSON.stringify({
      versionLocales,
      appInfoLocales,
      missingFromVersion: appInfoLocales.filter((locale) => !versionLocales.includes(locale)),
      missingFromAppInfo: versionLocales.filter((locale) => !appInfoLocales.includes(locale)),
    })}`);
  } catch (error) {
    console.log(`Could not inspect App Info localization parity: ${error.message}`);
  }
}

async function submit(appStoreVersion, app) {
  if (!submitForReview) {
    console.log('SUBMIT_FOR_REVIEW=false, stopping before App Review submission.');
    return;
  }

  const beforeState = await getAppStoreVersionState(appStoreVersion);
  if (isSubmittedOrPastSubmissionState(beforeState)) {
    console.log(`App Store version ${versionString} is already submitted or past submission (${beforeState}).`);
    return;
  }

  const reviewSubmission = await asc('/reviewSubmissions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissions',
        attributes: {
          platform: 'IOS',
        },
        relationships: {
          app: {
            data: { type: 'apps', id: app.id },
          },
        },
      },
    }),
  });
  console.log(`Created review submission ${reviewSubmission.data.id}.`);

  const reviewItem = await asc('/reviewSubmissionItems', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: {
            data: { type: 'reviewSubmissions', id: reviewSubmission.data.id },
          },
          appStoreVersion: {
            data: { type: 'appStoreVersions', id: appStoreVersion.id },
          },
        },
      },
    }),
  });
  console.log(`Added App Store version ${versionString} to review submission (${reviewItem.data.id}).`);

  const submitted = await asc(`/reviewSubmissions/${reviewSubmission.data.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissions',
        id: reviewSubmission.data.id,
        attributes: {
          submitted: true,
        },
      },
    }),
  });

  const state = submitted.data?.attributes?.state || 'UNKNOWN';
  console.log(`Submitted review submission ${reviewSubmission.data.id}; state ${state}.`);
}

async function stopIfAlreadySubmitted(appStoreVersion) {
  const state = await getAppStoreVersionState(appStoreVersion);
  if (isSubmittedOrPastSubmissionState(state)) {
    console.log(`App Store version ${versionString} is already submitted or past submission (${state}); no metadata changes needed.`);
    return true;
  }
  return false;
}

const app = await getApp();
const build = await waitForValidBuild(app.id);
await setEncryptionCompliance(build);
const appStoreVersion = await getOrCreateAppStoreVersion(app);
if (!(await stopIfAlreadySubmitted(appStoreVersion))) {
  await attachBuild(appStoreVersion, build);
  await updateReleaseNotes(appStoreVersion, app);
  await updateReviewNotes(appStoreVersion);
  await inspectSubmissionReadiness(appStoreVersion, app);
  await submit(appStoreVersion, app);
}
