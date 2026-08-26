import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/form-check-draft-background.js';

export default withLambda(legacy.handler);
export const config = { background: true };
