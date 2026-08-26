import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/onboarding-welcome-draft.js';

export default withLambda(legacy.handler);
