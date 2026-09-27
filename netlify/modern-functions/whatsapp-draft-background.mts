import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/whatsapp-draft-background.js';

export default withLambda(legacy.handler);
export const config = { background: true };
