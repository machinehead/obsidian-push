import { debounce, TFile } from "obsidian";
import ObsidianPushPlugin from "../main";
import { MinHeap } from "@datastructures-js/heap";
import { webhookObsidian } from "./api";

const SEND_LOOP_TIMEOUT = 1000;

interface IFileEvent {
	file: TFile;
	event_name: string;
}

class FileHandler {
	tracker: FileTracker;

	constructor(tracker: FileTracker) {
		this.tracker = tracker;
	}

	debouncedEnqueueEvent = debounce(
		async ({ file }: { file: TFile }) => {
			// TODO: lift event creation up and make it actually have different names?
			this.tracker.enqueueEvent({
				file: file,
				event_name: "create",
			});
		},
		10000,
		true,
	);
}

export class FileTracker {
	plugin: ObsidianPushPlugin;
	fileHandlers = new Map<string, FileHandler>();
	sendQueue: MinHeap<IFileEvent> = new MinHeap<IFileEvent>(
		(e) => e.file.stat.mtime,
	);
	constructor(plugin: ObsidianPushPlugin) {
		this.plugin = plugin;
	}

	registerFile(file: TFile): void {
		const handler = new FileHandler(this);
		this.fileHandlers.set(file.path, handler);
		// onCreate relies on this for sending creates
		if (this.plugin.isNewerThanTimestamp(file.stat.mtime)) {
			handler.debouncedEnqueueEvent({ file });
		}
	}

	onCreate(file: TFile) {
		console.log("File created", file.path);
		this.registerFile(file);
	}

	onModify(file: TFile): void {
		console.log(
			"File modified",
			file.path,
			"ctime",
			file.stat.ctime,
			"mtime",
			file.stat.mtime,
		);
		const handler = this.fileHandlers.get(file.path);
		if (handler) {
			// TODO: maybe expedite if the file gets closed
			handler.debouncedEnqueueEvent({ file });
		}
	}

	onDelete(file: TFile): void {
		console.log("File deleted", file.path);
		// TODO: send to server
		this.fileHandlers.delete(file.path);
	}

	onRename(file: TFile, oldPath: string) {
		console.log("File renamed", file.path, "from", oldPath);
		const handler = this.fileHandlers.get(oldPath);
		if (handler) {
			// TODO: send to server
			this.fileHandlers.set(file.path, handler);
			this.fileHandlers.delete(oldPath);
		}
		// TODO: error on else
	}

	startSendLoop() {
		this.scheduleSendLoop();
	}

	scheduleSendLoop() {
		setTimeout(() => this.sendLoop(), SEND_LOOP_TIMEOUT);
	}

	sendLoop() {
		const fileEvent = this.sendQueue.pop();
		if (!fileEvent) {
			this.scheduleSendLoop();
			return;
		}
		this.postWithFetch(fileEvent.file)
			.then(async () => {
				await this.plugin.updateTimestamp(fileEvent.file.stat.mtime);
			})
			.catch((e) => {
				console.log("Failed to post updates", e);
				// back to queue
				this.enqueueEvent(fileEvent);
			})
			.finally(() => {
				this.scheduleSendLoop();
			});
	}

	enqueueEvent(event: IFileEvent) {
		if (event.file.extension !== "md") {
			// TODO: where should this be?
			return;
		}

		this.sendQueue.insert(event);
	}

	async postWithFetch(file: TFile) {
		// TODO: maybe get maxTimestamp from server
		const content = await this.plugin.app.vault.cachedRead(file);
		return webhookObsidian({
			events: [
				{
					event: "create",
					doc: {
						path: file.path,
						content: content,
						created_at: new Date(file.stat.ctime).toISOString(),
						updated_at: new Date(file.stat.mtime).toISOString(),
						vault: this.plugin.app.vault.getName(),
					},
				},
			],
			token: this.plugin.settings.secretKey,
		}).then((resp) => {
			if (resp.status !== 200) {
				// TODO: analyze response; e.g. in case of 403, suggest to renew token
				throw new Error(`${resp.status} ${resp.data.detail}`);
			}
			console.log("Posted file", file.path);
			return resp;
		});
	}
}
