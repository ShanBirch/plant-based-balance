import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/ig-story-outreach-candidate.js';

export default withLambda(legacy.handler);
