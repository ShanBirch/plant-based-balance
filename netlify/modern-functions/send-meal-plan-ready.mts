import { withLambda } from '../modern-runtime/lambda-compat.mts';
import * as pbbWebPushDependency from 'web-push';
import legacy from '../functions/send-meal-plan-ready.js';

export { pbbWebPushDependency };
export default withLambda(legacy.handler);
