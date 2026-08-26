import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/sync-wearable-data.js';

export default withLambda(legacy.handler);
