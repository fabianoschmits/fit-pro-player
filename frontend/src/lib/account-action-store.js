let readStore = null

export function bindAccountActionStore(reader) { readStore = reader }
export function accountActionStore() { return readStore?.() || null }
