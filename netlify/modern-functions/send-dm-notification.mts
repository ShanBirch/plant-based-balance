import { withLambda } from '../modern-runtime/lambda-compat.mts';
import * as pbbWebPushDependency from 'web-push';
import legacy from '../functions/send-dm-notification.js';

export { pbbWebPushDependency };
export default withLambda(legacy.handler);
