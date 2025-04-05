import {
	App,
	normalizePath,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
} from "obsidian";
import { FileTracker } from "./src/file_tracker";
import { setBaseUrl } from "./src/api/custom-fetch";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	secretKey: string;
	baseUrl: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	secretKey: "default",
	baseUrl: "http://localhost:4002",
};

export default class ObsidianPushPlugin extends Plugin {
	settings: MyPluginSettings;
	maxTimestamp: number;
	fileTracker = new FileTracker(this);
	layoutReady = false;

	async onload() {
		await this.loadSettings();
		setBaseUrl(this.settings.baseUrl);
		this.maxTimestamp = await this.loadTimestamp();
		this.fileTracker.setMaxTimestamp(this.maxTimestamp);

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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MainSettingTab(this.app, this));

		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// // Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });
		//

		// TODO: probably need to use this:
		// // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		const handleCreate = (file: TAbstractFile) => {
			// note this also gets called on Obsidian startup
			if (file instanceof TFile) {
				if (this.layoutReady) {
					this.fileTracker.onCreate(file);
				} else {
					this.fileTracker.registerFile(file);
				}
			}
		};
		this.registerEvent(this.app.vault.on("create", handleCreate));

		const handleModify = (file: TAbstractFile) => {
			// note this also gets called when a file is created
			// console.log(`modified file: ${file.path}`);
			// console.log(
			// 	`active editor file path: ${this.app.workspace.activeEditor?.file?.path}`,
			// );
			if (file instanceof TFile) {
				this.fileTracker.onModify(file);
			}
		};
		this.registerEvent(this.app.vault.on("modify", handleModify));

		this.app.workspace.onLayoutReady(() => {
			this.layoutReady = true;
			this.fileTracker.startSendLoop();
		});

		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				if (file instanceof TFile) {
					this.fileTracker.onDelete(file);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on(
				"rename",
				(file: TAbstractFile, oldPath: string) => {
					if (file instanceof TFile) {
						this.fileTracker.onRename(file, oldPath);
					}
				},
			),
		);
	}

	private async loadTimestamp() {
		// TODO: subfolder like "data"
		const jsonContents = await this.loadFile("timestamp.json");
		if (jsonContents) {
			// TODO: zod
			const data = JSON.parse(jsonContents);
			console.log("timestamp file", data);
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
		// TODO: consider storing outside of plugin folder since removing plugin
		//  will remove this file
		await this.storeFile(
			"timestamp.json",
			JSON.stringify({ timestamp: this.maxTimestamp + 1 }),
		);
	}

	isNewerThanTimestamp(mtime: number) {
		return mtime > this.maxTimestamp;
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

class MainSettingTab extends PluginSettingTab {
	plugin: ObsidianPushPlugin;

	constructor(app: App, plugin: ObsidianPushPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Secret key")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.secretKey)
					.onChange(async (value) => {
						this.plugin.settings.secretKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Host URL")
			.setDesc("Target host URL")
			.addText((text) =>
				text
					// .setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
