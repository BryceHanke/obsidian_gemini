import { App, PluginSettingTab, Setting } from 'obsidian';
import type GeminiWin95Plugin from './main';

export interface GeminiWin95Settings {
	geminiApiKey: string;
	geminiModel: string;
}

export const DEFAULT_SETTINGS: GeminiWin95Settings = {
	geminiApiKey: '',
	geminiModel: 'gemini-1.5-flash'
}

export class GeminiWin95SettingTab extends PluginSettingTab {
	plugin: GeminiWin95Plugin;

	constructor(app: App, plugin: GeminiWin95Plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Gemini API Key')
			.setDesc('Enter your Google Gemini API key here.')
			.addText(text => text
				.setPlaceholder('Enter your key')
				.setValue(this.plugin.settings.geminiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Gemini Model Name')
			.setDesc('Enter the model name to use (e.g., gemini-1.5-flash).')
			.addText(text => text
				.setPlaceholder('gemini-1.5-flash')
				.setValue(this.plugin.settings.geminiModel)
				.onChange(async (value) => {
					this.plugin.settings.geminiModel = value;
					await this.plugin.saveSettings();
				}));
	}
}
