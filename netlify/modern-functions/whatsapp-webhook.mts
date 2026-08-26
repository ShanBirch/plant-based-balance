import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/whatsapp-webhook.js';

export default withLambda(legacy.handler);
