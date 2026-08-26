import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/award-weekly-goal-rewards.js';

export default withLambda(legacy.handler);
