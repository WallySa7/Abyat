import { App, MarkdownPostProcessorContext } from "obsidian";
import { AbyatPoem, AbyatVerse, AbyatAnnotation } from "./types";
import { AbyatModal } from "./modal";
import { AbyatParser } from "./parser";

/**
 * Renderer class responsible for converting AbyatPoem objects to HTML elements
 * Handles all visual representation and user interactions
 */
export class AbyatRenderer {
	private parser: AbyatParser;

	constructor(private app: App) {
		this.parser = new AbyatParser();
	}

	/**
	 * Main method to render a poem into an HTML element
	 */
	renderPoem(
		poem: AbyatPoem,
		container: HTMLElement,
		context?: MarkdownPostProcessorContext,
		originalSource?: string
	): void {
		container.empty();

		const poemElement = this.createPoemContainer(poem);
		this.addEditButton(poemElement, poem, originalSource);
		this.addPoemHeader(poemElement, poem);
		this.addPoemTags(poemElement, poem);
		this.addPoemVerses(poemElement, poem);

		container.appendChild(poemElement);
	}

	/**
	 * Create the main poem container with appropriate CSS classes
	 */
	private createPoemContainer(poem: AbyatPoem): HTMLElement {
		const container = document.createElement("div");
		container.className = `abyat-container ${poem.size}`;
		return container;
	}

	/**
	 * Add edit button for modifying the poem
	 */
	private addEditButton(
		container: HTMLElement,
		poem: AbyatPoem,
		originalSource?: string
	): void {
		const editButton = document.createElement("div");
		editButton.className = "abyat-edit-btn";
		editButton.textContent = "تعديل";

		const originalMarkdown =
			"```abyat\n" + (originalSource ?? "") + "\n```";

		editButton.addEventListener("click", async () => {
			await this.handleEditButtonClick(poem, originalMarkdown);
		});

		container.appendChild(editButton);
	}

	/**
	 * Handle edit button click event
	 */
	private async handleEditButtonClick(
		poem: AbyatPoem,
		originalMarkdown: string
	): Promise<void> {
		const modal = new AbyatModal(
			this.app,
			async (updatedPoem: AbyatPoem) => {
				await this.updatePoemInFile(updatedPoem, originalMarkdown);
			},
			poem
		);
		modal.open();
	}

