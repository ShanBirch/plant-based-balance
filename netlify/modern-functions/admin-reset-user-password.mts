import { withLambda } from '../modern-runtime/lambda-compat.mts';
import '@supabase/supabase-js';
import legacy from '../functions/admin-reset-user-password.js';

export default withLambda(legacy.handler);
