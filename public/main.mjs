import { loadLinks, parseFile, sortLinks, VALIDATION_REGEX } from './helpers.mjs';
import { get, set } from './idb.mjs';

/** @type {import('./helpers.mjs').Links} */
let links;

/**
 * @param {TemplateStringsArray} strings
 * @param {string[]} params
 */
function raw(strings, ...params) {
	return strings.map((string, index) => `${string}${params[index] ?? ''}`).join('');
}

/**
 * @param {string} id
 * @param {import('./helpers.mjs').Link} link
 */
async function addRowToFile(id, link) {
	const linksFileHandler = /** @type {FileSystemFileHandle} */ (await get('links-file-handler'));

	if (!linksFileHandler) {
		return;
	}

	try {
		const file = await linksFileHandler.getFile();
		const links = await parseFile(file);

		links[id] = link;

		const writableStream = await linksFileHandler.createWritable();
		const text = Object.entries(sortLinks(links))
			.map(([id, { url, updatedAt, comment }]) => `${id}\t${url}\t${updatedAt.toISOString()}\t${comment}`)
			.join('\n');

		await writableStream.truncate(0);
		await writableStream.write(text);
		await writableStream.close();
	} catch (err) {
		console.error(err);
	}
}

/**
 * @param {string} id
 */
async function removeRowFromFile(id) {
	const linksFileHandler = /** @type {FileSystemFileHandle} */ (await get('links-file-handler'));

	if (!linksFileHandler) {
		return;
	}

	try {
		const file = await linksFileHandler.getFile();
		const links = await parseFile(file);

		const writableStream = await linksFileHandler.createWritable();
		const text = Object.entries(sortLinks(links))
			.filter(([linkId]) => linkId !== id)
			.map(([id, { url, updatedAt, comment }]) => `${id}\t${url}\t${updatedAt.toISOString()}\t${comment}`)
			.join('\n');

		await writableStream.truncate(0);
		await writableStream.write(text);
		await writableStream.close();
	} catch (err) {
		console.error(err);
	}
}

/**
 * @param {HTMLTableSectionElement} table
 * @param {string} id
 * @param {import('./helpers.mjs').Link} link
 */
function addLinkToTable(table, id, { url, comment, updatedAt }) {
	const NUM_COLORS = 18;
	const formatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

	table.querySelector('tr:has(td[colspan])')?.remove();

	table.insertAdjacentHTML(
		'beforeend',
		raw`
			<tr class="color-${(table.rows.length % NUM_COLORS).toString()}">
				<td>
					<span class="cell-display">
						<samp>${id}</samp>
						<button type="button" class="copy-id-button">
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-copy"/></svg>
						</button>
					</span>
					<span class="cell-edit">
						<!-- TODO: add label -->
						<input type="text" value="${id}" pattern="${VALIDATION_REGEX.source}" />
					</span>
				</td>
				<td>
					<span class="cell-display">
						<a href="${url}" rel="nofollow noopener noreferrer" referrerpolicy="no-referrer">${url}</a>
						&nbsp;
						<a href="${url}" rel="nofollow noopener noreferrer" referrerpolicy="no-referrer" target="_blank">
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-external"/></svg>
						</a>
					</span>
					<span class="cell-edit">
						<input type="url" value="${url}" />
					</span>
				</td>
				<td>
					<span class="cell-display">
						<time datetime="${updatedAt.toISOString()}">${formatter.format(updatedAt)}</time>
					</span>
					<span class="cell-edit">
						<input type="datetime-local" value="${updatedAt.toISOString()}" />
					</span>
				</td>
				<td>
					<span class="cell-display">
						<p>${comment}</p>
					</span>
					<span class="cell-edit">
						<textarea rows="8" cols="5">${comment}</textarea>
					</span>
				</td>
				<td>
					<span class="cell-display">
						<button type="button" aria-label="Edit row">
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-edit"/></svg>
						</button>
					</span>
					<span class="cell-edit">
						<button type="button" aria-label="Save edit">
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-check"/></svg>
						</button>
					</span>
				</td>
				<td>
					<span class="cell-display">
						<button type="button" class="delete-row-button" aria-label="Delete row" data-id="${id}">
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-delete"/></svg>
						</button>
					</span>
				</td>
			</tr>
		`
	);
}

/**
 * @param {HTMLTableSectionElement} table
 * @param {string} id
 */
function removeLinkFromTable(table, id) {
	table.querySelector(`tr[data-id="${id}"]`)?.remove();

	if (table.rows.length === 0) {
		table?.insertAdjacentHTML(
			'beforeend',
			raw`
				<tr>
					<td colspan="6"><p>No links available</p></td>
				</tr>
			`
		);
	}
}

