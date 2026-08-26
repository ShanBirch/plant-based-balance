import { withLambda } from '../modern-runtime/lambda-compat.mts';
import * as pbbSupabaseDependency from '@supabase/supabase-js';
import legacy from '../functions/admin-reset-user-password.js';

export { pbbSupabaseDependency };
export default withLambda(legacy.handler);
