import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/send-whatsapp-reply.js';

export default withLambda(legacy.handler);
