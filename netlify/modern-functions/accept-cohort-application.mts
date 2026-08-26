import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/accept-cohort-application.js';

export default withLambda(legacy.handler);
