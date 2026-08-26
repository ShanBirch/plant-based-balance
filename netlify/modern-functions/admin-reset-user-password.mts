import { withLambda } from '@netlify/aws-lambda-compat';
import '@supabase/supabase-js';
import legacy from '../functions/admin-reset-user-password.js';

export default withLambda(legacy.handler);
