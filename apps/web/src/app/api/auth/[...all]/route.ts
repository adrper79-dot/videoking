export const runtime = "edge";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function proxyAuthRequest(request: Request, params: { all?: string[] }) {
	const path = params.all?.join("/") ?? "";
	const targetUrl = `${API_BASE_URL}/api/auth/${path}${new URL(request.url).search}`;

	const proxied = await fetch(targetUrl, {
		method: request.method,
		headers: request.headers,
		body:
			request.method === "GET" || request.method === "HEAD"
				? undefined
				: await request.text(),
		redirect: "manual",
	});

	return new Response(proxied.body, {
		status: proxied.status,
		statusText: proxied.statusText,
		headers: proxied.headers,
	});
}

export async function GET(
	request: Request,
	context: { params: Promise<{ all?: string[] }> },
) {
	return proxyAuthRequest(request, await context.params);
}

export async function POST(
	request: Request,
	context: { params: Promise<{ all?: string[] }> },
) {
	return proxyAuthRequest(request, await context.params);
}

export async function PATCH(
	request: Request,
	context: { params: Promise<{ all?: string[] }> },
) {
	return proxyAuthRequest(request, await context.params);
}

export async function PUT(
	request: Request,
	context: { params: Promise<{ all?: string[] }> },
) {
	return proxyAuthRequest(request, await context.params);
}

export async function DELETE(
	request: Request,
	context: { params: Promise<{ all?: string[] }> },
) {
	return proxyAuthRequest(request, await context.params);
}