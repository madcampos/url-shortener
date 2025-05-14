export const LINKS_FILE_PATH = '/_links.txt';

export const STATIC_FILE_PATHS = [
	LINKS_FILE_PATH,
	'/index.html',
	'/helpers.mjs',
	'/main.mjs',
	'/styles.css',
	'/favicon.ico'
];

/**
 * @param {string} id
 */
export function isValidId(id) {
	return /^[a-z0-9_\-]+$/igu.test(id);
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
			.map((line) => {
				const [linkId = '', url = ''] = line.split('\t');

				return [linkId.trim(), url.trim()];
			})
	);

	return links;
}

export function loadLinks() {
	// TODO
}
