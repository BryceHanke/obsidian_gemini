import { ItemView, WorkspaceLeaf, requestUrl, ButtonComponent, DropdownComponent, setIcon } from "obsidian";
import type GeminiWin95Plugin from "../main";

export const VIEW_TYPE_GEMINI = "gemini-win95-view";

interface Attachment {
    name: string;
    data: string; // Base64
    mimeType: string;
}

export class GeminiView extends ItemView {
    plugin: GeminiWin95Plugin;
    chatHistory: HTMLElement;
    inputField: HTMLTextAreaElement;
    sendBtn: HTMLButtonElement;

    // State
    currentGem: string = 'Default';
    isSearchEnabled: boolean = false;
    attachments: Attachment[] = [];

    // UI Elements
    toolbar: HTMLElement;
    attachmentList: HTMLElement;
    fileInput: HTMLInputElement;
    searchBtn: ButtonComponent;

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

        // Toolbar
        this.toolbar = chatWindow.createEl("div", { cls: "win95-toolbar" });
        this.createToolbar();

        // Chat History Area
        this.chatHistory = chatWindow.createEl("div", { cls: "win95-chat-history" });

        // Attachment List
        this.attachmentList = chatWindow.createEl("div", { cls: "win95-attachment-list" });

        // Input Area
        const inputArea = chatWindow.createEl("div", { cls: "win95-input-area" });
        this.inputField = inputArea.createEl("textarea", { cls: "win95-input", attr: { placeholder: "Type a message..." } });
        this.sendBtn = inputArea.createEl("button", { cls: "win95-btn", text: "Send" });

        // File Input (Hidden)
        this.fileInput = container.createEl("input", { type: "file", attr: { multiple: "multiple", style: "display: none;" } });
        this.fileInput.addEventListener("change", (e) => this.handleFileUpload(e));

        // Event Listeners
        this.sendBtn.addEventListener("click", () => this.sendMessage());
        this.inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    createToolbar() {
        // Gem Selector
        const gemSelector = new DropdownComponent(this.toolbar);
        gemSelector.addOption("Default", "Default");
        gemSelector.addOption("Guided Learning", "Guided Learning");
        gemSelector.addOption("Deep Research", "Deep Research");
        gemSelector.addOption("Image Generation", "Image Generation");

        // Add custom Gems
        this.plugin.settings.savedGems.forEach(gem => {
            gemSelector.addOption(gem.name, gem.name);
        });

        gemSelector.setValue(this.currentGem);
        gemSelector.onChange(async (value) => {
            this.currentGem = value;
            // Update UI/State based on Gem?
            if (value === 'Deep Research') {
                this.isSearchEnabled = true;
                this.updateSearchButton();
            }
        });

        // Separator
        this.toolbar.createEl("span", { text: "|", cls: "win95-separator" });

        // Upload Button
        const uploadBtn = new ButtonComponent(this.toolbar)
            .setIcon("upload")
            .setTooltip("Upload File")
            .onClick(() => this.fileInput.click());
        uploadBtn.buttonEl.addClass("win95-toolbar-btn");

        // Search Toggle
        this.searchBtn = new ButtonComponent(this.toolbar)
            .setIcon("globe")
            .setTooltip("Toggle Google Search")
            .onClick(() => this.toggleSearch());
        this.searchBtn.buttonEl.addClass("win95-toolbar-btn");
        this.updateSearchButton();
    }

    toggleSearch() {
        this.isSearchEnabled = !this.isSearchEnabled;
        this.updateSearchButton();
    }

    updateSearchButton() {
        if (this.isSearchEnabled) {
            this.searchBtn.buttonEl.addClass("active");
        } else {
            this.searchBtn.buttonEl.removeClass("active");
        }
    }

