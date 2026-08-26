import { withLambda } from '../modern-runtime/lambda-compat.mts';
import 'web-push';
import legacy from '../functions/send-meal-plan-ready.js';

export default withLambda(legacy.handler);
