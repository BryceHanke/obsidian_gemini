import { ItemView, WorkspaceLeaf, requestUrl } from "obsidian";
import type GeminiWin95Plugin from "../main";

export const VIEW_TYPE_GEMINI = "gemini-win95-view";

export class GeminiView extends ItemView {
    plugin: GeminiWin95Plugin;
    chatHistory: HTMLElement;
    inputField: HTMLTextAreaElement;
    sendBtn: HTMLButtonElement;

    constructor(leaf: WorkspaceLeaf, plugin: GeminiWin95Plugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_GEMINI;
    }

    getDisplayText() {
        return "Gemini Win95 Chat";
    }

    getIcon() {
        return "message-square";
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass("gemini-win95-container");

        // Create main layout
        const chatWindow = container.createEl("div", { cls: "win95-window" });

        // Title Bar
        const titleBar = chatWindow.createEl("div", { cls: "win95-title-bar" });
        titleBar.createEl("div", { cls: "win95-title-bar-text", text: "Gemini Chat" });
        const controls = titleBar.createEl("div", { cls: "win95-title-bar-controls" });
        controls.createEl("button", { ariaLabel: "Minimize" }).createEl("span", { text: "_" });
        controls.createEl("button", { ariaLabel: "Maximize" }).createEl("span", { text: "□" });
        const closeBtn = controls.createEl("button", { ariaLabel: "Close" });
        closeBtn.createEl("span", { text: "×" });

        // Chat History Area
        this.chatHistory = chatWindow.createEl("div", { cls: "win95-chat-history" });

        // Input Area
        const inputArea = chatWindow.createEl("div", { cls: "win95-input-area" });
        this.inputField = inputArea.createEl("textarea", { cls: "win95-input", attr: { placeholder: "Type a message..." } });
        this.sendBtn = inputArea.createEl("button", { cls: "win95-btn", text: "Send" });

        // Event Listeners
        this.sendBtn.addEventListener("click", () => this.sendMessage());
        this.inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async onClose() {
        // cleanup
    }

    async sendMessage() {
        const message = this.inputField.value.trim();
        if (!message) return;

        this.appendMessage("User", message);
        this.inputField.value = "";

        try {
            const response = await this.callGeminiApi(message);
            this.appendMessage("Gemini", response);
        } catch (error) {
            this.appendMessage("System", "Error: " + error.message);
        }
    }

    appendMessage(sender: string, text: string) {
        const messageEl = this.chatHistory.createEl("div", { cls: "win95-message" });
        messageEl.createEl("strong", { text: sender + ": " });
        messageEl.createEl("span", { text: text });
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    async callGeminiApi(prompt: string): Promise<string> {
        const apiKey = this.plugin.settings.geminiApiKey;
        if (!apiKey) {
            throw new Error("API Key not set.");
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.plugin.settings.geminiModel}:generateContent?key=${apiKey}`;

        const response = await requestUrl({
            url: url,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (response.status >= 400) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = response.json;
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return "No response from Gemini.";
        }
    }
}
