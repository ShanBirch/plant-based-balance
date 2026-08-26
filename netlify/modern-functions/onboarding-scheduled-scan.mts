import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/onboarding-scheduled-scan.js';

export default withLambda(legacy.handler);
