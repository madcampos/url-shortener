/**
 * @file
 *
 * Adapted from: https://github.com/jakearchibald/idb-keyval
 */

/**
 * @typedef {<T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>) => Promise<T>} UseStore
 */

/**
 * @template [T=any]
 * @param {IDBRequest<T> | IDBTransaction} request
 * @returns {Promise<T>}
 */
function promisifyRequest(request) {
	return new Promise((resolve, reject) => {
		// @ts-ignore - file size hacks
		request.oncomplete = request.onsuccess = () => resolve(request.result);
		// @ts-ignore - file size hacks
		request.onabort = request.onerror = () => reject(request.error);
	});
}

/**
 * @param {string} dbName
 * @param {string} storeName
 * @returns {UseStore}
 */
function createStore(dbName, storeName) {
	/** @type {Promise<IDBDatabase> | undefined} */
	let dbp;

	const getDB = () => {
		if (dbp) { return dbp; }
		const request = indexedDB.open(dbName);
		request.onupgradeneeded = () => request.result.createObjectStore(storeName);
		dbp = promisifyRequest(request);

		dbp.then(
			(db) => {
				// It seems like Safari sometimes likes to just close the connection.
				// It's supposed to fire this event when that happens. Let's hope it does!
				db.onclose = () => (dbp = undefined);
			},
			() => {}
		);
		return dbp;
	};

	return (txMode, callback) => getDB().then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

/** @type {UseStore | undefined} */
let defaultGetStoreFunc;

function defaultGetStore() {
	if (!defaultGetStoreFunc) {
		defaultGetStoreFunc = createStore('keyval-store', 'keyval');
	}

	return defaultGetStoreFunc;
}

/**
 * Get a value by its key.
 *
 * @template [T=any]
 * @param {IDBValidKey} key
 * @param {UseStore} [customStore] Method to get a custom store. Use with caution (see the docs).
 * @returns {Promise<T | undefined>}
 */
export function get(key, customStore = defaultGetStore()) {
	return customStore('readonly', (store) => promisifyRequest(store.get(key)));
}

/**
 * Set a value with a key.
 *
 * @param {IDBValidKey} key
 * @param {any} value
 * @param {UseStore} [customStore] Method to get a custom store. Use with caution (see the docs).
 * @returns {Promise<void>}
 */
export function set(key, value, customStore = defaultGetStore()) {
	return customStore('readwrite', (store) => {
		store.put(value, key);
		return promisifyRequest(store.transaction);
	});
}

/**
 * Delete a particular key from the store.
 *
 * @param {IDBValidKey} key
 * @param {UseStore} [customStore] Method to get a custom store. Use with caution (see the docs).
 * @returns {Promise<void>}
 */
export function del(key, customStore = defaultGetStore()) {
	return customStore('readwrite', (store) => {
		store.delete(key);
		return promisifyRequest(store.transaction);
	});
}
