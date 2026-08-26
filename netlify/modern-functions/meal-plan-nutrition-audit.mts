import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meal-plan-nutrition-audit.js';

export default withLambda(legacy.handler);
