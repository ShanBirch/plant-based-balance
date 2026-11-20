export const config = { path: "/dashboard.html" };

export default async function handler(request, context) {
    if (request.method !== "GET") return;
    const response = await context.next();
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
    const html = await response.text();
    const headers = new Headers(response.headers);
    for (const name of ["content-length", "content-encoding", "etag", "last-modified"]) headers.delete(name);
    return new Response(html.replace("</body>", '<script defer src="/js/dashboard/coaching-continuation.js?v=1"></script></body>'), {
        status: response.status,
        headers,
    });
}