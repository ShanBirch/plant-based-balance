import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/game-autoplay-worker.js';

export default withLambda(legacy.handler);
