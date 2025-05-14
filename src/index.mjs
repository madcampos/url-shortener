import { isValidId, LINKS_FILE_PATH, parseFile, STATIC_FILE_PATHS } from '../public/helpers.mjs';

const ASSETS_BASE_URL = 'https://assets.local/';
const LINKS_URL = new URL(LINKS_FILE_PATH, ASSETS_BASE_URL);

/**
 * @typedef Env
 * @prop {Fetcher} Assets
 */

/** @satisfies {ExportedHandler<Env>} */
export default {
	/**
	 * @param {Request} request
	 * @param {Env} env
	 */
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			return env.Assets.fetch(new URL('/index.html', ASSETS_BASE_URL));
		}

		if (STATIC_FILE_PATHS.includes(url.pathname)) {
			return env.Assets.fetch(request);
		}

		const id = url.pathname.replace('/', '');

		if (!isValidId(id)) {
			return new Response('Invalid ID', { status: 400 });
		}

		const linksResponse = await env.Assets.fetch(LINKS_URL);
		const linksBlob = await linksResponse.blob();
		const links = await parseFile(linksBlob);

		if (!links[id]) {
			return new Response('Invalid ID', { status: 400 });
		}

		return new Response(links[id].comment, {
			status: 308,
			headers: new Headers({
				'Location': links[id].url,
				'Last-Modified': links[id].updatedAt.toUTCString()
			})
		});
	}
};
