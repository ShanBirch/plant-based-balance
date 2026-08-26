import { withLambda } from '@netlify/aws-lambda-compat';
import '@supabase/supabase-js';
import legacy from '../functions/award-feed-top-post.js';

export default withLambda(legacy.handler);
