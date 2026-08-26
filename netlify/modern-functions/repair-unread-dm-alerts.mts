import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/repair-unread-dm-alerts.js';

export default withLambda(legacy.handler);
