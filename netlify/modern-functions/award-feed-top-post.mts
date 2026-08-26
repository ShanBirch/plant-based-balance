import { withLambda } from '../modern-runtime/lambda-compat.mts';
import pbbSupabaseDependency from '../modern-runtime/vendor/supabase.bundle.mjs';

let wrappedHandler;

export default async function handler(request, context) {
  if (!wrappedHandler) {
    globalThis.__PBB_SUPABASE_DEPENDENCY__ = pbbSupabaseDependency;
    const legacy = await import('../functions/award-feed-top-post.js');
    wrappedHandler = withLambda(legacy.default.handler);
  }
  return wrappedHandler(request, context);
}
