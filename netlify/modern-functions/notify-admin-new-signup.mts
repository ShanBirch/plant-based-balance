import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/notify-admin-new-signup.js';

export default withLambda(legacy.handler);
