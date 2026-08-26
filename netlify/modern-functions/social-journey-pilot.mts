import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/social-journey-pilot.js';

export default withLambda(legacy.handler);
