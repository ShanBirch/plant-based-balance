import { withLambda } from '../modern-runtime/lambda-compat.mts';
import pbbWebPushDependency from '../modern-runtime/vendor/web-push.bundle.cjs';

let wrappedHandler;

export default async function handler(request, context) {
  if (!wrappedHandler) {
    globalThis.__PBB_WEB_PUSH_DEPENDENCY__ = pbbWebPushDependency;
    const legacy = await import('../functions/send-dm-notification.js');
    wrappedHandler = withLambda(legacy.default.handler);
  }
  return wrappedHandler(request, context);
}