/**
 * @param {import('./helpers.mjs').Links} links
 */
function populateTable(links) {
	const table = /** @type {HTMLTableSectionElement} */ (document.querySelector('table tbody'));
	const linkEntries = Object.entries(links);

	if (linkEntries.length === 0) {
		table?.querySelector('tr:has(td[colspan])')?.remove();
		table?.insertAdjacentHTML(
			'beforeend',
			raw`
				<tr>
					<td colspan="6"><p>No links available</p></td>
				</tr>
			`
		);
	} else {
		linkEntries.forEach(([id, link]) => {
			addLinkToTable(table, id, link);
		});
	}
}

/**
 * @param {HTMLButtonElement} button
 */
function sortTable(button) {
	const table = /** @type {HTMLTableElement} */ (button.closest('table'));
	const tbody = /** @type {HTMLTableSectionElement} */ (table.querySelector('tbody'));
	const th = /** @type {HTMLTableCellElement} */ (button.closest('th'));

	const column = th.cellIndex;
	const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true, caseFirst: 'upper' });

	let order;

	if (button.querySelector('use[href="#icon-sorting-descending"]')) {
		order = 'ascending';
	} else {
		order = 'descending';
	}

	table.querySelectorAll('th').forEach((header) => {
		header.querySelector('use')?.setAttribute('href', '#icon-sorting');
		header.querySelector('button')?.setAttribute('aria-pressed', 'false');
		th.ariaSort = 'none';
	});

	button.querySelector('use')?.setAttribute('href', `#icon-sorting-${order}`);
	button.ariaPressed = 'true';
	th.ariaSort = order;

	[...tbody.querySelectorAll('tr')].sort((rowA, rowB) => {
		const columnA = rowA.children[column]?.textContent ?? '';
		const columnB = rowB.children[column]?.textContent ?? '';

		if (order === 'ascending') {
			return collator.compare(columnA, columnB);
		}

		return collator.compare(columnB, columnA);
	}).forEach((row) => tbody.appendChild(row));
}

document.addEventListener('DOMContentLoaded', async () => {
	if ('showOpenFilePicker' in window) {
		document.querySelector('#local-file')?.removeAttribute('hidden');
	}

	document.querySelector('#id-input')?.setAttribute('pattern', VALIDATION_REGEX.source);

	links = await loadLinks();

	populateTable(links);
});

// Table sort
document.querySelector('table thead')?.addEventListener('click', (evt) => {
	const target = /** @type {HTMLButtonElement}*/ (evt.target);

	if (!target.matches('button')) {
		return;
	}

	sortTable(target);
});

// Generate new random id
document.querySelector('#generate-id-button')?.addEventListener('click', () => {
	const MAX_ITERATIONS = 100;
	const idInput = /** @type {HTMLInputElement}*/ (document.querySelector('#id-input'));

	let validId = '';
	let i = 0;

	do {
		validId = Math.trunc(Math.random() * 1000000).toString(16);
		i++;
	} while (Object.keys(links).includes(validId) && (i < MAX_ITERATIONS));

	idInput.value = validId;
});

// Add link form
document.querySelector('#add-link-form')?.addEventListener('submit', async (evt) => {
	evt.preventDefault();

	const target = /** @type {HTMLFormElement} */ (evt.target);

	(/** @type {HTMLButtonElement} */ (target.querySelector('button'))).disabled = true;

	const formData = new FormData(target);
	const id = /** @type {string} */ (formData.get('id'));
	/** @type {import('./helpers.mjs').Link} */
	const data = {
		url: /** @type {string} */ (formData.get('url')),
		updatedAt: new Date(),
		comment: /** @type {string} */ (formData.get('comment') ?? '')
	};

	await addRowToFile(id, data);
	addLinkToTable(/** @type {HTMLTableSectionElement} */ (document.querySelector('table tbody')), id, data);

	target.reset();
	(/** @type {HTMLButtonElement} */ (target.querySelector('button'))).disabled = false;
});

// Delete row button
document.querySelector('table tbody')?.addEventListener('click', async (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);

	if (!target.matches('button.delete-row-button')) {
		return;
	}

	await removeRowFromFile(target.dataset['id'] ?? '');
	removeLinkFromTable(/** @type {HTMLTableSectionElement} */ (target.closest('tbody')), target.dataset['id'] ?? '');
});

// Copy id button
document.querySelector('table tbody')?.addEventListener('click', async (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);

	if (!target.matches('button.copy-id-button')) {
		return;
	}

	// TODO: copy id to clipboard
});

// TODO: Table edit button
// TODO: Table save button
// TODO: Copy id button
// TODO: Share short url button
// TODO: Load local file
// TODO: Drag & Drop
// TODO: Paste text
// TODO: Paste file
