import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meta-ig-sync-content.js';

export default withLambda(legacy.handler);
