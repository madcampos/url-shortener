import { loadLinks, VALIDATION_REGEX } from './helpers.mjs';

/**
 * @param {TemplateStringsArray} strings
 * @param {string[]} params
 */
function raw(strings, ...params) {
	return strings.map((string, index) => `${string}${params[index] ?? ''}`).join('');
}

/**
 * @param {Awaited<ReturnType<loadLinks>>} links
 */
function populateTable(links) {
	const table = document.querySelector('table tbody');
	const formatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

	Object.entries(links).forEach(([id, { url, updatedAt, comment }]) => {
		table?.querySelector('tr:has(td[colspan])')?.remove();

		table?.insertAdjacentHTML(
			'beforeend',
			raw`
				<tr>
					<td>
						<span class="cell-display">
							<samp>${id}</samp>
							<button type="button">
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
							<button type="button" aria-label="Delete row">
								<svg viewBox="0 0 24 24" width="24" height="24"><use href="#icon-delete"/></svg>
							</button>
						</span>
					</td>
				</tr>
			`
		);
	});
}

// TODO: set validation regex on load

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

	const links = await loadLinks();

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

// TODO: Table edit button
// TODO: Table save button
// TODO: Table delete button
// TODO: Randomize id button
// TODO: Copy id button
// TODO: Share short url button
// TODO: Load local file
// TODO: Drag & Drop
// TODO: Paste text
// TODO: Paste file
