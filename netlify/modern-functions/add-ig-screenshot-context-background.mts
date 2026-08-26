import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/add-ig-screenshot-context-background.js';

export default withLambda(legacy.handler);
export const config = { background: true };
