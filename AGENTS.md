# AGENTS.md

## 1. Project Architecture & Mental Model
* **Type:** Obsidian Plugin (TypeScript).
* **Core Technology:** Obsidian API (`obsidian` package), TypeScript, Esbuild.
* **Structure:**
    * Entry point: `main.ts` (extends `Plugin`).
    * Views: `src/views/` (extends `ItemView` for the sidebar).
    * Settings: `src/settings.ts` (extends `PluginSettingTab`).
* **Mental Model:** The plugin runs within the Electron renderer process. We must respect Obsidian's lifecycle management (onload, onunload).

## 2. Environment Setup
* **Install:** `npm install` (Use `npm` as standard for Obsidian samples, but ensure lockfile consistency).
* **Build:** `npm run build`.
* **Dev:** `npm run dev` (watches for changes).
* **Verification:** The build must produce `main.js`, `manifest.json`, and `styles.css` in the root or target folder.

## 3. Coding Standards ("The Vibe")
* **Naming:** CamelCase for functions, PascalCase for Classes.
* **Styling:** Use Obsidian's native CSS variables (e.g., `--background-primary`, `--text-normal`) to support light/dark mode automatically. Do NOT hardcode colors.
* **DOM Construction:** Prefer `containerEl.createEl()` over `innerHTML` to prevent XSS and ensure performance.
* **Async:** Use `async/await` for all file operations and network requests (Gemini API).

## 4. Constraints & Safety
* **Secrets:** NEVER commit API keys. [cite_start]Use the `PluginSettingTab` to allow the user to input their Gemini API key and store it in `this.data`. [cite: 57]
* **Dependencies:** Do NOT add heavy UI frameworks (React/Vue) unless strictly necessary. Use native Obsidian DOM methods for this sidebar.
* **Scope:** Do not modify `manifest.json` versions manually; rely on the release script or explicit instruction.