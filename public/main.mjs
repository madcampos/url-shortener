import { BASE_URL, isValidId, loadLinks, parseFile, sortLinks, VALIDATION_REGEX } from './helpers.mjs';
import { get, set } from './idb.mjs';

const table = /** @type {HTMLTableSectionElement} */ (document.querySelector('table tbody'));
const localFileForm = /** @type {HTMLFormElement} */ (document.querySelector('#local-file-form'));

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
 * @param {string} id
 */
function removeLinkFromTable(id) {
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
 * @param {string} id
 */
function generateIdCellContent(id) {
	return raw`
		<span class="cell-display">
			<samp>${id}</samp>
			<button type="button" class="copy-id-button" aria-label="Copy URL for id: ${id}">
				<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-copy"/></svg>
			</button>
			<button type="button" class="share-id-button" aria-label="Share URL for id: ${id}">
				<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-share"/></svg>
			</button>
		</span>
		<span class="cell-edit">
			<label for="id-input-${id}">ID</label>
			<input
				type="text"
				value="${id}"
				required
				autocomplete="off"
				autocapitalize="off"
				form="row-form-${id}"
				pattern="${VALIDATION_REGEX.source}"
				id="id-input-${id}"
				name="id"
				readonly
			/>
		</span>
	`;
}

/**
 * @param {string} id
 * @param {string} url
 */
function generateUrlCellContent(id, url) {
	return raw`
		<span class="cell-display">
			<a href="${url}" rel="nofollow noopener noreferrer" referrerpolicy="no-referrer">${url}</a>
			&nbsp;
			<a href="${url}" rel="nofollow noopener noreferrer" referrerpolicy="no-referrer" target="_blank">
				<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-external"/></svg>
			</a>
		</span>
		<span class="cell-edit">
			<label for="url-input-${id}">URL</label>
			<input
				type="url"
				value="${url}"
				id="url-input-${id}"
				name="url"
				form="row-form-${id}"
				required
				autocomplete="off"
			/>
		</span>
	`;
}

/**
 * @param {string} id
 * @param {Date} updatedAt
 */
function generateUpdatedAtCellContent(id, updatedAt) {
	const formatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

	return raw`
		<span class="cell-display">
			<time datetime="${updatedAt.toISOString().replace('Z', '')}">${formatter.format(updatedAt)}</time>
		</span>
		<span class="cell-edit">
			<label for="updated-at-input-${id}">Link Last Updated</label>
			<input
				type="datetime-local"
				value="${updatedAt.toISOString().replace('Z', '')}"
				id="updated-at-input-${id}"
				name="updatedAt"
				form="row-form-${id}"
				required
				autocomplete="off"
				min="${updatedAt.toISOString().replace('Z', '')}"
			/>
		</span>
	`;
}

/**
 * @param {string} id
 * @param {string} comment
 */
function generateCommentCellContent(id, comment) {
	return raw`
		<span class="cell-display">
			<p>${comment}</p>
		</span>
		<span class="cell-edit">
			<label for="comment-input-${id}">Comment</label>
			<textarea
				cols="15"
				rows="3"
				id="comment-input-${id}"
				name="comment"
				form="row-form-${id}"
				autocomplete="off"
			>${comment}</textarea>
		</span>
	`;
}

/**
 * @param {string} id
 * @param {import('./helpers.mjs').Link} link
 */
function addLinkToTable(id, { url, comment, updatedAt }) {
	const NUM_COLORS = 18;

	const existingTimeStamp = new Date(/** @type {HTMLTimeElement | null} */ (table.querySelector(`td[data-id="${id}"] time`))?.dateTime ?? '0000-00-00T00:00:00Z');

	if (existingTimeStamp > updatedAt) {
		return;
	}

	const existingColor = /** @type {HTMLTableRowElement | null} */ (table.querySelector(`tr[data-id="${id}"]`))?.dataset?.['color'];

	removeLinkFromTable(id);
	table.querySelector('tr:has(td[colspan])')?.remove();

	table.insertAdjacentHTML(
		'beforeend',
		raw`
			<tr data-color="${(existingColor ?? table.rows.length % NUM_COLORS).toString()}" data-id="${id}">
				<td>
					${generateIdCellContent(id)}
				</td>
				<td>
					${generateUrlCellContent(id, url)}
				</td>
				<td>
					${generateUpdatedAtCellContent(id, updatedAt)}
				</td>
				<td>
					${generateCommentCellContent(id, comment)}
				</td>
				<td>
					<span class="cell-display">
						<button
							type="button"
							class="edit-row-button"
							aria-label="Edit row"
						>
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-edit"/></svg>
						</button>
					</span>
					<span class="cell-edit">
						<form action="" method="get" id="row-form-${id}"></form>

						<button
							type="submit"
							form="row-form-${id}"
							class="save-row-button"
							aria-label="Save changes to row"
						>
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-check"/></svg>
						</button>
					</span>
				</td>
				<td>
					<span class="cell-display">
						<button
							type="button"
							class="delete-row-button"
							aria-label="Delete row"
						>
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-delete"/></svg>
						</button>
					</span>
					<span class="cell-edit">
						<button
							type="reset"
							form="row-form-${id}"
							class="reset-row-button"
							aria-label="Reset changes to row"
						>
							<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-x"/></svg>
						</button>
					</span>
				</td>
			</tr>
		`
	);
}

/**
 * @param {import('./helpers.mjs').Links} links
 */
function populateTable(links) {
	const linkEntries = Object.entries(links);

	if (linkEntries.length === 0) {
		table?.querySelector('tr:has(td[colspan])')?.remove();

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
	} else {
		linkEntries.forEach(([id, link]) => {
			addLinkToTable(id, link);
		});
	}
}

/**
 * @param {HTMLButtonElement} button
 */
function sortTable(button) {
	const tableHeader = /** @type {HTMLTableElement} */ (button.closest('table thead'));
	const th = /** @type {HTMLTableCellElement} */ (button.closest('th'));

	const column = th.cellIndex;
	const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true, caseFirst: 'upper' });

	let order;

	if (button.querySelector('use[href="#icon-sorting-descending"]')) {
		order = 'ascending';
	} else {
		order = 'descending';
	}

	tableHeader.querySelectorAll('th').forEach((header) => {
		header.querySelector('use')?.setAttribute('href', '#icon-sorting');
		header.querySelector('button')?.setAttribute('aria-pressed', 'false');
		th.ariaSort = 'none';
	});

	button.querySelector('use')?.setAttribute('href', `#icon-sorting-${order}`);
	button.ariaPressed = 'true';
	th.ariaSort = order;

	[...table.querySelectorAll('tr')].sort((rowA, rowB) => {
		const columnA = rowA.children[column]?.textContent ?? '';
		const columnB = rowB.children[column]?.textContent ?? '';

		if (order === 'ascending') {
			return collator.compare(columnA, columnB);
		}

		return collator.compare(columnB, columnA);
	}).forEach((row) => table.appendChild(row));
}

