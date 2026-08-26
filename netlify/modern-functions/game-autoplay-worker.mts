import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/game-autoplay-worker.js';

export default withLambda(legacy.handler);
