import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/notify-cohort-start.js';

export default withLambda(legacy.handler);
