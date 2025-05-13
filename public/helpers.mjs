export const LINKS_FILE = '_links.txt';

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
