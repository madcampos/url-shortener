/**
 * @typedef {{ url: string, updatedAt: Date, comment: string}} Link
 * @typedef {Record<string, Link>} Links
 */

export const LINKS_FILE_PATH = '/_links.txt';
export const BASE_URL = 'https://madc.ca/';

export const STATIC_FILE_PATHS = [
	LINKS_FILE_PATH,
	'/index.html',
	'/helpers.mjs',
	'/idb.mjs',
	'/main.mjs',
	'/styles.css',
	'/favicon.ico'
];

export const VALIDATION_REGEX = /^[a-z0-9_\-]+$/igu;

/**
 * @param {string} id
 */
export function isValidId(id) {
	return new RegExp(VALIDATION_REGEX).test(id);
}

/**
 * @param {Links} links
 */
export function sortLinks(links) {
	const sorter = Intl.Collator('en-US', { numeric: true, usage: 'sort' });

	return Object.fromEntries(Object.entries(links).sort(([a], [b]) => sorter.compare(a, b)));
}

/**
 * @param {Blob} file
 */
export async function parseFile(file) {
	const linksText = await file.text();
	const links = Object.fromEntries(
		linksText
			.trim()
			.split('\n')
			.filter((line) => Boolean(line))
			.filter((line) => !line.startsWith('#'))
			.map((line) => {
				const parts = line.split('\t');

				const id = (parts[0] ?? '').trim();
				const url = (parts[1] ?? '').trim();
				const comment = (parts[3] ?? '').trim();
				let updatedAt = new Date((parts[2] ?? '').trim());

				if (!isValidId(id) || !URL.canParse(url)) {
					return ['', { url: '', updatedAt: new Date(), comment: '' }];
				}

				if (Number.isNaN(updatedAt)) {
					updatedAt = new Date();
				}

				/** @type {Links} */
				return [id, {
					url,
					updatedAt,
					comment
				}];
			})
	);

	return links;
}

export async function loadLinks() {
	const response = await fetch(LINKS_FILE_PATH);
	const file = await response.blob();
	const links = await parseFile(file);

	return links;
}
