window.__ModuleLoader__.load({
	id: "dsh-archive-cleanup",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let zod = require("zod");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region ../../typert/protocol/lib/types/remote-info.js
		/** Lazy assembly of generated Remote definitions using caller-supplied Zod; no runtime imports. */
		/**
		* Retain one generated definition per endpoint without constructing parsers or projections.
		* The class instance builds its shared descriptor/method index on first access;
		* input schemas and JSON Schema projections are cached only when requested.
		* @param spec - compiler-produced method facts and Zod factories.
		* @param zod - the generated artifact's Zod runtime for named-input parsers.
		* @returns a lazy, mountable info instance with no registration or transport effects.
		*/
		function createTypertRemoteInfo(spec, zod) {
			return new RemoteInfo(spec, zod);
		}
		var RemoteInfo = class {
			spec;
			zod;
			index;
			constructor(spec, zod) {
				this.spec = spec;
				this.zod = zod;
			}
			get package() {
				return this.spec.package;
			}
			get descriptors() {
				return this.resolve().descriptors;
			}
			get methods() {
				return this.resolve().methods;
			}
			resolve() {
				if (this.index !== void 0) return this.index;
				const zod = this.zod;
				const descriptors = [];
				const methods = Object.create(null);
				for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
					const separator = endpoint.indexOf("/");
					const namespace = endpoint.slice(0, separator);
					const method = endpoint.slice(separator + 1);
					const parameters = definition.parameters.map((parameter) => ({
						...parameter,
						wire: parameter.wire ?? parameter.name
					}));
					const descriptor = {
						...definition,
						id: `${this.spec.package}#${endpoint}`,
						namespace,
						method,
						parameters,
						result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
					};
					if (definition.invocation.kind === "direct") {
						const inputs = [];
						methods[endpoint] = Object.assign(descriptor, {
							input(options) {
								const strict = options?.strict === true;
								return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
							},
							invoke(remote, input, signal) {
								const named = input;
								const values = parameters.map((parameter) => named[parameter.wire]);
								if (definition.cancellation !== void 0) values.push(signal);
								const receiver = Reflect.get(remote, namespace);
								return Reflect.get(receiver, method).apply(receiver, values);
							}
						});
					}
					descriptors.push(descriptor);
				}
				return this.index = {
					descriptors,
					methods
				};
			}
		};
		function optional(parameter) {
			return parameter.source === "json" && parameter.acceptsUndefined === true;
		}
		var NamedInput = class {
			parameters;
			strict;
			zod;
			schema;
			projection;
			constructor(parameters, strict, zod) {
				this.parameters = parameters;
				this.strict = strict;
				this.zod = zod;
			}
			codec(parameter) {
				return this.strict ? parameter.strictCodec : parameter.codec;
			}
			create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
				const value = this.codec(parameter).create();
				return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
			})));
			get jsonSchema() {
				return this.project().jsonSchema;
			}
			get jsonSchemaError() {
				return this.project().jsonSchemaError;
			}
			project() {
				if (this.projection !== void 0) return this.projection;
				const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
				if (unavailable !== void 0) return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
				return this.projection = { jsonSchema: {
					type: "object",
					properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
						...this.codec(parameter).jsonSchema,
						...parameter.description === void 0 ? {} : { description: parameter.description }
					}])),
					required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
					additionalProperties: false
				} };
			}
		};
		var ResultValue = class {
			spec;
			projection;
			constructor(spec) {
				this.spec = spec;
			}
			get mode() {
				return this.spec.mode;
			}
			get typeSymbol() {
				return this.spec.typeSymbol;
			}
			get create() {
				return this.spec.create;
			}
			get decode() {
				return this.spec.decode;
			}
			get encode() {
				return this.spec.encode;
			}
			get description() {
				return this.spec.description;
			}
			get jsonSchemaError() {
				return this.spec.jsonSchemaError;
			}
			get jsonSchema() {
				if (this.projection === void 0) {
					const schema = this.spec.jsonSchema;
					this.projection = { value: schema === void 0 ? void 0 : {
						...schema,
						description: this.spec.description
					} };
				}
				return this.projection.value;
			}
		};
		//#endregion
		//#region lib/typert.remote-client.js
		let dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0$schema$value;
		const dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0$schema = () => dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0$schema$value ??= zod.z.array(zod.z.string());
		let dsh_archive_cleanup_archiveCleanup_deleteSessions_result$schema$value;
		const dsh_archive_cleanup_archiveCleanup_deleteSessions_result$schema = () => dsh_archive_cleanup_archiveCleanup_deleteSessions_result$schema$value ??= zod.z.object({
			"deleted": zod.z.array(zod.z.string()).readonly(),
			"scheduled": zod.z.array(zod.z.string()).readonly().describe("Still loaded in this run, so deleted at the next start instead."),
			"failed": zod.z.array(zod.z.object({
				"sessionId": zod.z.string().readonly(),
				"reason": zod.z.union([
					zod.z.literal("error"),
					zod.z.literal("not-archived"),
					zod.z.literal("unsafe-path")
				]).readonly(),
				"message": zod.z.string().readonly()
			})).readonly()
		});
		let dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0$schema$value;
		const dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0$schema = () => dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0$schema$value ??= zod.z.array(zod.z.string());
		let dsh_archive_cleanup_archiveCleanup_restoreSessions_result$schema$value;
		const dsh_archive_cleanup_archiveCleanup_restoreSessions_result$schema = () => dsh_archive_cleanup_archiveCleanup_restoreSessions_result$schema$value ??= zod.z.object({
			"restored": zod.z.array(zod.z.string()).readonly(),
			"missingFolders": zod.z.array(zod.z.string()).readonly().describe("Deleted-Workspace folders that no longer exist, so their Sessions came back ungrouped.")
		});
		let dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0$schema$value;
		const dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0$schema = () => dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0$schema$value ??= zod.z.union([zod.z.literal(null), zod.z.number()]);
		let dsh_archive_cleanup_archiveCleanup_setRetention_result$schema$value;
		const dsh_archive_cleanup_archiveCleanup_setRetention_result$schema = () => dsh_archive_cleanup_archiveCleanup_setRetention_result$schema$value ??= zod.z.object({
			"deleted": zod.z.array(zod.z.string()).readonly(),
			"scheduled": zod.z.array(zod.z.string()).readonly().describe("Still loaded in this run, so deleted at the next start instead."),
			"failed": zod.z.array(zod.z.object({
				"sessionId": zod.z.string().readonly(),
				"reason": zod.z.union([
					zod.z.literal("error"),
					zod.z.literal("not-archived"),
					zod.z.literal("unsafe-path")
				]).readonly(),
				"message": zod.z.string().readonly()
			})).readonly()
		});
		let dsh_archive_cleanup_archiveCleanup_state_result$schema$value;
		const dsh_archive_cleanup_archiveCleanup_state_result$schema = () => dsh_archive_cleanup_archiveCleanup_state_result$schema$value ??= zod.z.object({
			"retentionDays": zod.z.union([zod.z.literal(null), zod.z.number()]).readonly().describe("`null` keeps archived Sessions until deleted by hand."),
			"items": zod.z.array(zod.z.object({
				"sessionId": zod.z.string().readonly(),
				"archivedAt": zod.z.number().readonly(),
				"archivedBy": zod.z.union([zod.z.literal("user"), zod.z.literal("workspace-delete")]).readonly(),
				"deletesAt": zod.z.union([zod.z.literal(null), zod.z.number()]).readonly().describe("When it will be deleted automatically, or `null` for never."),
				"pendingDelete": zod.z.boolean().readonly().describe("Deletion was requested while the Session was loaded; it is deleted at the next start.")
			})).readonly(),
			"deletedWorkspaces": zod.z.array(zod.z.object({
				"key": zod.z.string().readonly(),
				"path": zod.z.string().readonly(),
				"title": zod.z.string().readonly(),
				"sessionIds": zod.z.array(zod.z.string()).readonly(),
				"deletedAt": zod.z.number().readonly()
			})).readonly()
		});
		let dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0_strict$schema$value;
		const dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0_strict$schema = () => dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0_strict$schema$value ??= zod.z.array(zod.z.string());
		let dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0_strict$schema$value;
		const dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0_strict$schema = () => dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0_strict$schema$value ??= zod.z.array(zod.z.string());
		let dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0_strict$schema$value;
		const dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0_strict$schema = () => dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0_strict$schema$value ??= zod.z.union([zod.z.literal(null), zod.z.number()]);
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "dsh-archive-cleanup",
			methods: {
				"archiveCleanup/deleteSessions": {
					service: "archiveCleanup",
					description: "Permanently delete archived Sessions: their stored history, cached summary, and subagent children. A Session still loaded in this run cannot be removed safely, so it is deleted at the next start instead. Project folders are never touched.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionIds",
						description: "archived Sessions to delete.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-archive-cleanup#archiveCleanup/deleteSessions:sessionIds",
							create: dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-archive-cleanup#archiveCleanup/deleteSessions:sessionIds",
							create: dsh_archive_cleanup_archiveCleanup_deleteSessions_parameter_0_strict$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-archive-cleanup/types#DeleteResult",
						create: dsh_archive_cleanup_archiveCleanup_deleteSessions_result$schema,
						description: "which were deleted and why the others were not.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"deleted": {
									"type": "array",
									"items": { "type": "string" }
								},
								"scheduled": {
									"type": "array",
									"items": { "type": "string" },
									"description": "Still loaded in this run, so deleted at the next start instead."
								},
								"failed": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"sessionId": { "type": "string" },
											"reason": {
												"type": "string",
												"enum": [
													"error",
													"not-archived",
													"unsafe-path"
												]
											},
											"message": { "type": "string" }
										},
										"required": [
											"sessionId",
											"reason",
											"message"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"deleted",
								"scheduled",
								"failed"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/community/archive-cleanup/src/index.ts",
						"line": 118,
						"column": 3
					}
				},
				"archiveCleanup/restoreSessions": {
					service: "archiveCleanup",
					description: "Bring archived Sessions back. A Session from a deleted Workspace re-creates that Workspace for the same folder first, with all its Sessions in their original order; the ones not restored stay archived inside it.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionIds",
						description: "archived Sessions to restore.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-archive-cleanup#archiveCleanup/restoreSessions:sessionIds",
							create: dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-archive-cleanup#archiveCleanup/restoreSessions:sessionIds",
							create: dsh_archive_cleanup_archiveCleanup_restoreSessions_parameter_0_strict$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-archive-cleanup/types#RestoreResult",
						create: dsh_archive_cleanup_archiveCleanup_restoreSessions_result$schema,
						description: "restored Sessions and folders that no longer exist.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"restored": {
									"type": "array",
									"items": { "type": "string" }
								},
								"missingFolders": {
									"type": "array",
									"items": { "type": "string" },
									"description": "Deleted-Workspace folders that no longer exist, so their Sessions came back ungrouped."
								}
							},
							"required": ["restored", "missingFolders"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/community/archive-cleanup/src/index.ts",
						"line": 130,
						"column": 3
					}
				},
				"archiveCleanup/setRetention": {
					service: "archiveCleanup",
					description: "Choose how long archived Sessions are kept. Sessions already past the new period are deleted right away.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "days",
						description: "one of the offered periods, or `null` to keep them until deleted by hand.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "dsh-archive-cleanup#archiveCleanup/setRetention:days",
							create: dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0$schema,
							jsonSchema: { "oneOf": [{
								"type": "null",
								"const": null
							}, { "type": "number" }] }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "dsh-archive-cleanup#archiveCleanup/setRetention:days",
							create: dsh_archive_cleanup_archiveCleanup_setRetention_parameter_0_strict$schema,
							jsonSchema: { "oneOf": [{
								"type": "null",
								"const": null
							}, { "type": "number" }] }
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "dsh-archive-cleanup/types#DeleteResult",
						create: dsh_archive_cleanup_archiveCleanup_setRetention_result$schema,
						description: "the Sessions deleted because they were already past the new period.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"deleted": {
									"type": "array",
									"items": { "type": "string" }
								},
								"scheduled": {
									"type": "array",
									"items": { "type": "string" },
									"description": "Still loaded in this run, so deleted at the next start instead."
								},
								"failed": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"sessionId": { "type": "string" },
											"reason": {
												"type": "string",
												"enum": [
													"error",
													"not-archived",
													"unsafe-path"
												]
											},
											"message": { "type": "string" }
										},
										"required": [
											"sessionId",
											"reason",
											"message"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"deleted",
								"scheduled",
								"failed"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/community/archive-cleanup/src/index.ts",
						"line": 99,
						"column": 3
					}
				},
				"archiveCleanup/state": {
					service: "archiveCleanup",
					description: "Read the archive as the settings page shows it.",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "dsh-archive-cleanup/types#ArchiveCleanupState",
						create: dsh_archive_cleanup_archiveCleanup_state_result$schema,
						description: "the retention choice, archived Sessions, and deleted Workspaces.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"retentionDays": {
									"oneOf": [{
										"type": "null",
										"const": null
									}, { "type": "number" }],
									"description": "`null` keeps archived Sessions until deleted by hand."
								},
								"items": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"sessionId": { "type": "string" },
											"archivedAt": { "type": "number" },
											"archivedBy": {
												"type": "string",
												"enum": ["user", "workspace-delete"]
											},
											"deletesAt": {
												"oneOf": [{
													"type": "null",
													"const": null
												}, { "type": "number" }],
												"description": "When it will be deleted automatically, or `null` for never."
											},
											"pendingDelete": {
												"type": "boolean",
												"description": "Deletion was requested while the Session was loaded; it is deleted at the next start."
											}
										},
										"required": [
											"sessionId",
											"archivedAt",
											"archivedBy",
											"deletesAt",
											"pendingDelete"
										],
										"additionalProperties": true
									}
								},
								"deletedWorkspaces": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"key": { "type": "string" },
											"path": { "type": "string" },
											"title": { "type": "string" },
											"sessionIds": {
												"type": "array",
												"items": { "type": "string" }
											},
											"deletedAt": { "type": "number" }
										},
										"required": [
											"key",
											"path",
											"title",
											"sessionIds",
											"deletedAt"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"retentionDays",
								"items",
								"deletedWorkspaces"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/community/archive-cleanup/src/index.ts",
						"line": 79,
						"column": 3
					}
				}
			}
		}, zod.z);
		//#endregion
		//#region src/types.ts
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
		//#region \0dsh-css:src\client\components.module.css.mjs
		const css = ".L00UEW_page{flex-direction:column;gap:16px;width:100%;padding-bottom:24px;display:flex}.L00UEW_setting{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:16px;padding:12px 0;display:flex}.L00UEW_settingTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px}.L00UEW_settingDescription,.L00UEW_empty,.L00UEW_safe{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:12px;line-height:18px}.L00UEW_select{border:1px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-button-elevated-fill);min-width:140px;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 8px;font-size:13px}.L00UEW_toolbar{justify-content:flex-end;display:flex}.L00UEW_group{flex-direction:column;display:flex}.L00UEW_groupHeader{height:32px;color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;font-size:13px;display:flex}.L00UEW_groupTitle{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-weight:500;overflow:hidden}.L00UEW_badge{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);white-space:nowrap;border-radius:4px;padding:0 6px;font-size:11px;line-height:18px}.L00UEW_spacer{flex:1}.L00UEW_textButton{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:6px;padding:2px 6px;font-size:12px}.L00UEW_textButton:hover,.L00UEW_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.L00UEW_rows{margin:0;padding:0 0 0 24px;list-style:none}.L00UEW_row{border-radius:8px;align-items:center;gap:4px;min-height:44px;padding:4px 8px;display:flex}.L00UEW_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.L00UEW_rowText{flex:1;min-width:0}.L00UEW_rowTitle{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px;overflow:hidden}.L00UEW_rowMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.L00UEW_iconButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;display:inline-flex}.L00UEW_danger:not(:disabled){color:var(--dsw-alias-state-error-primary)}.L00UEW_status{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.L00UEW_error{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}";
		const tagId = "dsh-archive-cleanup/components.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-archive-cleanup";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var components_module_css_default = {
			"badge": "L00UEW_badge",
			"danger": "L00UEW_danger",
			"empty": "L00UEW_empty",
			"error": "L00UEW_error",
			"group": "L00UEW_group",
			"groupHeader": "L00UEW_groupHeader",
			"groupTitle": "L00UEW_groupTitle",
			"iconButton": "L00UEW_iconButton",
			"page": "L00UEW_page",
			"row": "L00UEW_row",
			"rowMeta": "L00UEW_rowMeta",
			"rowText": "L00UEW_rowText",
			"rowTitle": "L00UEW_rowTitle",
			"rows": "L00UEW_rows",
			"safe": "L00UEW_safe",
			"select": "L00UEW_select",
			"setting": "L00UEW_setting",
			"settingDescription": "L00UEW_settingDescription",
			"settingTitle": "L00UEW_settingTitle",
			"spacer": "L00UEW_spacer",
			"status": "L00UEW_status",
			"textButton": "L00UEW_textButton",
			"toolbar": "L00UEW_toolbar"
		};
		//#endregion
		//#region src/client/components.tsx
		/**
		* The archived-Session menu row, the confirmation dialog with the action
		* notice, and the Settings → Archived sessions page.
		*/
		/**
		* Session ⋯ menu row: "Delete permanently", shown only for archived Sessions.
		* @param props - owner share, menu state, archive set, and plugin face.
		* @returns the row, or nothing for a Session that is not archived.
		*/
		function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useWorkspaces, requestDeleteSession, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			if (!useWorkspaces((snapshot) => snapshot.archivedSessionIds.includes(sessionId))) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				danger: true,
				separatorBefore: true,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
				onSelect: () => {
					setMenuOpen(false);
					requestDeleteSession(sessionId, displayTitle);
				},
				children: t("menu.delete")
			});
		}
		/**
		* The `shell.overlay` entry: the pending confirmation and the latest notice.
		* @param props - plugin face.
		* @returns the dialog and toast, or nothing.
		*/
		function CleanupOverlay({ useCleanup, dismiss, clearNotice, t }) {
			const confirmation = useCleanup((snapshot) => snapshot.confirmation);
			const notice = useCleanup((snapshot) => snapshot.notice);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [confirmation !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmForm, {
				confirmation,
				onClose: dismiss,
				t
			}, confirmation.title + confirmation.description), notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: notice.text,
				onDone: clearNotice,
				...notice.success ? { tone: "success" } : {}
			}, notice.sequence)] });
		}
		/** One confirmation's dialog; its pending and error state die with it. */
		function ConfirmForm({ confirmation, onClose, t }) {
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const close = () => {
				if (!pending) onClose();
			};
			const confirm = () => {
				setPending(true);
				setError(null);
				confirmation.run().then(onClose, (reason) => {
					setPending(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: close,
				closeLabel: t("confirm.close"),
				title: confirmation.title,
				description: confirmation.description,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: pending,
					onClick: close,
					children: t("confirm.cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					className: components_module_css_default.danger,
					disabled: pending,
					onClick: confirm,
					children: confirmation.action
				})] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: components_module_css_default.safe,
						children: t("confirm.safe")
					}),
					pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: components_module_css_default.status,
						role: "status",
						children: t("confirm.pending")
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: components_module_css_default.error,
						role: "alert",
						children: error
					})
				]
			});
		}
		/**
		* Settings → Archived sessions: the retention choice, Delete all, and archived
		* Sessions grouped by Workspace like the sidebar.
		* @param props - archive view, Workspace and Session lists, and plugin face.
		* @returns the page.
		*/
		function ArchivedSessionsPage({ useCleanup, useWorkspaces, useSessions, requestDeleteSession, requestDeleteGroup, requestDeleteAll, requestRetention, restore, refresh, t }) {
			(0, react.useEffect)(() => {
				refresh();
			}, []);
			const state = useCleanup((snapshot) => snapshot.state);
			const workspaces = useWorkspaces((snapshot) => snapshot.items);
			const sessions = useSessions((snapshot) => snapshot.byId);
			if (state === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: components_module_css_default.page });
			const title = (id) => sessions[id]?.title?.trim() || t("row.untitled");
			const groups = groupItems(state.items, state.deletedWorkspaces, workspaces, t("group.ungrouped"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: components_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: components_module_css_default.setting,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: components_module_css_default.settingTitle,
							children: t("retention.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: components_module_css_default.settingDescription,
							children: t("retention.description")
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: components_module_css_default.select,
							"aria-label": t("retention.title"),
							value: state.retentionDays ?? "never",
							onChange: (event) => {
								requestRetention(event.target.value === "never" ? null : Number(event.target.value));
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "never",
								children: t("retention.never")
							}), RETENTION_DAYS.map((days) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: days,
								children: t(days === 1 ? "retention.days.one" : "retention.days.other", { n: days })
							}, days))]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: components_module_css_default.toolbar,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: components_module_css_default.danger,
							disabled: state.items.length === 0,
							onClick: requestDeleteAll,
							children: t("deleteAll")
						})
					}),
					groups.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: components_module_css_default.empty,
						children: t("empty")
					}),
					groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: components_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: components_module_css_default.groupHeader,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, { size: 16 }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: components_module_css_default.groupTitle,
									children: group.title
								}),
								group.deletedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: components_module_css_default.badge,
									children: t("group.deleted", { date: formatDate(group.deletedAt) })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: components_module_css_default.spacer }),
								group.deletedAt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: components_module_css_default.textButton,
									onClick: () => {
										restore(group.items.map((item) => item.sessionId));
									},
									children: t("group.restore")
								}),
								group.key !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${components_module_css_default.textButton} ${components_module_css_default.danger}`,
									onClick: () => {
										requestDeleteGroup(group.items.map((item) => item.sessionId), group.title);
									},
									children: t("group.delete")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: components_module_css_default.rows,
							children: group.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: components_module_css_default.row,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: components_module_css_default.rowText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: components_module_css_default.rowTitle,
											children: title(item.sessionId)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: components_module_css_default.rowMeta,
											children: [
												t(item.archivedBy === "workspace-delete" ? "row.archivedWithWorkspace" : "row.archived", { date: formatDate(item.archivedAt) }),
												" · ",
												item.pendingDelete ? t("row.pending") : deletesLabel(item.deletesAt, t)
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: components_module_css_default.iconButton,
										"aria-label": t("row.restore"),
										title: t("row.restore"),
										onClick: () => {
											restore([item.sessionId]);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `${components_module_css_default.iconButton} ${components_module_css_default.danger}`,
										"aria-label": t("row.delete"),
										title: t("row.delete"),
										onClick: () => {
											requestDeleteSession(item.sessionId, title(item.sessionId));
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
									})
								]
							}, item.sessionId))
						})]
					}, group.key))
				]
			});
		}
		/** Live Workspaces in sidebar order, then deleted ones (newest first), then ungrouped. */
		function groupItems(items, deleted, live, ungroupedTitle) {
			const groups = [...live.map((workspace) => ({
				key: workspace.workspaceId,
				title: workspace.title,
				members: workspace.sessionIds
			})), ...[...deleted].sort((a, b) => b.deletedAt - a.deletedAt).map((workspace) => ({
				key: workspace.key,
				title: workspace.title,
				deletedAt: workspace.deletedAt,
				members: workspace.sessionIds
			}))].map(({ members, ...group }) => ({
				...group,
				items: items.filter((item) => members.includes(item.sessionId))
			}));
			const placed = new Set(groups.flatMap((group) => group.items.map((item) => item.sessionId)));
			groups.push({
				key: "",
				title: ungroupedTitle,
				items: items.filter((item) => !placed.has(item.sessionId))
			});
			for (const group of groups) group.items.sort((a, b) => b.archivedAt - a.archivedAt);
			return groups.filter((group) => group.items.length > 0);
		}
		function deletesLabel(at, t) {
			if (at === null) return t("row.kept");
			const days = Math.ceil((at - Date.now()) / 864e5);
			if (days <= 0) return t("row.deletesToday");
			return t(days === 1 ? "row.deletesIn.one" : "row.deletesIn.other", { n: days });
		}
		function formatDate(ms) {
			return new Date(ms).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric"
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** English copy. The plugin ships English only; other locales fall back to it. */
		const en = {
			"nav": "Archived sessions",
			"menu.delete": "Delete permanently",
			"retention.title": "Auto-delete archived sessions",
			"retention.description": "Each session is deleted when it has been in the archive for the chosen time.",
			"retention.never": "Never",
			"retention.days.one": "After 1 day",
			"retention.days.other": "After {n} days",
			"deleteAll": "Delete all archived",
			"empty": "No archived sessions. Archive a session from its ⋯ menu to see it here.",
			"group.ungrouped": "Ungrouped",
			"group.deleted": "Workspace deleted {date}",
			"group.restore": "Restore workspace",
			"group.delete": "Delete all in workspace",
			"row.untitled": "Untitled session",
			"row.archived": "Archived {date}",
			"row.archivedWithWorkspace": "Archived {date} with workspace",
			"row.deletesIn.one": "Deletes in 1 day",
			"row.deletesIn.other": "Deletes in {n} days",
			"row.deletesToday": "Deletes today",
			"row.kept": "Kept until you delete it",
			"row.pending": "Will be deleted when DSH restarts",
			"row.restore": "Restore",
			"row.delete": "Delete",
			"confirm.cancel": "Cancel",
			"confirm.close": "Close",
			"confirm.pending": "Working…",
			"confirm.safe": "Your project files are not affected. This can’t be undone.",
			"confirm.one.title": "Delete this session permanently?",
			"confirm.one.desc": "“{title}” and its history will be erased.",
			"confirm.many.title": "Delete {n} sessions permanently?",
			"confirm.all.desc": "Every archived session and its history will be erased.",
			"confirm.group.desc": "All archived sessions from “{title}” will be erased.",
			"confirm.retention.title": "Delete expired sessions now?",
			"confirm.retention.desc.one": "1 archived session is older than the new limit and will be deleted right away.",
			"confirm.retention.desc.other": "{n} archived sessions are older than the new limit and will be deleted right away.",
			"confirm.delete": "Delete permanently",
			"confirm.apply": "Apply and delete",
			"notice.deleted.one": "Session deleted permanently.",
			"notice.deleted.other": "{n} sessions deleted permanently.",
			"notice.scheduled.one": "This session is still loaded, so it will be deleted the next time DSH starts.",
			"notice.scheduled.other": "{n} sessions are still loaded, so they will be deleted the next time DSH starts.",
			"notice.restored": "Restored",
			"notice.missingFolder": "Restored as ungrouped: the folder {path} no longer exists",
			"notice.failed": "Could not delete: {message}",
			"notice.workspaceArchived.one": "The session from “{title}” is in the archive. Restore it in Settings → Archived sessions.",
			"notice.workspaceArchived.other": "{n} sessions from “{title}” are in the archive. Restore them in Settings → Archived sessions."
		};
		//#endregion
		//#region src/client/model.ts
		/** Browser-side state: the Host archive view, the pending confirmation, and the last notice. */
		/** Owns the snapshot and turns Host results into notices. */
		var CleanupModel = class {
			remote;
			t;
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				state: null,
				confirmation: null,
				notice: null
			});
			sequence = 0;
			constructor(remote, t) {
				this.remote = remote;
				this.t = t;
			}
			/** Re-read the archive view from the Host. */
			async refresh() {
				const state = await this.remote.state();
				this.store.update((draft) => {
					draft.state = state;
				});
			}
			/**
			* Show a confirmation; nothing happens until the user confirms.
			* @param confirmation - copy and the action to run on confirm.
			*/
			ask(confirmation) {
				this.store.update((draft) => {
					draft.confirmation = confirmation;
				});
			}
			/** Close the confirmation without acting. */
			dismiss() {
				this.store.update((draft) => {
					draft.confirmation = null;
				});
			}
			/** Clear the notice. */
			clearNotice() {
				this.store.update((draft) => {
					draft.notice = null;
				});
			}
			/**
			* Permanently delete archived Sessions and report the outcome.
			* @param sessionIds - archived Sessions.
			*/
			async delete(sessionIds) {
				this.report(await this.remote.deleteSessions(sessionIds));
				await this.refresh();
			}
			/**
			* Change the retention period (which may delete expired Sessions) and report the outcome.
			* @param days - new period, or `null` for never.
			*/
			async setRetention(days) {
				const result = await this.remote.setRetention(days);
				if (result.deleted.length + result.scheduled.length + result.failed.length > 0) this.report(result);
				await this.refresh();
			}
			/**
			* Restore archived Sessions and report the outcome.
			* @param sessionIds - archived Sessions.
			*/
			async restore(sessionIds) {
				const missing = (await this.remote.restoreSessions(sessionIds)).missingFolders[0];
				this.notify(missing === void 0 ? this.t("notice.restored") : this.t("notice.missingFolder", { path: missing }), missing === void 0);
				await this.refresh();
			}
			/**
			* Show a notice.
			* @param text - message.
			* @param success - whether to use the success tone.
			*/
			notify(text, success) {
				this.sequence += 1;
				const notice = {
					text,
					success,
					sequence: this.sequence
				};
				this.store.update((draft) => {
					draft.notice = notice;
				});
			}
			report(result) {
				const failure = result.failed[0];
				if (failure !== void 0) {
					this.notify(this.t("notice.failed", { message: failure.message }), false);
					return;
				}
				const n = result.deleted.length;
				const later = result.scheduled.length;
				const text = [n > 0 ? this.t(n === 1 ? "notice.deleted.one" : "notice.deleted.other", { n }) : "", later > 0 ? this.t(later === 1 ? "notice.scheduled.one" : "notice.scheduled.other", { n: later }) : ""].filter(Boolean).join(" ");
				this.notify(text, true);
			}
		};
		//#endregion
		//#region src/client/index.ts
		const LOCALE = "archiveCleanup";
		const DAY_MS = 864e5;
		/** Services used by the browser half. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"workspaces"
		];
		/**
		* Mount this plugin's Remote namespace, then activate the UI once it is available.
		* @param ctx - browser plugin context.
		* @returns the namespace disposer.
		*/
		async function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE, {
				en,
				zh: en
			}));
			const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
			ctx.inject(["remote.archiveCleanup"], activate);
			return unmount;
		}
		/**
		* Register the menu row, the settings page, and the overlay.
		* @param ctx - context that may read `ctx.remote.archiveCleanup`.
		*/
		function activate(ctx) {
			const t = ctx.locale.bind(LOCALE);
			const remote = () => ctx.remote.archiveCleanup;
			const model = new CleanupModel({
				state: async () => unwrap(await remote().state()),
				setRetention: async (days) => unwrap(await remote().setRetention(days)),
				deleteSessions: async (ids) => unwrap(await remote().deleteSessions(ids)),
				restoreSessions: async (ids) => unwrap(await remote().restoreSessions(ids))
			}, (key, vars) => t(key, vars));
			const manyTitle = (n) => n === 1 ? t("confirm.one.title") : t("confirm.many.title", { n });
			const face = () => ({
				hooks: { cleanup: model.store },
				requestDeleteSession: (sessionId, title) => {
					model.ask({
						title: t("confirm.one.title"),
						description: t("confirm.one.desc", { title: title ?? t("row.untitled") }),
						action: t("confirm.delete"),
						run: () => model.delete([sessionId])
					});
				},
				requestDeleteGroup: (sessionIds, title) => {
					model.ask({
						title: manyTitle(sessionIds.length),
						description: t("confirm.group.desc", { title }),
						action: t("confirm.delete"),
						run: () => model.delete(sessionIds)
					});
				},
				requestDeleteAll: () => {
					const ids = model.store.getSnapshot().state?.items.map((item) => item.sessionId) ?? [];
					model.ask({
						title: manyTitle(ids.length),
						description: t("confirm.all.desc"),
						action: t("confirm.delete"),
						run: () => model.delete(ids)
					});
				},
				requestRetention: (days) => {
					const items = model.store.getSnapshot().state?.items ?? [];
					const due = days === null ? 0 : items.filter((item) => item.archivedAt + days * DAY_MS <= Date.now()).length;
					if (due === 0) {
						model.setRetention(days).catch(report);
						return;
					}
					model.ask({
						title: t("confirm.retention.title"),
						description: t(due === 1 ? "confirm.retention.desc.one" : "confirm.retention.desc.other", { n: due }),
						action: t("confirm.apply"),
						run: () => model.setRetention(days)
					});
				},
				restore: (sessionIds) => {
					model.restore(sessionIds).catch(report);
				},
				refresh: () => {
					model.refresh().catch(report);
				},
				dismiss: () => {
					model.dismiss();
				},
				clearNotice: () => {
					model.clearNotice();
				}
			});
			ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
				name: "sidebar.workspaces.session.menu.item",
				id: "archive-cleanup-delete",
				order: 410,
				locale: LOCALE,
				inject: face
			}, DeleteSessionMenuItem));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "archived-sessions",
				order: 60,
				label: () => t("nav"),
				locale: LOCALE,
				inject: face
			}, ArchivedSessionsPage));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "archive-cleanup-overlay",
				locale: LOCALE,
				inject: face
			}, CleanupOverlay));
			ctx.effect(() => followWorkspaces(ctx, model, t), "archive-cleanup.follow");
			ctx.on("connection/reset", () => {
				model.refresh().catch(report);
			});
			model.refresh().catch(report);
		}
		/**
		* Re-read the archive view whenever the archive set or the Workspace list
		* changes, and announce Workspaces whose deletion archived their Sessions.
		* @returns unsubscribe function.
		*/
		function followWorkspaces(ctx, model, t) {
			let last = ctx.workspaces.list.getSnapshot();
			return ctx.workspaces.list.subscribe(() => {
				const next = ctx.workspaces.list.getSnapshot();
				if (next.archivedSessionIds === last.archivedSessionIds && next.items === last.items) return;
				last = next;
				const known = new Set(model.store.getSnapshot().state?.deletedWorkspaces.map((workspace) => workspace.key));
				model.refresh().then(() => {
					for (const workspace of model.store.getSnapshot().state?.deletedWorkspaces ?? []) {
						if (known.has(workspace.key)) continue;
						const n = workspace.sessionIds.length;
						model.notify(t(n === 1 ? "notice.workspaceArchived.one" : "notice.workspaceArchived.other", {
							n,
							title: workspace.title
						}), true);
					}
				}).catch(report);
			});
		}
		/** Surface an unexpected failure in the browser console. */
		function report(error) {
			console.error("[archive-cleanup]", error);
		}
		/** @returns the value of a successful Remote call; a failure is thrown as its Error. */
		function unwrap(result) {
			if (!result.ok) throw result.error;
			return result.value;
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map