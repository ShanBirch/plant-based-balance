import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/onboarding-progress.js';
export default withLambda(legacy.handler);
