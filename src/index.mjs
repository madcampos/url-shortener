import { isValidId, LINKS_FILE, parseFile } from '../public/helpers.mjs';

const ASSETS_BASE_URL = 'https://assets.local/';
const LINKS_URL = `${ASSETS_BASE_URL}${LINKS_FILE}`;

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

		// It is a file, has an extension.
		if (url.pathname.includes('.')) {
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

		return new Response(null, {
			status: 308,
			headers: new Headers({
				Location: links[id]
			})
		});
	}
};
