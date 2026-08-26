import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/tahlia-feed-approvals.js';

export default withLambda(legacy.handler);