document.addEventListener('DOMContentLoaded', async () => {
	if ('showOpenFilePicker' in window) {
		document.querySelector('#local-file')?.removeAttribute('hidden');
	}

	document.querySelector('#id-input')?.setAttribute('pattern', VALIDATION_REGEX.source);

	try {
		const savedFile = /** @type {FileSystemFileHandle} */ (await get('links-file-handler'));

		if (savedFile) {
			const permission = await savedFile.queryPermission({ mode: 'readwrite' });

			if (permission === 'granted') {
				const file = await savedFile.getFile();

				if (file) {
					const links = await parseFile(file);

					populateTable(links);

					document.querySelector('#saved-file-input')?.setAttribute('value', savedFile.name);
					document.querySelector('#saved-file-wrapper')?.removeAttribute('hidden');
				}
			}
		}
	} catch (err) {
		console.error(err);
	}

	try {
		const links = await loadLinks();

		populateTable(links);
	} catch (err) {
		console.error(err);
	}
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
	const ids = [...(/** @type {NodeListOf<HTMLTableRowElement>} */ (document.querySelectorAll('table tbody td[data-id]')))].map((el) => el.dataset['id'] ?? '');

	let validId = '';
	let i = 0;

	do {
		validId = Math.trunc(Math.random() * 1000000).toString(16);
		i++;
	} while (ids.includes(validId) && (i < MAX_ITERATIONS));

	idInput.value = validId;
});

