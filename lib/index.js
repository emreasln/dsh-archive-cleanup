import { readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { workspaceRecord } from "@deepseek-ai/dsh-workspace";
//#region lib/types/paths.js
/** The safety rule for what a permanent delete may remove from disk. */
/**
* Mirror of the JSONL backend's path-segment encoding
* (`packages/session/session-persistence-jsonl/src/format.ts`): the folder name a
* Session id is stored under.
* @param raw - the Session id.
* @returns the encoded folder name.
*/
function encodeSegment(raw) {
	if (raw.length === 0) throw new Error("cannot encode an empty path segment");
	if (raw === ".") return "~002E";
	if (raw === "..") return "~002E~002E";
	let out = "";
	for (let i = 0; i < raw.length; i++) {
		const code = raw.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
		else out += "~" + code.toString(16).toUpperCase().padStart(4, "0");
	}
	return out;
}
/**
* Mirror of the JSONL backend's project folder name for a working directory.
* @param cwd - the Session's project directory.
* @returns a single filesystem-safe folder name.
*/
function projectKey(cwd) {
	if (cwd.length === 0) throw new Error("cannot encode an empty project path");
	let readable = "";
	let separatorRun = false;
	for (let i = 0; i < cwd.length; i++) {
		const code = cwd.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch === "/" || ch === "\\" || ch === ":") {
			if (!separatorRun) readable += "-";
			separatorRun = true;
		} else if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) {
			readable += ch;
			separatorRun = false;
		} else {
			readable += "~" + code.toString(16).toUpperCase().padStart(4, "0");
			separatorRun = false;
		}
	}
	return `--${(readable.replace(/^-+/, "") || "root").slice(0, 251)}--`;
}
/**
* Mirror of the JSONL backend's folder for one Session, for DSH versions whose
* `stat()` does not report the stored file's location.
* @param root - the Session storage root.
* @param cwd - the Session's project directory, if any.
* @param id - the Session id.
* @returns the Session's folder.
*/
function sessionDir(root, cwd, id) {
	return join(root, cwd === void 0 ? "_no-cwd" : projectKey(cwd), encodeSegment(id));
}
/**
* Whether `child` is `parent` itself or lies inside it.
* @param parent - absolute directory.
* @param child - absolute path.
* @returns true when `child` is within `parent`.
*/
function isWithin(parent, child) {
	const rel = relative(parent, child);
	return rel === "" || !rel.startsWith("..") && !isAbsolute(rel);
}
/**
* Decide whether a Session folder may be removed. All paths must already be
* resolved real paths. The folder must sit exactly at
* `<sessionsRoot>/<project>/<encoded id>`, and no Workspace folder may be the
* Session folder or lie inside it, so a project folder can never be removed.
* @param dir - the Session's folder.
* @param sessionId - the Session id the folder must belong to.
* @param sessionsRoot - the Session storage root.
* @param workspacePaths - every registered Workspace folder.
* @returns `null` when safe, otherwise the reason it is not.
*/
function unsafeReason(dir, sessionId, sessionsRoot, workspacePaths) {
	if (relative(dirname(dirname(dir)), sessionsRoot) !== "") return `"${dir}" is not inside the Session storage folder "${sessionsRoot}"`;
	if (basename(dir) !== encodeSegment(sessionId)) return `"${dir}" does not belong to Session ${sessionId}`;
	const workspace = workspacePaths.find((path) => isWithin(dir, path));
	if (workspace !== void 0) return `"${dir}" contains the Workspace folder "${workspace}"`;
	return null;
}
//#endregion
//#region lib/types/types.js
/** Values shared by the Host and the settings page. */
/** Auto-delete choices in days; `null` keeps archived Sessions until deleted by hand. */
const RETENTION_DAYS = [
	1,
	3,
	7,
	14,
	30,
	60,
	90
];
//#endregion
//#region lib/types/store.js
/** Plugin state: when each Session was archived, deleted-Workspace snapshots, and the retention choice. */
/** @returns a fresh, empty state. */
function emptyState() {
	return {
		version: 1,
		retentionDays: null,
		archived: {},
		deletedWorkspaces: [],
		pendingDelete: []
	};
}
/**
* Read the state file.
* @param file - absolute path of the JSON file.
* @returns the stored state, or `undefined` when the file does not exist yet.
*/
async function loadState(file) {
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
	const parsed = JSON.parse(text);
	return {
		...emptyState(),
		...parsed,
		version: 1
	};
}
/**
* Write the state file atomically (temporary file, then rename).
* @param file - absolute path of the JSON file.
* @param state - state to store.
*/
async function saveState(file, state) {
	const temporary = `${file}.tmp`;
	await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", "utf8");
	await rename(temporary, file);
}
/**
* Align tracked entries with the Host archive set: newly archived ids get `now`,
* unarchived ids are forgotten (which also cancels a pending delete), and
* deleted-Workspace snapshots drop Sessions that are no longer archived (an
* emptied snapshot is dropped).
* @param state - current state; not mutated.
* @param archivedIds - the Host's complete archive set.
* @param now - current time in epoch milliseconds.
* @returns the aligned state, and whether anything changed.
*/
function syncArchived(state, archivedIds, now) {
	const ids = new Set(archivedIds);
	const archived = {};
	let changed = false;
	for (const id of ids) {
		const entry = state.archived[id];
		if (entry === void 0) changed = true;
		archived[id] = entry ?? {
			archivedAt: now,
			archivedBy: "user"
		};
	}
	if (Object.keys(state.archived).some((id) => !ids.has(id))) changed = true;
	const deletedWorkspaces = state.deletedWorkspaces.map((workspace) => ({
		...workspace,
		sessionIds: workspace.sessionIds.filter((id) => ids.has(id))
	})).filter((workspace) => workspace.sessionIds.length > 0);
	if (deletedWorkspaces.some((workspace, i) => workspace.sessionIds.length !== state.deletedWorkspaces[i]?.sessionIds.length) || deletedWorkspaces.length !== state.deletedWorkspaces.length) changed = true;
	const pendingDelete = state.pendingDelete.filter((id) => ids.has(id));
	if (pendingDelete.length !== state.pendingDelete.length) changed = true;
	return {
		state: {
			...state,
			archived,
			deletedWorkspaces,
			pendingDelete
		},
		changed
	};
}
/**
* When an archived Session will be deleted automatically.
* @param entry - the tracked entry.
* @param retentionDays - the retention choice, `null` for never.
* @returns epoch milliseconds, or `null` when it is kept until deleted by hand.
*/
function deletesAt(entry, retentionDays) {
	return retentionDays === null ? null : entry.archivedAt + retentionDays * 864e5;
}
/**
* Sessions whose own retention period has fully elapsed.
* @param state - current state.
* @param now - current time in epoch milliseconds.
* @returns ids to delete, oldest first.
*/
function expiredIds(state, now) {
	return Object.entries(state.archived).filter(([, entry]) => {
		const at = deletesAt(entry, state.retentionDays);
		return at !== null && at <= now;
	}).sort(([, a], [, b]) => a.archivedAt - b.archivedAt).map(([id]) => id);
}
//#endregion
//#region lib/types/index.js
/**
* Archive Cleanup, Host half. Builds on DSH's Archive: tracks when each Session
* was archived, permanently deletes archived Sessions on request or after the
* chosen retention period, and turns a Workspace deletion into archiving its
* Sessions so the Workspace can be restored later. Only DSH's own Session files
* are ever removed; project folders are never touched.
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** How often expired archived Sessions are looked for. */
const SWEEP_INTERVAL_MS = 3600 * 1e3;
let ArchiveCleanup = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _state_decorators;
	let _setRetention_decorators;
	let _deleteSessions_decorators;
	let _restoreSessions_decorators;
	return class ArchiveCleanup extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_state_decorators = [Remote];
			_setRetention_decorators = [Remote];
			_deleteSessions_decorators = [Remote];
			_restoreSessions_decorators = [Remote];
			__esDecorate(this, null, _state_decorators, {
				kind: "method",
				name: "state",
				static: false,
				private: false,
				access: {
					has: (obj) => "state" in obj,
					get: (obj) => obj.state
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setRetention_decorators, {
				kind: "method",
				name: "setRetention",
				static: false,
				private: false,
				access: {
					has: (obj) => "setRetention" in obj,
					get: (obj) => obj.setRetention
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteSessions_decorators, {
				kind: "method",
				name: "deleteSessions",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteSessions" in obj,
					get: (obj) => obj.deleteSessions
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _restoreSessions_decorators, {
				kind: "method",
				name: "restoreSessions",
				static: false,
				private: false,
				access: {
					has: (obj) => "restoreSessions" in obj,
					get: (obj) => obj.restoreSessions
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = [
			"workspaceRegistry",
			"sessionPersistence",
			"sessions"
		];
		logger = (__runInitializers(this, _instanceExtraInitializers), this.ctx.logger("archive-cleanup"));
		home = resolveDshHome();
		stateFile = join(this.home, "storages", "archive-cleanup.json");
		store = emptyState();
		/** Last known shape of every Workspace, so a deletion can still be described afterwards. */
		workspaces = /* @__PURE__ */ new Map();
		/** Serializes every state-changing operation. */
		chain = Promise.resolve();
		/** Pending deferred archive-set sync, coalescing bursts of registry writes. */
		syncTimer;
		constructor(ctx) {
			super(ctx, "archiveCleanup");
			this.rememberWorkspaces();
			ctx.on("domain/changed", (change) => {
				this.changed(change);
			});
			ctx.effect(() => {
				this.enqueue(async () => {
					this.store = await loadState(this.stateFile) ?? emptyState();
					await this.sync();
					if (this.store.pendingDelete.length > 0) await this.deleteNow([...this.store.pendingDelete]);
					await this.sweep();
				});
				const timer = setInterval(() => {
					this.enqueue(() => this.sweep());
				}, SWEEP_INTERVAL_MS);
				timer.unref();
				return () => {
					clearInterval(timer);
					clearTimeout(this.syncTimer);
				};
			}, "archive-cleanup.sweep");
		}
		/**
		* Read the archive as the settings page shows it.
		* @returns the retention choice, archived Sessions, and deleted Workspaces.
		*/
		state() {
			return this.enqueue(() => {
				const { retentionDays, archived, deletedWorkspaces, pendingDelete } = this.store;
				return Promise.resolve({
					retentionDays,
					items: Object.entries(archived).map(([sessionId, entry]) => ({
						sessionId,
						...entry,
						deletesAt: deletesAt(entry, retentionDays),
						pendingDelete: pendingDelete.includes(sessionId)
					})),
					deletedWorkspaces
				});
			});
		}
		/**
		* Choose how long archived Sessions are kept. Sessions already past the new
		* period are deleted right away.
		* @param days - one of the offered periods, or `null` to keep them until deleted by hand.
		* @returns the Sessions deleted because they were already past the new period.
		*/
		setRetention(days) {
			if (days !== null && !RETENTION_DAYS.includes(days)) throw new Error(`retention must be one of ${RETENTION_DAYS.join(", ")} days, or null`);
			return this.enqueue(async () => {
				this.store = {
					...this.store,
					retentionDays: days
				};
				await this.save();
				return await this.sweep();
			});
		}
		/**
		* Permanently delete archived Sessions: their stored history, cached summary,
		* and subagent children. A Session still loaded in this run cannot be removed
		* safely, so it is deleted at the next start instead. Project folders are never touched.
		* @param sessionIds - archived Sessions to delete.
		* @returns which were deleted and why the others were not.
		*/
		deleteSessions(sessionIds) {
			return this.enqueue(() => this.deleteNow(sessionIds));
		}
		/**
		* Bring archived Sessions back. A Session from a deleted Workspace re-creates
		* that Workspace for the same folder first, with all its Sessions in their
		* original order; the ones not restored stay archived inside it.
		* @param sessionIds - archived Sessions to restore.
		* @returns restored Sessions and folders that no longer exist.
		*/
		restoreSessions(sessionIds) {
			return this.enqueue(() => this.restoreNow(sessionIds));
		}
		enqueue(operation) {
			const run = this.chain.then(operation);
			this.chain = run.catch((error) => {
				this.logger.warn(error);
			});
			return run;
		}
		changed(change) {
			if (change.domain !== "workspace") return;
			if (change.table === "workspaces" && change.operation === "deleted") {
				const workspace = this.workspaces.get(change.key);
				this.workspaces.delete(change.key);
				if (workspace !== void 0) this.enqueue(() => this.workspaceDeleted(workspace));
				return;
			}
			if (change.table === "workspaces" && change.operation === "put") {
				const record = workspaceRecord.parse(change.value);
				this.workspaces.set(change.key, {
					key: change.key,
					path: record.path,
					title: record.title,
					sessionIds: record.sessionIds.map(String)
				});
			}
			if (change.table === "") this.scheduleSync();
		}
		/**
		* Re-read the archive set once the registry has applied its write. The event
		* fires just before the registry updates its own copy, and a burst of writes
		* (such as a Workspace deletion) can carry snapshots older than work this
		* plugin queues in between, so the sync reads the live set on a later tick
		* instead of trusting any one event's snapshot.
		*/
		scheduleSync() {
			if (this.syncTimer !== void 0) return;
			this.syncTimer = setTimeout(() => {
				this.syncTimer = void 0;
				this.enqueue(() => this.sync());
			}, 0);
		}
		rememberWorkspaces() {
			for (const workspace of this.ctx.workspaceRegistry.list()) this.workspaces.set(String(workspace.id), {
				key: String(workspace.id),
				path: workspace.path,
				title: workspace.title,
				sessionIds: workspace.sessionIds.map(String)
			});
		}
		/** Align tracked entries with the registry's current archive set. */
		async sync() {
			const result = syncArchived(this.store, this.ctx.workspaceRegistry.archivedSessionIds.map(String), Date.now());
			this.store = result.state;
			if (result.changed) await this.save();
		}
		async save() {
			await saveState(this.stateFile, this.store);
		}
		async sweep() {
			const due = expiredIds(this.store, Date.now());
			if (due.length === 0) return {
				deleted: [],
				scheduled: [],
				failed: []
			};
			const result = await this.deleteNow(due);
			if (result.deleted.length > 0) this.logger.info("auto-deleted %d archived session(s)", result.deleted.length);
			if (result.scheduled.length > 0) this.logger.info("%d expired session(s) are loaded and will be deleted at the next start", result.scheduled.length);
			for (const failure of result.failed) this.logger.warn("could not auto-delete %s: %s", failure.sessionId, failure.message);
			return result;
		}
		/** Archive every Session of a deleted Workspace and remember the Workspace for a later restore. */
		async workspaceDeleted(workspace) {
			const kept = [];
			const now = Date.now();
			for (const id of workspace.sessionIds) {
				if (id in this.store.archived) {
					kept.push(id);
					continue;
				}
				this.store.archived[id] = {
					archivedAt: now,
					archivedBy: "workspace-delete"
				};
				try {
					await this.ctx.workspaceRegistry.archiveSession(id, { stopActivity: true });
					kept.push(id);
				} catch (error) {
					delete this.store.archived[id];
					this.logger.debug("skipped %s while archiving deleted workspace: %s", id, String(error));
				}
			}
			if (kept.length > 0) this.store.deletedWorkspaces = [...this.store.deletedWorkspaces.filter((entry) => entry.key !== workspace.key), {
				...workspace,
				sessionIds: kept,
				deletedAt: now
			}];
			await this.save();
		}
		async deleteNow(sessionIds) {
			const deleted = [];
			const scheduled = [];
			const failed = [];
			const sessionsRoot = await realpath(join(this.home, "sessions")).catch(() => join(this.home, "sessions"));
			const workspacePaths = await Promise.all(this.ctx.workspaceRegistry.list().map((workspace) => realpath(workspace.path).catch(() => workspace.path)));
			let stored;
			for (const id of sessionIds) {
				if (!(id in this.store.archived)) {
					failed.push({
						sessionId: id,
						reason: "not-archived",
						message: "Only archived sessions can be deleted permanently."
					});
					continue;
				}
				try {
					stored ??= await this.ctx.sessionPersistence.list();
					const tree = [...descendants(id, stored), id];
					if (tree.some((member) => this.ctx.sessions.get(member) !== void 0)) {
						if (!this.store.pendingDelete.includes(id)) this.store.pendingDelete.push(id);
						scheduled.push(id);
						continue;
					}
					const folders = await sessionFolders(tree, stored, sessionsRoot);
					const unsafe = await checkFolders(folders, sessionsRoot, workspacePaths);
					if (unsafe !== null) {
						failed.push({
							sessionId: id,
							reason: "unsafe-path",
							message: unsafe
						});
						continue;
					}
					for (const member of tree) await this.erase(member, folders.get(member));
					deleted.push(id);
				} catch (error) {
					failed.push({
						sessionId: id,
						reason: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
			this.store.pendingDelete = this.store.pendingDelete.filter((id) => !deleted.includes(id));
			await this.save();
			return {
				deleted,
				scheduled,
				failed
			};
		}
		/** Remove one Session's files (its checked folder, if it has one) and every reference to it. */
		async erase(sessionId, folder) {
			const id = sessionId;
			if (folder !== void 0) await rm(folder, { recursive: true });
			if (/^[A-Za-z0-9._-]+$/.test(sessionId)) await rm(join(this.home, "storages", "session_projcache", "sessions", `${sessionId}.json`), { force: true });
			for (const workspace of this.ctx.workspaceRegistry.list()) if (workspace.sessionIds.includes(id)) await workspace.detachSession(id);
			await this.ctx.workspaceRegistry.unarchiveSession(id);
			delete this.store.archived[sessionId];
			this.ctx.emit("api-session/removed", id);
			this.logger.info("deleted session %s", sessionId);
		}
		async restoreNow(sessionIds) {
			const restored = [];
			const missingFolders = [];
			for (const id of sessionIds) {
				const workspace = this.store.deletedWorkspaces.find((entry) => entry.sessionIds.includes(id));
				if (workspace !== void 0 && !await this.recreate(workspace)) missingFolders.push(workspace.path);
				await this.ctx.workspaceRegistry.unarchiveSession(id);
				restored.push(id);
			}
			await this.save();
			return {
				restored,
				missingFolders: [...new Set(missingFolders)]
			};
		}
		/**
		* Re-register a deleted Workspace for its folder and put its Sessions back in order.
		* @returns false when the folder no longer exists.
		*/
		async recreate(workspace) {
			this.store.deletedWorkspaces = this.store.deletedWorkspaces.filter((entry) => entry.key !== workspace.key);
			let target;
			try {
				target = await this.ctx.workspaceRegistry.resolveByPath(workspace.path) ?? await this.ctx.workspaceRegistry.create(workspace.path, workspace.title);
			} catch (error) {
				this.logger.warn("cannot re-create workspace %s: %s", workspace.path, String(error));
				return false;
			}
			for (const id of [...workspace.sessionIds].reverse()) try {
				await target.attachSession(id);
			} catch (error) {
				this.logger.warn("cannot put %s back into %s: %s", id, workspace.path, String(error));
			}
			return true;
		}
	};
})();
/** Every subagent Session created, directly or indirectly, by `parent`. */
function descendants(parent, stored) {
	return stored.filter((snapshot) => snapshot.header.parentSession === parent && snapshot.header.origin === "subagent").map((snapshot) => String(snapshot.header.id)).flatMap((child) => [...descendants(child, stored), child]);
}
/**
* The real folder of each Session in `tree` that exists on disk. DSH 0.2.2 and
* later report the stored file's location; earlier versions use the JSONL layout.
*/
async function sessionFolders(tree, stored, sessionsRoot) {
	const folders = /* @__PURE__ */ new Map();
	for (const member of tree) {
		const snapshot = stored.find((entry) => entry.header.id === member);
		if (snapshot === void 0) continue;
		const reported = snapshot.location?.path;
		const real = await realpath(reported === void 0 ? sessionDir(sessionsRoot, snapshot.header.cwd, member) : dirname(reported)).catch(() => void 0);
		if (real !== void 0) folders.set(member, real);
	}
	return folders;
}
/** @returns the first reason one of `folders` may not be removed, or `null`. */
async function checkFolders(folders, sessionsRoot, workspacePaths) {
	for (const [member, dir] of folders) {
		const reason = unsafeReason(dir, member, sessionsRoot, workspacePaths);
		if (reason !== null) return reason;
		if (!(await readdir(dir)).some((name) => name.startsWith("session.") && name.includes(".jsonl"))) return `"${dir}" does not look like a session folder`;
	}
	return null;
}
//#endregion
export { ArchiveCleanup as default };
