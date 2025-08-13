import { Plugin, MarkdownPostProcessorContext } from "obsidian";
import { AbyatModal } from "./src/modal";
import { AbyatPoem } from "./src/types";
import { AbyatRenderer } from "./src/renderer";
import { AbyatParser } from "./src/parser";

/**
 * Abyat Plugin - For displaying Arabic poetry in Obsidian
 *
 * This plugin allows users to insert and display Arabic poems (أبيات) with:
 * - Side-by-side or stacked verse layouts
 * - Word annotations and tooltips
 * - Different sizing options
 * - Verse numbering
 * - RTL text support
 */
export default class AbyatPlugin extends Plugin {
	private renderer: AbyatRenderer;
	private parser: AbyatParser;

	async onload() {
		// Initialize components
		this.renderer = new AbyatRenderer(this.app);
		this.parser = new AbyatParser();

		// Register plugin commands
		this.registerCommands();

		// Register markdown processors
		this.registerMarkdownProcessors();
	}

	/**
	 * Register plugin commands in Obsidian command palette
	 */
	private registerCommands(): void {
		this.addCommand({
			id: "insert-arabic-poem",
			name: "Insert Arabic Poem",
			editorCallback: (editor, view) => {
				const modal = new AbyatModal(this.app, (poem: AbyatPoem) => {
					const poemMarkdown = this.parser.generatePoemMarkdown(poem);
					editor.replaceSelection(poemMarkdown);
				});
				modal.open();
			},
		});
	}

	/**
	 * Register markdown post processors to handle poem rendering
	 */
	private registerMarkdownProcessors(): void {
		// Handle inline code blocks with ```abyat
		this.registerMarkdownPostProcessor((element, context) => {
			const codeBlocks = element.querySelectorAll("code");

			codeBlocks.forEach((codeBlock) => {
				const text = codeBlock.innerText.trim();
				if (text.startsWith("```abyat")) {
					this.renderInlinePoem(codeBlock, text, context);
				}
			});
		});

		// Handle dedicated abyat code blocks
		this.registerMarkdownCodeBlockProcessor(
			"abyat",
			(source, element, context) => {
				this.renderCodeBlockPoem(source, element, context);
			}
		);
	}

	/**
	 * Render poem from inline code block (```abyat format)
	 */
	private renderInlinePoem(
		codeBlock: HTMLElement,
		text: string,
		context: MarkdownPostProcessorContext
	): void {
		const source = text.replace(/^```abyat\n/, "").replace(/\n```$/, "");

		const poem = this.parser.parsePoem(source);
		const container = document.createElement("div");

		this.renderer.renderPoem(poem, container, context, source);
		codeBlock.replaceWith(container);
	}

	/**
	 * Render poem from dedicated code block
	 */
	private renderCodeBlockPoem(
		source: string,
		element: HTMLElement,
		context: MarkdownPostProcessorContext
	): void {
		const poem = this.parser.parsePoem(source);
		this.renderer.renderPoem(poem, element, context, source);
	}
}
