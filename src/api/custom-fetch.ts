// example: https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/custom-fetch.ts

interface FetchResult {
	status: number;
	data: any;
	headers: Headers;
}

let baseUrl: string | undefined = undefined;

export const setBaseUrl = (url: string) => {
	baseUrl = url;
};

// NOTE: Update just base url
const getUrl = (contextUrl: string): string => {
	const url = new URL(contextUrl);
	const pathname = url.pathname;
	const search = url.search;

	const requestUrl = new URL(`${baseUrl}${pathname}${search}`);

	return requestUrl.toString();
};

export const customFetch = async <T extends FetchResult>(
	url: string,
	init?: RequestInit,
): Promise<T> => {
	const requestUrl = getUrl(url);

	const response = await fetch(requestUrl, init);

	return {
		status: response.status,
		data: await response.json(),
		headers: response.headers,
	} as T;
};
