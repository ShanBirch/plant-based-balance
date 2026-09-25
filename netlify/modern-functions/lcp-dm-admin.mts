import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/lcp-dm-admin.js';
export default withLambda(legacy.handler);
