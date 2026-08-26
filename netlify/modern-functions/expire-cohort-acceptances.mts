import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/expire-cohort-acceptances.js';

export default withLambda(legacy.handler);
