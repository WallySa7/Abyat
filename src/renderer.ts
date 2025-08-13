import { App, MarkdownPostProcessorContext } from "obsidian";
import { AbyatPoem, AbyatVerse } from "./types";
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
		this.addVerseParts(verseElement, verse, poem.annotations || {});

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
		annotations: Record<string, string>
	): void {
		const sadrElement = document.createElement("div");
		sadrElement.className = "abyat-sadr";

		const ajazElement = document.createElement("div");
		ajazElement.className = "abyat-ajaz";

		// Process text with annotations
		this.renderTextWithAnnotations(verse.sadr, sadrElement, annotations);
		this.renderTextWithAnnotations(verse.ajaz, ajazElement, annotations);

		verseElement.appendChild(sadrElement);
		verseElement.appendChild(ajazElement);
	}

	/**
	 * Render text with word annotations and tooltips
	 */
	private renderTextWithAnnotations(
		text: string,
		container: HTMLElement,
		annotations: Record<string, string>
	): void {
		const words = text.split(" ");

		words.forEach((word, index) => {
			// Add space before each word except the first
			if (index > 0) {
				container.appendChild(document.createTextNode(" "));
			}

			if (annotations[word]) {
				this.createAnnotatedWord(container, word, annotations[word]);
			} else {
				container.appendChild(document.createTextNode(word));
			}
		});
	}

	/**
	 * Create an annotated word with tooltip
	 */
	private createAnnotatedWord(
		container: HTMLElement,
		word: string,
		annotation: string
	): void {
		const wordElement = document.createElement("span");
		wordElement.className = "abyat-annotated";
		wordElement.textContent = word;

		const tooltipElement = document.createElement("div");
		tooltipElement.className = "abyat-tooltip";
		tooltipElement.textContent = annotation;

		wordElement.appendChild(tooltipElement);
		container.appendChild(wordElement);
	}
}
