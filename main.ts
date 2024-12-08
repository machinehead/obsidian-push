import { normalizePath, Plugin, TAbstractFile, TFile } from "obsidian";
import { MinHeap } from "@datastructures-js/heap";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

interface IFileEvent {
	file: TFile;
	event_name: string;
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	fileHeap: MinHeap<IFileEvent> = new MinHeap<IFileEvent>(
		(e) => e.file.stat.mtime,
	);
	maxTimestamp: number;

	async onload() {
		await this.loadSettings();
		this.maxTimestamp = await this.loadTimestamp();

		// // This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });
		// // Perform additional things with the ribbon
		// ribbonIconEl.addClass('my-plugin-ribbon-class');
		//
		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');
		//
		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}
		//
		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });
		//
		// // This adds a settings tab so the user can configure various aspects of the plugin
		// this.addSettingTab(new SampleSettingTab(this.app, this));
		//
		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// // Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });
		//
		// // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		const handleCreate = (file: TAbstractFile) => {
			console.log(`created a new file: ${file.path}`);
			if (file instanceof TFile) {
				this.fileHeap.insert({ file, event_name: "create" });
			}
		};

		const handleModify = (file: TAbstractFile) => {
			// note this also gets called when a file is created
			console.log(`modified file: ${file.path}`);
			if (file instanceof TFile) {
				this.fileHeap.insert({ file, event_name: "modify" });
			}
		};

		this.app.workspace.onLayoutReady(() => {
			this.postFileLoop();
		});

		this.registerEvent(this.app.vault.on("create", handleCreate));

		this.registerEvent(this.app.vault.on("modify", handleModify));

		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				console.log(`deleted file: ${file.path}`);
				// TODO: send to server
			}),
		);

		this.registerEvent(
			this.app.vault.on(
				"rename",
				(file: TAbstractFile, oldPath: string) => {
					console.log(`renamed file: ${file.path} from ${oldPath}`);
					// TODO: send to server
				},
			),
		);
	}

	async postFileLoop() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const fileEvent = this.fileHeap.pop();
			if (fileEvent) {
				const { file, event_name } = fileEvent;
				if (file.stat.mtime >= this.maxTimestamp) {
					await this.postFile(file, event_name);
					await this.updateTimestamp(file.stat.mtime);
				}
			} else {
				await sleep(1000);
			}
		}
	}

	async postFile(file: TFile, event_name: string) {
		if (file.extension !== "md") {
			return;
		}
		try {
			const content = await this.app.vault.cachedRead(file);
			// TODO: maybe get maxTimestamp from server
			await fetch("https://api2.lifedash.link/webhook/obsidian", {
				method: "POST",
				mode: "no-cors",
				body: JSON.stringify({
					path: file.path,
					content: content,
					ctime: file.stat.ctime,
					mtime: file.stat.mtime,
					vault: this.app.vault.getName(),
					event_name: event_name,
				}),
			});
		} catch (e) {
			// do nothing
		}
	}

	private async loadTimestamp() {
		// TODO: subfolder like "data"
		const jsonContents = await this.loadFile("timestamp.json");
		if (jsonContents) {
			// TODO: zod
			const data = JSON.parse(jsonContents);
			console.log(data);
			return data.timestamp;
		}
		return 0;
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async storeFile(fileName: string, content: string) {
		// Store a file in the plugin's folder

		// Get the plugin's folder path
		const pluginFolderPath = normalizePath(
			this.app.vault.configDir + "/plugins/" + this.manifest.id,
		);

		// Ensure the plugin folder exists
		await this.app.vault.adapter.mkdir(pluginFolderPath);

		// Create the file path
		const filePath = normalizePath(pluginFolderPath + "/" + fileName);

		// Write the file
		await this.app.vault.adapter.write(filePath, content);
	}

	async loadFile(fileName: string) {
		// Load a file from the plugin's folder

		// Get the plugin's folder path
		const pluginFolderPath = normalizePath(
			this.app.vault.configDir + "/plugins/" + this.manifest.id,
		);

		// Create the file path
		const filePath = normalizePath(pluginFolderPath + "/" + fileName);

		if (!(await this.app.vault.adapter.exists(filePath))) {
			// File doesn't exist
			return;
		}

		// Read the file
		return this.app.vault.adapter.read(filePath);
	}

	async updateTimestamp(mtime: number) {
		this.maxTimestamp = Math.max(this.maxTimestamp, mtime);
		await this.storeFile(
			"timestamp.json",
			JSON.stringify({ timestamp: this.maxTimestamp + 1 }),
		);
	}
}

// class SampleModal extends Modal {
// 	constructor(app: App) {
// 		super(app);
// 	}
//
// 	onOpen() {
// 		const {contentEl} = this;
// 		contentEl.setText('Woah!');
// 	}
//
// 	onClose() {
// 		const {contentEl} = this;
// 		contentEl.empty();
// 	}
// }

// class SampleSettingTab extends PluginSettingTab {
// 	plugin: MyPlugin;
//
// 	constructor(app: App, plugin: MyPlugin) {
// 		super(app, plugin);
// 		this.plugin = plugin;
// 	}
//
// 	display(): void {
// 		const {containerEl} = this;
//
// 		containerEl.empty();
//
// 		new Setting(containerEl)
// 			.setName('Setting #1')
// 			.setDesc('It\'s a secret')
// 			.addText(text => text
// 				.setPlaceholder('Enter your secret')
// 				.setValue(this.plugin.settings.mySetting)
// 				.onChange(async (value) => {
// 					this.plugin.settings.mySetting = value;
// 					await this.plugin.saveSettings();
// 				}));
// 	}
// }
