const textContentTypes = new Set([
  'application/csp-report',
  'application/graphql',
  'application/json',
  'application/javascript',
  'application/x-www-form-urlencoded',
  'application/x-ndjson',
  'application/xml',
]);

function shouldBase64Encode(contentType: string | null) {
  if (!contentType) return true;
  const normalized = contentType.split(';')[0].toLowerCase();
  return !(
    normalized.startsWith('text/') ||
    normalized.endsWith('+json') ||
    normalized.endsWith('+xml') ||
    textContentTypes.has(normalized)
  );
}

async function buildEventFromRequest(request: Request) {
  const url = new URL(request.url);
  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};
  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
    multiValueQueryStringParameters[key] = [...(multiValueQueryStringParameters[key] || []), value];
  });

  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
    multiValueHeaders[key] = value.split(',').map((part) => part.trim());
  });

  let body: string | null = null;
  let isBase64Encoded = false;
  if (request.body) {
    if (shouldBase64Encode(request.headers.get('content-type'))) {
      const bytes = new Uint8Array(await request.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      body = btoa(binary);
      isBase64Encoded = true;
    } else {
      body = await request.text();
    }
  }

  return {
    rawUrl: url.toString(),
    rawQuery: url.search.replace(/^\?/, ''),
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders,
    queryStringParameters: Object.keys(queryStringParameters).length ? queryStringParameters : null,
    multiValueQueryStringParameters: Object.keys(multiValueQueryStringParameters).length ? multiValueQueryStringParameters : null,
    body,
    isBase64Encoded,
  };
}

function buildLambdaContext(context: { requestId?: string }) {
  const unsupported = (name: string) => () => {
    throw new Error(`context.${name}() is not supported in Netlify Functions`);
  };
  return {
    awsRequestId: context.requestId || '',
    callbackWaitsForEmptyEventLoop: true,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: () => 0,
    done: unsupported('done'),
    fail: unsupported('fail'),
    succeed: unsupported('succeed'),
  };
}

function buildResponseFromResult(result: any) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers || {})) {
    headers.set(name.toLowerCase(), String(value));
  }
  for (const [name, values] of Object.entries(result.multiValueHeaders || {})) {
    for (const value of values as any[]) headers.append(name.toLowerCase(), String(value));
  }

  let body: BodyInit | null = null;
  if (result.body != null) {
    if (result.isBase64Encoded) {
      const binary = atob(result.body);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      body = bytes;
    } else {
      body = result.body;
    }
  }
  return new Response(body, { status: result.statusCode, headers });
}

export function withLambda(handler: (event: any, context: any) => Promise<any> | any) {
  return async (request: Request, context: any) => {
    const result = await handler(await buildEventFromRequest(request), buildLambdaContext(context));
    return buildResponseFromResult(result);
  };
}
