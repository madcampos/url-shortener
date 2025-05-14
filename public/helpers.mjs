export const LINKS_FILE_PATH = '/_links.txt';

export const STATIC_FILE_PATHS = [
	LINKS_FILE_PATH,
	'/index.html',
	'/helpers.mjs',
	'/main.mjs',
	'/styles.css',
	'/favicon.ico'
];

export const VALIDATION_REGEX = /^[a-z0-9_\-]+$/igu;

/**
 * @param {string} id
 */
export function isValidId(id) {
	return VALIDATION_REGEX.test(id);
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
				const [
					linkId = '',
					url = '',
					updatedAt = new Date().toISOString(),
					comment = ''
				] = line.split('\t');

				if (!isValidId(linkId)) {
					return ['', { url: '', updatedAt: new Date(), comment: '' }];
				}

				// TODO: validate properties

				return [linkId.trim(), {
					url: url.trim(),
					updatedAt: new Date(updatedAt.trim()),
					comment: comment.trim()
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