    async handleFileUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.files) {
            for (let i = 0; i < target.files.length; i++) {
                const file = target.files[i];
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        const base64 = (e.target.result as string).split(",")[1];
                        this.attachments.push({
                            name: file.name,
                            data: base64,
                            mimeType: file.type
                        });
                        this.renderAttachments();
                    }
                };
                reader.readAsDataURL(file);
            }
        }
        // Reset input
        target.value = "";
    }

    renderAttachments() {
        this.attachmentList.empty();
        this.attachments.forEach((att, index) => {
            const pill = this.attachmentList.createEl("div", { cls: "win95-attachment-pill" });
            pill.createEl("span", { text: att.name });
            const delBtn = pill.createEl("span", { cls: "win95-close-btn", text: "x" });
            delBtn.addEventListener("click", () => {
                this.attachments.splice(index, 1);
                this.renderAttachments();
            });
        });
    }

    async onClose() {
        // cleanup
    }

    async sendMessage() {
        const message = this.inputField.value.trim();
        // Allow sending if there are attachments even if message is empty (e.g. "describe this")
        if (!message && this.attachments.length === 0) return;

        this.appendMessage("User", message, this.attachments);
        this.inputField.value = "";

        // Copy attachments to avoid clearing before sending (though we wait usually)
        const currentAttachments = [...this.attachments];
        this.attachments = [];
        this.renderAttachments();

        try {
            const response = await this.callGeminiApi(message, currentAttachments);

            // Check if response is an image (Base64) or text
            if (response.startsWith("data:image/")) {
                this.appendImage("Gemini", response);
            } else {
                this.appendMessage("Gemini", response);
            }
        } catch (error) {
            this.appendMessage("System", "Error: " + error.message);
        }
    }

    appendMessage(sender: string, text: string, attachments: Attachment[] = []) {
        const messageEl = this.chatHistory.createEl("div", { cls: "win95-message" });
        messageEl.createEl("strong", { text: sender + ": " });

        if (text) {
            messageEl.createEl("span", { text: text });
        }

        if (attachments.length > 0) {
            const attContainer = messageEl.createEl("div", { cls: "win95-message-attachments" });
            attachments.forEach(att => {
                if (att.mimeType.startsWith("image/")) {
                    attContainer.createEl("img", { attr: { src: `data:${att.mimeType};base64,${att.data}`, width: "100" } });
                } else {
                    attContainer.createEl("span", { text: `[File: ${att.name}]` });
                }
            });
        }

        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    appendImage(sender: string, base64Image: string) {
        const messageEl = this.chatHistory.createEl("div", { cls: "win95-message" });
        messageEl.createEl("strong", { text: sender + ": " });
        messageEl.createEl("br");
        messageEl.createEl("img", { attr: { src: base64Image, style: "max-width: 100%;" } });
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    async callGeminiApi(prompt: string, attachments: Attachment[]): Promise<string> {
        const apiKey = this.plugin.settings.geminiApiKey;
        if (!apiKey) {
            throw new Error("API Key not set.");
        }

        // Image Generation Mode
        if (this.currentGem === 'Image Generation') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

            const response = await requestUrl({
                url: url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt: prompt }]
                })
            });

            if (response.status >= 400) {
                throw new Error(`Imagen API Error: ${response.status} - ${response.text}`);
            }

            const data = response.json;
            if (data.predictions && data.predictions.length > 0 && data.predictions[0].bytesBase64Encoded) {
                return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
            } else {
                return "No image generated.";
            }
        }

        // Standard Chat / Multimodal Mode
        let model = this.plugin.settings.geminiModel;

        // Deep Research (forces Google Search)
        let tools = [];
        let systemInstructionText = "";

        if (this.currentGem === 'Deep Research') {
            tools.push({ google_search: {} });
            systemInstructionText = "You are a deep research assistant. Use Google Search to find comprehensive, accurate, and cited information. Break down complex queries into steps.";
            this.isSearchEnabled = true; // Ensure visual toggle matches
            this.updateSearchButton();
        } else if (this.isSearchEnabled) {
            tools.push({ google_search: {} });
        }

        if (this.currentGem === 'Guided Learning') {
            systemInstructionText = "You are a helpful and patient tutor. Use Socratic questioning to guide the user to the answer. Explain concepts simply and use analogies.";
        } else {
            // Check custom gems
            const customGem = this.plugin.settings.savedGems.find(g => g.name === this.currentGem);
            if (customGem) {
                systemInstructionText = customGem.instruction;
            }
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const parts: any[] = [];
        if (prompt) {
            parts.push({ text: prompt });
        }

        attachments.forEach(att => {
            parts.push({
                inline_data: {
                    mime_type: att.mimeType,
                    data: att.data
                }
            });
        });

        const body: any = {
            contents: [{ parts: parts }]
        };

        if (systemInstructionText) {
            body.system_instruction = {
                parts: [{ text: systemInstructionText }]
            };
        }

        if (tools.length > 0) {
            body.tools = tools;
        }

        const response = await requestUrl({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (response.status >= 400) {
            throw new Error(`API Error: ${response.status} - ${response.text}`);
        }

        const data = response.json;
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return "No response from Gemini.";
        }
    }
}