	/**
	 * Update poem content in the active file
	 */
	private async updatePoemInFile(
		updatedPoem: AbyatPoem,
		originalMarkdown: string
	): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			console.warn("No active file found");
			return;
		}

		try {
			const fileContent = await this.app.vault.read(activeFile);
			const newMarkdown = this.parser.generatePoemMarkdown(updatedPoem);
			const updatedContent = fileContent.replace(
				originalMarkdown,
				newMarkdown
			);

			if (updatedContent === fileContent) {
				console.warn("Poem block not found for replacement");
				return;
			}

			await this.app.vault.modify(activeFile, updatedContent);
		} catch (error) {
			console.error("Failed to update poem:", error);
		}
	}

	/**
	 * Add poem header (title and poet name) if they exist
	 */
	private addPoemHeader(container: HTMLElement, poem: AbyatPoem): void {
		if (!poem.title && !poem.poet) {
			return;
		}

		const header = document.createElement("div");
		header.className = "abyat-header";

		if (poem.title) {
			const titleElement = document.createElement("div");
			titleElement.className = "abyat-title";
			titleElement.textContent = poem.title;
			header.appendChild(titleElement);
		}

		if (poem.poet) {
			const poetElement = document.createElement("div");
			poetElement.className = "abyat-poet";
			poetElement.textContent = `- ${poem.poet} -`;
			header.appendChild(poetElement);
		}

		container.appendChild(header);
	}

	/**
	 * Add poem tags if they exist
	 */
	private addPoemTags(container: HTMLElement, poem: AbyatPoem): void {
		if (!poem.tags || poem.tags.length === 0) {
			return;
		}

		const tagsContainer = document.createElement("div");
		tagsContainer.className = "abyat-tags-preview";

		poem.tags.forEach((tag) => {
			const tagElement = document.createElement("span");
			tagElement.className = "abyat-tag-preview";
			tagElement.textContent = tag;
			tagsContainer.appendChild(tagElement);
		});

		container.appendChild(tagsContainer);
	}

	/**
	 * Add all poem verses with proper layout and numbering
	 */
	private addPoemVerses(container: HTMLElement, poem: AbyatPoem): void {
		const versesContainer = document.createElement("div");
		versesContainer.className = "abyat-verses";

		poem.verses.forEach((verse, index) => {
			const verseElement = this.createVerseElement(verse, poem, index);
			versesContainer.appendChild(verseElement);
		});

		container.appendChild(versesContainer);
	}

	/**
	 * Create individual verse element
	 */
	private createVerseElement(
		verse: AbyatVerse,
		poem: AbyatPoem,
		verseIndex: number
	): HTMLElement {
		const verseElement = document.createElement("div");
		verseElement.className = `abyat-verse ${poem.layout}`;

		// Add verse number if numbering is enabled
		if (poem.numbered) {
			this.addVerseNumber(verseElement, verseIndex + 1);
		}

		// Add verse parts (صدر and عجز)
		this.addVerseParts(
			verseElement,
			verse,
			poem.annotations || [],
			verseIndex
		);

		return verseElement;
	}

	/**
	 * Add verse number element
	 */
	private addVerseNumber(
		verseElement: HTMLElement,
		verseNumber: number
	): void {
		const numberElement = document.createElement("div");
		numberElement.className = "abyat-verse-number";
		numberElement.textContent = verseNumber.toString();
		verseElement.appendChild(numberElement);
	}

	/**
	 * Add sadr (صدر) and ajaz (عجز) parts of the verse
	 */
	private addVerseParts(
		verseElement: HTMLElement,
		verse: AbyatVerse,
		annotations: AbyatAnnotation[],
		verseIndex: number
	): void {
		const sadrElement = document.createElement("div");
		sadrElement.className = "abyat-sadr";

		const ajazElement = document.createElement("div");
		ajazElement.className = "abyat-ajaz";

		// Process text with annotations
		this.renderTextWithAnnotations(
			verse.sadr,
			sadrElement,
			annotations,
			verseIndex,
			"sadr"
		);
		this.renderTextWithAnnotations(
			verse.ajaz,
			ajazElement,
			annotations,
			verseIndex,
			"ajaz"
		);

		verseElement.appendChild(sadrElement);
		verseElement.appendChild(ajazElement);
	}

	/**
	 * Render text with word/phrase annotations and tooltips
	 */
	private renderTextWithAnnotations(
		text: string,
		container: HTMLElement,
		annotations: AbyatAnnotation[],
		verseIndex: number,
		part: "sadr" | "ajaz"
	): void {
		if (!text) return;

		// Get annotations for this specific text
		const relevantAnnotations = annotations.filter(
			(ann) => ann.verseIndex === verseIndex && ann.part === part
		);

		// Sort annotations by start position
		relevantAnnotations.sort((a, b) => a.startPos - b.startPos);

		let lastPos = 0;

		// Process text with annotations
		relevantAnnotations.forEach((ann) => {
			// Add text before annotation
			if (ann.startPos > lastPos) {
				const beforeText = text.substring(lastPos, ann.startPos);
				container.appendChild(document.createTextNode(beforeText));
			}

			// Add annotated text with tooltip
			this.createAnnotatedElement(container, ann.text, ann.annotation);

			lastPos = ann.endPos;
		});

		// Add remaining text after last annotation
		if (lastPos < text.length) {
			const remainingText = text.substring(lastPos);
			container.appendChild(document.createTextNode(remainingText));
		}

		// If no annotations, just add the plain text
		// if (relevantAnnotations.length === 0) {
		// 	container.appendChild(document.createTextNode(text));
		// }
	}

	/**
	 * Create an annotated element (word or phrase) with tooltip
	 */
	private createAnnotatedElement(
		container: HTMLElement,
		text: string,
		annotation: string
	): void {
		const annotatedElement = document.createElement("span");
		annotatedElement.className = "abyat-annotated abyat-phrase-annotation";
		annotatedElement.textContent = text;

		// Create tooltip
		const tooltipElement = document.createElement("div");
		tooltipElement.className = "abyat-tooltip";
		tooltipElement.textContent = annotation;

		annotatedElement.appendChild(tooltipElement);
		container.appendChild(annotatedElement);
	}
}
