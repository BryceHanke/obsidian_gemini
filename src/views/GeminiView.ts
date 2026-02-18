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
    sendBtn: ButtonComponent;

    // State
    currentGem: string = 'Default';
    currentGem2: string = 'Default'; // For synthesis mode
    isSynthesisMode: boolean = false;
    isSearchEnabled: boolean = false;
    attachments: Attachment[] = [];

    // UI Elements
    toolbar: HTMLElement;
    attachmentList: HTMLElement;
    fileInput: HTMLInputElement;
    searchBtn: ButtonComponent;
    synthesisBtn: ButtonComponent;
    gemSelector1: DropdownComponent;
    gemSelector2: DropdownComponent;

    constructor(leaf: WorkspaceLeaf, plugin: GeminiWin95Plugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_GEMINI;
    }

    getDisplayText() {
        return "Gemini Chat";
    }

    getIcon() {
        return "message-square";
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass("gemini-view-container");

        // Toolbar
        this.toolbar = container.createEl("div", { cls: "gemini-toolbar" });
        this.createToolbar();

        // Chat History Area
        this.chatHistory = container.createEl("div", { cls: "gemini-chat-history" });

        // Attachment List
        this.attachmentList = container.createEl("div", { cls: "gemini-attachments" });

        // Input Area
        const inputArea = container.createEl("div", { cls: "gemini-input-area" });
        this.inputField = inputArea.createEl("textarea", { cls: "gemini-input", attr: { placeholder: "Type a message..." } });

        const sendBtnContainer = inputArea.createEl("div", { cls: "gemini-send-btn" });
        this.sendBtn = new ButtonComponent(sendBtnContainer)
            .setIcon("send")
            .setCta()
            .onClick(() => this.sendMessage());

        // File Input (Hidden)
        this.fileInput = container.createEl("input", { type: "file", attr: { multiple: "multiple", style: "display: none;" } });
        this.fileInput.addEventListener("change", (e) => this.handleFileUpload(e));

        // Event Listeners
        this.inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    createToolbar() {
        this.toolbar.empty();

        // Gem Selector 1
        this.gemSelector1 = new DropdownComponent(this.toolbar);
        this.populateGemSelector(this.gemSelector1);
        this.gemSelector1.setValue(this.currentGem);
        this.gemSelector1.onChange(async (value) => {
            this.currentGem = value;
            this.handleGemChange(value);
        });

        // Gem Selector 2 (Hidden by default)
        this.gemSelector2 = new DropdownComponent(this.toolbar);
        this.populateGemSelector(this.gemSelector2);
        this.gemSelector2.setValue(this.currentGem2);
        this.gemSelector2.onChange(async (value) => {
            this.currentGem2 = value;
        });

        // Hide Gem 2 initially if not in synthesis mode
        if (!this.isSynthesisMode) {
            this.gemSelector2.selectEl.style.display = 'none';
        }

        // Synthesis Mode Toggle
        this.synthesisBtn = new ButtonComponent(this.toolbar)
            .setIcon("users")
            .setTooltip("Toggle Synthesis Mode")
            .onClick(() => this.toggleSynthesis());
        this.synthesisBtn.buttonEl.addClass("gemini-toolbar-btn");
        this.updateSynthesisButton();

        // Search Toggle
        this.searchBtn = new ButtonComponent(this.toolbar)
            .setIcon("globe")
            .setTooltip("Toggle Google Search")
            .onClick(() => this.toggleSearch());
        this.searchBtn.buttonEl.addClass("gemini-toolbar-btn");
        this.updateSearchButton();

        // Upload Button
        const uploadBtn = new ButtonComponent(this.toolbar)
            .setIcon("paperclip")
            .setTooltip("Upload File")
            .onClick(() => this.fileInput.click());
        uploadBtn.buttonEl.addClass("gemini-toolbar-btn");
    }

    populateGemSelector(dropdown: DropdownComponent) {
        dropdown.addOption("Default", "Default");
        dropdown.addOption("Guided Learning", "Guided Learning");
        dropdown.addOption("Deep Research", "Deep Research");
        dropdown.addOption("Image Generation", "Image Generation");

        // Add custom Gems
        this.plugin.settings.savedGems.forEach(gem => {
            dropdown.addOption(gem.name, gem.name);
        });
    }

    handleGemChange(value: string) {
        if (value === 'Deep Research') {
            this.isSearchEnabled = true;
            this.updateSearchButton();
        }
    }

    toggleSynthesis() {
        this.isSynthesisMode = !this.isSynthesisMode;
        this.updateSynthesisButton();

        if (this.isSynthesisMode) {
            this.gemSelector2.selectEl.style.display = 'block';
        } else {
            this.gemSelector2.selectEl.style.display = 'none';
        }
    }

    updateSynthesisButton() {
         if (this.isSynthesisMode) {
            this.synthesisBtn.buttonEl.addClass("active");
        } else {
            this.synthesisBtn.buttonEl.removeClass("active");
        }
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
            const pill = this.attachmentList.createEl("div", { cls: "gemini-attachment-pill" });
            pill.createEl("span", { text: att.name });
            const delBtn = pill.createEl("span", { cls: "gemini-attachment-close", text: " ×" });
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
        if (!message && this.attachments.length === 0) return;

        this.appendMessage("User", message, "user", this.attachments);
        this.inputField.value = "";

        const currentAttachments = [...this.attachments];
        this.attachments = [];
        this.renderAttachments();

        try {
            const response = await this.callGeminiApi(message, currentAttachments);

            if (response.startsWith("data:image/")) {
                this.appendImage("Gemini", response);
            } else {
                this.appendMessage("Gemini", response, "gemini");
            }
        } catch (error) {
            this.appendMessage("System", "Error: " + error.message, "system");
        }
    }

    appendMessage(sender: string, text: string, type: string, attachments: Attachment[] = []) {
        const messageEl = this.chatHistory.createEl("div", { cls: `gemini-message ${type}` });

        if (type !== 'system') {
            messageEl.createEl("span", { cls: "gemini-message-sender", text: sender });
        }

        if (text) {
            // Simple newline to break conversion
            const content = text.split('\n').map(line => document.createTextNode(line));
            content.forEach((node, i) => {
                 if (i > 0) messageEl.createEl("br");
                 messageEl.appendChild(node);
            });
        }

        if (attachments.length > 0) {
            const attContainer = messageEl.createEl("div", { cls: "gemini-message-attachments" });
            attachments.forEach(att => {
                if (att.mimeType.startsWith("image/")) {
                    attContainer.createEl("img", { attr: { src: `data:${att.mimeType};base64,${att.data}`, width: "200" } });
                } else {
                    attContainer.createEl("div", { text: `[File: ${att.name}]` });
                }
            });
        }

        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    appendImage(sender: string, base64Image: string) {
        const messageEl = this.chatHistory.createEl("div", { cls: "gemini-message gemini" });
        messageEl.createEl("span", { cls: "gemini-message-sender", text: sender });
        messageEl.createEl("img", { attr: { src: base64Image } });
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    getGemInstruction(gemName: string): string {
        if (gemName === 'Default') return "";
        if (gemName === 'Guided Learning') return "You are a helpful and patient tutor. Use Socratic questioning to guide the user to the answer. Explain concepts simply and use analogies.";
        if (gemName === 'Deep Research') return "You are a deep research assistant. Use Google Search to find comprehensive, accurate, and cited information. Break down complex queries into steps.";
        if (gemName === 'Image Generation') return ""; // Handled specially

        const customGem = this.plugin.settings.savedGems.find(g => g.name === gemName);
        return customGem ? customGem.instruction : "";
    }

    async callGeminiApi(prompt: string, attachments: Attachment[]): Promise<string> {
        const apiKey = this.plugin.settings.geminiApiKey;
        if (!apiKey) {
            throw new Error("API Key not set.");
        }

        // Image Generation Mode (Only if Primary Gem is Image Generation, Synthesis not supported for Image Gen)
        if (this.currentGem === 'Image Generation' && !this.isSynthesisMode) {
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

        // Tools setup
        let tools = [];
        let systemInstructionText = "";

        if (this.isSynthesisMode) {
            const instr1 = this.getGemInstruction(this.currentGem);
            const instr2 = this.getGemInstruction(this.currentGem2);

            systemInstructionText = `You are acting as a synthesis of two personas.
Persona 1: ${instr1 || "Default Assistant"}
Persona 2: ${instr2 || "Default Assistant"}

Synthesize these perspectives to answer the user.`;

            // Enable search if either gem is Deep Research or search is manually toggled
            if (this.currentGem === 'Deep Research' || this.currentGem2 === 'Deep Research' || this.isSearchEnabled) {
                tools.push({ google_search: {} });
            }

        } else {
            systemInstructionText = this.getGemInstruction(this.currentGem);

             if (this.currentGem === 'Deep Research' || this.isSearchEnabled) {
                tools.push({ google_search: {} });
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
