import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/submit-weekly-checkin.js';

export default withLambda(legacy.handler);
