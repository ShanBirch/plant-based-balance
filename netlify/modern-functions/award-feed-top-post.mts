import { withLambda } from '../modern-runtime/lambda-compat.mts';
import * as pbbSupabaseDependency from '@supabase/supabase-js';
import legacy from '../functions/award-feed-top-post.js';

export { pbbSupabaseDependency };
export default withLambda(legacy.handler);
