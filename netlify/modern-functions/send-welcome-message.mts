import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/send-welcome-message.js';

export default withLambda(legacy.handler);
