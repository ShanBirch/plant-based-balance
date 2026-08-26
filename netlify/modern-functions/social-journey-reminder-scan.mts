import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/social-journey-reminder-scan.js';

export default withLambda(legacy.handler);
