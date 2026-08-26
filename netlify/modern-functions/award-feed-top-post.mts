import { withLambda } from '../modern-runtime/lambda-compat.mts';
import '@supabase/supabase-js';
import legacy from '../functions/award-feed-top-post.js';

export default withLambda(legacy.handler);
