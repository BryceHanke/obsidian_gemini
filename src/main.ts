import { Plugin, WorkspaceLeaf } from 'obsidian';
import { GeminiWin95Settings, DEFAULT_SETTINGS, GeminiWin95SettingTab } from './settings';
import { GeminiView, VIEW_TYPE_GEMINI } from './views/GeminiView';

export default class GeminiWin95Plugin extends Plugin {
	settings: GeminiWin95Settings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_GEMINI,
			(leaf) => new GeminiView(leaf, this)
		);

		this.addRibbonIcon('message-square', 'Gemini Chat', () => {
			this.activateView();
		});

        this.addCommand({
            id: 'open-gemini-chat',
            name: 'Open Gemini Chat',
            callback: () => {
                this.activateView();
            }
        });

		this.addSettingTab(new GeminiWin95SettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_GEMINI);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_GEMINI, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}
}