// Add link form
document.querySelector('#add-link-form')?.addEventListener('submit', async (evt) => {
	evt.preventDefault();

	const target = /** @type {HTMLFormElement} */ (evt.target);

	(/** @type {HTMLButtonElement} */ (target.querySelector('button'))).disabled = true;

	const formData = new FormData(target);
	const id = /** @type {string} */ (formData.get('id'));

	if (!isValidId(id)) {
		(/** @type {HTMLInputElement} */ (target.querySelector('#id-input'))).setCustomValidity('Invalid ID');
	}

	/** @type {import('./helpers.mjs').Link} */
	const data = {
		url: /** @type {string} */ (formData.get('url')),
		updatedAt: new Date(),
		comment: /** @type {string} */ (formData.get('comment') ?? '')
	};

	await addRowToFile(id, data);
	addLinkToTable(id, data);

	target.reset();
	(/** @type {HTMLButtonElement} */ (target.querySelector('button'))).disabled = false;
});

// Delete row button
table.addEventListener('click', async (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);

	if (!target.matches('button.delete-row-button')) {
		return;
	}

	const id = target.closest('tr')?.dataset['id'] ?? '';

	await removeRowFromFile(id);
	removeLinkFromTable(id);
});

// Copy id button
table.addEventListener('click', async (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);

	if (!target.matches('button.copy-id-button')) {
		return;
	}

	const id = target.closest('tr')?.dataset['id'] ?? '';

	navigator.clipboard.writeText(new URL(`/${id}`, BASE_URL).toString());
});

// Share URL button
table.addEventListener('click', async (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);

	if (!target.matches('button.share-id-button')) {
		return;
	}

	const id = target.closest('tr')?.dataset['id'] ?? '';

	navigator.share({
		title: 'Check this link',
		url: new URL(`/${id}`, BASE_URL).toString()
	});
});

// Load local file
localFileForm.addEventListener('submit', async (evt) => {
	evt.preventDefault();

	try {
		const [handle] = await window.showOpenFilePicker({
			id: 'links-file',
			multiple: false,
			startIn: 'downloads',
			excludeAcceptAllOption: true,
			types: [{
				description: 'Text Files',
				accept: { 'text/plain': '.txt' }
			}]
		});

		const permission = await handle.requestPermission({ mode: 'readwrite' });

		if (permission === 'granted') {
			const file = await handle.getFile();

			if (file) {
				const links = await parseFile(file);

				await set('links-file-handler', handle);
				populateTable(links);
			}
		}
	} catch (err) {
		console.error(err);
	}
});

// Drag & Drop
localFileForm.addEventListener('dragstart', (evt) => evt.dataTransfer ? evt.dataTransfer.dropEffect = 'link' : undefined);
localFileForm.addEventListener('dragenter', () => localFileForm.dataset['dragover'] = '');
localFileForm.addEventListener('dragleave', () => delete localFileForm.dataset['dragover']);
localFileForm.addEventListener('dragover', (evt) => evt.preventDefault());
localFileForm.addEventListener('drop', async (evt) => {
	evt.preventDefault();

	delete localFileForm.dataset['dragover'];

	const item = [...(evt.dataTransfer?.items ?? [])].find((item) => item.kind === 'file' && item.type === 'text/plain');

	if (item) {
		const handle = /** @type {FileSystemFileHandle | null} */ (await item.getAsFileSystemHandle());

		if (!handle) {
			return;
		}

		const permission = await handle.requestPermission({ mode: 'readwrite' });

		if (permission === 'granted') {
			const file = await handle.getFile();

			if (file) {
				const links = await parseFile(file);

				await set('links-file-handler', handle);
				populateTable(links);
			}
		}
	}
});

// Edit table row
table.addEventListener('click', (evt) => {
	const target = /** @type {HTMLElement} */ (evt.target);

	if (!target.matches('button.edit-row-button')) {
		return;
	}

	target.closest('tr')?.toggleAttribute('data-editing', true);
});

