import { Capacitor } from '@capacitor/core';
import { Platform, ProductType, store } from 'capacitor-plugin-cdv-purchase';

const PRODUCT_ID = 'balance_teleprompter_lifetime';
const FALLBACK_PRICE = '$9.99 AUD';
const OWNERSHIP_KEY = 'balance-teleprompter-lifetime';

let configured = false;
let platform: Platform | undefined;
let initialisePromise: Promise<void> | undefined;
let purchaseWaiters: Array<(unlocked: boolean) => void> = [];

function rememberOwnership() {
  window.localStorage.setItem(OWNERSHIP_KEY, 'true');
  purchaseWaiters.forEach((resolve) => resolve(true));
  purchaseWaiters = [];
}

function isLifetimeOwned() {
  return store.owned(PRODUCT_ID) || window.localStorage.getItem(OWNERSHIP_KEY) === 'true';
}

function waitForOwnership(timeoutMs = 90_000) {
  if (isLifetimeOwned()) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const finish = (unlocked: boolean) => {
      window.clearTimeout(timeout);
      resolve(unlocked);
    };
    const timeout = window.setTimeout(() => {
      purchaseWaiters = purchaseWaiters.filter((waiter) => waiter !== finish);
      resolve(isLifetimeOwned());
    }, timeoutMs);
    purchaseWaiters.push(finish);
  });
}

function currentPrice() {
  return store.get(PRODUCT_ID, platform)?.pricing?.price || FALLBACK_PRICE;
}

export async function initialisePurchases() {
  if (!Capacitor.isNativePlatform()) {
    return { native: false, configured: false, unlocked: false, price: FALLBACK_PRICE };
  }

  if (!initialisePromise) {
    initialisePromise = (async () => {
      platform = Capacitor.getPlatform() === 'ios'
        ? Platform.APPLE_APPSTORE
        : Platform.GOOGLE_PLAY;

      store.register({
        id: PRODUCT_ID,
        type: ProductType.NON_CONSUMABLE,
        platform,
      });

      store.when()
        .receiptUpdated(() => {
          if (store.owned(PRODUCT_ID)) rememberOwnership();
        }, 'balance-lifetime-receipt')
        .approved(async (transaction) => {
          if (!transaction.products.some((product) => product.id === PRODUCT_ID)) return;
          rememberOwnership();
          await transaction.finish();
        }, 'balance-lifetime-approved')
        .receiptsReady(() => {
          if (store.owned(PRODUCT_ID)) rememberOwnership();
        }, 'balance-lifetime-ready');

      const errors = await store.initialize([platform]);
      configured = errors.length === 0;
    })();
  }

  await initialisePromise;
  return {
    native: true,
    configured,
    unlocked: isLifetimeOwned(),
    price: currentPrice(),
  };
}

export async function purchaseLifetimeAccess() {
  await initialisePurchases();
  if (!configured || !platform) throw new Error('Purchases are not available yet.');
  if (isLifetimeOwned()) return true;

  const offer = store.get(PRODUCT_ID, platform)?.getOffer();
  if (!offer) throw new Error('Lifetime access is not available from the store yet.');

  const result = await offer.order();
  if (result?.isError) throw new Error(result.message);
  return waitForOwnership();
}

export async function restoreLifetimeAccess() {
  await initialisePurchases();
  if (!configured) throw new Error('Purchases are not available yet.');

  const result = await store.restorePurchases();
  if (result?.isError) throw new Error(result.message);
  if (store.owned(PRODUCT_ID)) rememberOwnership();
  return isLifetimeOwned();
}
