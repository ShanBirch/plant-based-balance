import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/sync-fitbit-data.js';

export default withLambda(legacy.handler);