// Save table row
table.addEventListener('submit', async (evt) => {
	evt.preventDefault();

	const target = /** @type {HTMLFormElement} */ (evt.target);
	const formData = new FormData(target);
	const row = /** @type {HTMLTableRowElement} */ (target.closest('tr'));

	const id = /** @type {string} */ (formData.get('id'));

	/** @type {import('./helpers.mjs').Link} */
	const data = {
		url: /** @type {string} */ (formData.get('url')),
		updatedAt: new Date(),
		comment: /** @type {string} */ (formData.get('comment') ?? '')
	};

	await addRowToFile(id, data);

	(/** @type {HTMLTableCellElement} */ (row.cells[0])).innerHTML = generateIdCellContent(id);
	(/** @type {HTMLTableCellElement} */ (row.cells[1])).innerHTML = generateUrlCellContent(id, data.url);
	(/** @type {HTMLTableCellElement} */ (row.cells[2])).innerHTML = generateUpdatedAtCellContent(id, data.updatedAt);
	(/** @type {HTMLTableCellElement} */ (row.cells[3])).innerHTML = generateCommentCellContent(id, data.comment);

	row.toggleAttribute('data-editing', false);
});

table.addEventListener('reset', (evt) => {
	evt.preventDefault();

	const target = /** @type {HTMLFormElement} */ (evt.target);
	const row = /** @type {HTMLTableRowElement} */ (target.closest('tr'));
	const id = row.cells[0]?.querySelector('samp')?.textContent ?? '';
	const url = row.cells[1]?.querySelector('a')?.href ?? '';
	const updatedAt = new Date((row.cells[2]?.querySelector('time')?.dateTime ?? '0000-00-00') + 'Z');
	const comment = row.cells[3]?.querySelector('p')?.textContent ?? '';

	(/** @type {HTMLTableCellElement} */ (row.cells[0])).innerHTML = generateIdCellContent(id);
	(/** @type {HTMLTableCellElement} */ (row.cells[1])).innerHTML = generateUrlCellContent(id, url);
	(/** @type {HTMLTableCellElement} */ (row.cells[2])).innerHTML = generateUpdatedAtCellContent(id, updatedAt);
	(/** @type {HTMLTableCellElement} */ (row.cells[3])).innerHTML = generateCommentCellContent(id, comment);

	row.toggleAttribute('data-editing', false);
});

document.querySelector('#download-links-button')?.addEventListener('click', () => {
	const text = [...table.rows].map((row) => {
		const id = row.cells[0]?.querySelector('samp')?.textContent ?? '';
		const url = row.cells[1]?.querySelector('a')?.href ?? '';
		const updatedAt = (row.cells[2]?.querySelector('time')?.dateTime ?? '0000-00-00') + 'Z';
		const comment = row.cells[3]?.querySelector('p')?.textContent ?? '';

		return `${id}\t${url}\t${updatedAt}\t${comment}`;
	}).join('\n');

	const downloadLink = document.createElement('a');
	downloadLink.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	downloadLink.setAttribute('download', '_links.txt');

	downloadLink.style.display = 'none';
	document.body.appendChild(downloadLink);

	downloadLink.click();

	document.body.removeChild(downloadLink);
});

// Paste file
document.addEventListener('paste', async (evt) => {
	const item = [...(evt.clipboardData?.items ?? [])].find((item) => item.kind === 'file' && item.type === 'text/plain');

	if (item) {
		if ('showOpenFilePicker' in window) {
			const handle = /** @type {FileSystemFileHandle | null} */ (await item.getAsFileSystemHandle());

			if (!handle) {
				return;
			}

			const permission = await handle.requestPermission({ mode: 'readwrite' });

			if (permission === 'granted') {
				const file = await handle.getFile();

				if (file) {
					const links = await parseFile(file);

					await set('links-file-handler', handle);
					populateTable(links);
				}
			}
		} else {
			const file = await item.getAsFile();

			if (file) {
				const links = await parseFile(file);

				populateTable(links);
			}
		}
	}
});

// Paste text
document.addEventListener('paste', async (evt) => {
	const item = [...(evt.clipboardData?.items ?? [])].find((item) => item.kind === 'string' && item.type === 'text/plain');

	if (item) {
		/** @type {string} */
		const string = await new Promise((resolve) => {
			item.getAsString((data) => {
				resolve(data);
			});
		});

		const links = await parseFile(new Blob([string], { type: 'text/plain' }));

		populateTable(links);
	}
});
