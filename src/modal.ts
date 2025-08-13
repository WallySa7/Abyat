import { App, Modal, Setting, TextComponent, ButtonComponent } from "obsidian";
import { AbyatPoem, AbyatVerse } from "./types";

/**
 * Modal dialog for creating and editing Arabic poems
 * Provides a user-friendly interface with live preview and keyboard shortcuts
 */
export class AbyatModal extends Modal {
	private poem: AbyatPoem;
	private onSubmit: (poem: AbyatPoem) => void;
	private verseInputComponents: Array<{
		sadr: TextComponent;
		ajaz: TextComponent;
	}> = [];
	private previewContainer: HTMLElement;
	private selectedWordForAnnotation: string | null = null;
	private currentVerseIndex: number = 0; // Track current verse for keyboard navigation
	private keyboardHandler: (event: KeyboardEvent) => void;

	constructor(
		app: App,
		onSubmit: (poem: AbyatPoem) => void,
		existingPoem?: AbyatPoem
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.poem = existingPoem || this.createDefaultPoem();

		// Bind keyboard handler
		this.keyboardHandler = this.handleKeyboard.bind(this);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("abyat-modal");
		this.modalEl.addClass("abyat");

		this.setupModalHeader(contentEl);
		const mainContainer = this.setupMainLayout(contentEl);

		const inputColumn = mainContainer.querySelector(
			".abyat-modal-input"
		) as HTMLElement;
		const previewColumn = mainContainer.querySelector(
			".abyat-modal-preview"
		) as HTMLElement;

		this.setupInputColumn(inputColumn);
		this.setupPreviewColumn(previewColumn);
		this.setupModalButtons(contentEl);
		this.setupKeyboardShortcuts();

		this.updatePreview();
		this.focusFirstInput();
	}

	onClose() {
		this.removeKeyboardShortcuts();
		this.contentEl.empty();
	}

	/**
	 * Setup keyboard shortcuts for the modal
	 */
	private setupKeyboardShortcuts(): void {
		// Add global keyboard event listener
		document.addEventListener("keydown", this.keyboardHandler);

		// Add help button and hidden shortcuts hint
		this.addHelpButton();
		this.addKeyboardShortcutsHint();
	}

	/**
	 * Remove keyboard shortcuts when modal closes
	 */
	private removeKeyboardShortcuts(): void {
		document.removeEventListener("keydown", this.keyboardHandler);
	}

	/**
	 * Handle keyboard events
	 */
	private handleKeyboard(event: KeyboardEvent): void {
		// Only handle if modal is open and focused
		if (!this.containerEl.contains(document.activeElement)) {
			return;
		}

		const { ctrlKey, shiftKey, key, altKey } = event;

		// Ctrl+Enter: Submit poem
		if (ctrlKey && key === "Enter") {
			event.preventDefault();
			this.submitPoem();
			return;
		}

		// Escape: Close modal
		if (key === "Escape") {
			event.preventDefault();
			this.close();
			return;
		}

		// Ctrl+N: Add new verse
		if (ctrlKey && key === "n") {
			event.preventDefault();
			this.addNewVerse();
			return;
		}

		// Ctrl+D: Delete current verse
		if (ctrlKey && key === "d" && this.poem.verses.length > 1) {
			event.preventDefault();
			this.deleteVerse(this.currentVerseIndex);
			return;
		}

		// Ctrl+Up: Move verse up
		if (ctrlKey && key === "ArrowUp" && this.currentVerseIndex > 0) {
			event.preventDefault();
			this.moveVerse(this.currentVerseIndex, this.currentVerseIndex - 1);
			this.currentVerseIndex--;
			return;
		}

		// Ctrl+Down: Move verse down
		if (
			ctrlKey &&
			key === "ArrowDown" &&
			this.currentVerseIndex < this.poem.verses.length - 1
		) {
			event.preventDefault();
			this.moveVerse(this.currentVerseIndex, this.currentVerseIndex + 1);
			this.currentVerseIndex++;
			return;
		}

		// Ctrl+1-9: Focus on specific verse
		if (ctrlKey && /^[1-9]$/.test(key)) {
			event.preventDefault();
			const verseIndex = parseInt(key) - 1;
			if (verseIndex < this.poem.verses.length) {
				this.focusOnVerse(verseIndex);
			}
			return;
		}

		// Alt+S: Focus on Sadr input of current verse
		if (altKey && key === "s") {
			event.preventDefault();
			this.focusOnSadr(this.currentVerseIndex);
			return;
		}

		// Alt+A: Focus on Ajaz input of current verse
		if (altKey && key === "a") {
			event.preventDefault();
			this.focusOnAjaz(this.currentVerseIndex);
			return;
		}

		// Tab navigation enhancement
		if (key === "Tab") {
			this.handleTabNavigation(event);
		}
	}

	/**
	 * Enhanced tab navigation between verse inputs
	 */
	private handleTabNavigation(event: KeyboardEvent): void {
		const activeElement = document.activeElement as HTMLElement;

		// Check if we're in a verse input
		if (
			activeElement &&
			activeElement.classList.contains("abyat-verse-text")
		) {
			const isShiftTab = event.shiftKey;
			const isSadr =
				activeElement
					.closest(".abyat-input-group")
					?.querySelector("label")?.textContent === "الصدر:";

			if (!isShiftTab && isSadr) {
				// Tab from Sadr to Ajaz of same verse
				event.preventDefault();
				this.focusOnAjaz(this.currentVerseIndex);
			} else if (!isShiftTab && !isSadr) {
				// Tab from Ajaz to next verse Sadr
				event.preventDefault();
				if (this.currentVerseIndex < this.poem.verses.length - 1) {
					this.focusOnVerse(this.currentVerseIndex + 1);
				} else {
					// If last verse, add new one and focus on it
					this.addNewVerse();
					this.focusOnVerse(this.poem.verses.length - 1);
				}
			} else if (isShiftTab && !isSadr) {
				// Shift+Tab from Ajaz to Sadr of same verse
				event.preventDefault();
				this.focusOnSadr(this.currentVerseIndex);
			} else if (isShiftTab && isSadr && this.currentVerseIndex > 0) {
				// Shift+Tab from Sadr to previous verse Ajaz
				event.preventDefault();
				this.focusOnVerse(this.currentVerseIndex - 1, "ajaz");
			}
		}
	}

	/**
	 * Focus on a specific verse
	 */
	private focusOnVerse(index: number, part: "sadr" | "ajaz" = "sadr"): void {
		if (index >= 0 && index < this.verseInputComponents.length) {
			this.currentVerseIndex = index;
			const component = this.verseInputComponents[index];
			if (part === "sadr") {
				component.sadr.inputEl.focus();
			} else {
				component.ajaz.inputEl.focus();
			}

			// Scroll to verse if needed
			this.scrollToVerse(index);

			// Update preview highlighting
			this.updatePreviewHighlight();
		}
	}

	/**
	 * Focus on Sadr input of specific verse
	 */
	private focusOnSadr(index: number): void {
		this.focusOnVerse(index, "sadr");
	}

	/**
	 * Focus on Ajaz input of specific verse
	 */
	private focusOnAjaz(index: number): void {
		this.focusOnVerse(index, "ajaz");
	}

	/**
	 * Scroll to specific verse in the input area
	 */
	private scrollToVerse(index: number): void {
		const versesContainer = this.contentEl.querySelector(
			".abyat-verses-container"
		) as HTMLElement;
		const verseElements =
			versesContainer.querySelectorAll(".abyat-verse-input");

		if (verseElements[index]) {
			verseElements[index].scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}

		const previewContainer = this.contentEl.querySelector(
			".abyat-modal-preview"
		) as HTMLElement;
		const previewVerses = previewContainer?.querySelectorAll(
			".abyat-verse-preview"
		);

		if (previewVerses[index]) {
			previewVerses[index].scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}
	}

	/**
	 * Focus on first input when modal opens
	 */
	private focusFirstInput(): void {
		if (this.verseInputComponents.length > 0) {
			setTimeout(() => {
				this.focusOnVerse(0);
			}, 100);
		}
	}

	/**
	 * Submit poem (wrapper for keyboard shortcut)
	 */
	private submitPoem(): void {
		this.onSubmit(this.poem);
		this.close();
	}

	/**
	 * Add help button to toggle keyboard shortcuts
	 */
	private addHelpButton(): void {
		const helpButton = this.contentEl.createDiv({
			cls: "abyat-help-button",
		});
		helpButton.innerHTML = "؟"; // Arabic question mark
		helpButton.title = "عرض اختصارات لوحة المفاتيح";

		helpButton.addEventListener("click", () => {
			this.toggleKeyboardHints();
		});
	}

	/**
	 * Toggle keyboard shortcuts hint visibility
	 */
	private toggleKeyboardHints(): void {
		const hintsContainer = this.contentEl.querySelector(
			".abyat-keyboard-hints"
		) as HTMLElement;
		if (hintsContainer) {
			const isVisible = hintsContainer.style.display !== "none";
			hintsContainer.style.display = isVisible ? "none" : "block";
		}
	}

	/**
	 * Add keyboard shortcuts hint to modal (hidden by default)
	 */
	private addKeyboardShortcutsHint(): void {
		const { contentEl } = this;
		const hintsContainer = contentEl.createDiv({
			cls: "abyat-keyboard-hints",
		});
		hintsContainer.style.display = "none"; // Hidden by default

		const hintsTitle = hintsContainer.createEl("h4", {
			text: "اختصارات لوحة المفاتيح",
		});
		hintsTitle.style.marginBottom = "10px";

		const shortcuts = [
			{ keys: "Ctrl+Enter", description: "إدراج القصيدة" },
			{ keys: "Escape", description: "إغلاق النافذة" },
			{ keys: "Ctrl+N", description: "إضافة بيت جديد" },
			{ keys: "Ctrl+D", description: "حذف البيت الحالي" },
			{ keys: "Ctrl+↑/↓", description: "نقل البيت لأعلى/أسفل" },
			{ keys: "Ctrl+1-9", description: "الانتقال للبيت رقم..." },
			{ keys: "Alt+S", description: "التركيز على الصدر" },
			{ keys: "Alt+A", description: "التركيز على العجز" },
			{ keys: "Tab", description: "الانتقال للحقل التالي" },
		];

		const shortcutsList = hintsContainer.createDiv({
			cls: "abyat-shortcuts-list",
		});

		shortcuts.forEach((shortcut) => {
			const shortcutItem = shortcutsList.createDiv({
				cls: "abyat-shortcut-item",
			});

			const keys = shortcutItem.createSpan({
				cls: "abyat-shortcut-keys",
				text: shortcut.keys,
			});
			shortcutItem.createSpan({ text: ": " });
			shortcutItem.createSpan({
				cls: "abyat-shortcut-desc",
				text: shortcut.description,
			});
		});
	}

	/**
	 * Update current verse index when inputs get focus
	 */
	private updateCurrentVerseIndex(index: number): void {
		this.currentVerseIndex = index;
		this.updatePreviewHighlight();
	}

	/**
	 * Update preview highlighting for current verse
	 */
	private updatePreviewHighlight(): void {
		// Remove existing highlights
		const existingHighlights = this.previewContainer.querySelectorAll(
			".abyat-verse.highlighted"
		);
		existingHighlights.forEach((verse) => verse.removeClass("highlighted"));

		// Add highlight to current verse using data attribute
		const targetVerse = this.previewContainer.querySelector(
			`[data-verse-index="${this.currentVerseIndex}"]`
		);
		if (targetVerse) {
			targetVerse.addClass("highlighted");
		}
	}

	/**
	 * Create default poem structure
	 */
	private createDefaultPoem(): AbyatPoem {
		return {
			verses: [{ sadr: "", ajaz: "" }],
			layout: "side-by-side",
			size: "medium",
			numbered: false,
			annotations: {},
		};
	}

	/**
	 * Setup modal header
	 */
	private setupModalHeader(container: HTMLElement): void {
		container.createEl("h2", { text: "إدراج قصيدة عربية" });
	}

	/**
	 * Setup main two-column layout
	 */
	private setupMainLayout(container: HTMLElement): HTMLElement {
		const mainContainer = container.createDiv({
			cls: "abyat-modal-container",
		});
		mainContainer.createDiv({ cls: "abyat-modal-input" });
		mainContainer.createDiv({ cls: "abyat-modal-preview" });
		return mainContainer;
	}

	/**
	 * Setup input column with all form controls
	 */
	private setupInputColumn(container: HTMLElement): void {
		this.setupMetadataSection(container);
		this.setupVersesSection(container);
		this.setupAnnotationsSection(container);
	}

	/**
	 * Setup poem metadata inputs (title, poet, layout, etc.)
	 */
	private setupMetadataSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "abyat-modal-section" });
		section.createEl("h3", { text: "معلومات القصيدة" });

		// Title input
		new Setting(section).setName("عنوان القصيدة").addText((text) =>
			text
				.setPlaceholder("أدخل عنوان القصيدة")
				.setValue(this.poem.title || "")
				.onChange((value) => {
					this.poem.title = value;
					this.updatePreview();
				})
		);

		// Poet input
		new Setting(section).setName("القائل (اسم الشاعر)").addText((text) =>
			text
				.setPlaceholder("أدخل اسم الشاعر")
				.setValue(this.poem.poet || "")
				.onChange((value) => {
					this.poem.poet = value;
					this.updatePreview();
				})
		);

		// Layout dropdown
		new Setting(section).setName("تخطيط الأبيات").addDropdown((dropdown) =>
			dropdown
				.addOption("side-by-side", "جنباً إلى جنب")
				.addOption("stacked", "متدرج (درج)")
				.setValue(this.poem.layout)
				.onChange((value) => {
					this.poem.layout = value as "side-by-side" | "stacked";
					this.updatePreview();
				})
		);

		// Size dropdown
		new Setting(section).setName("حجم القصيدة").addDropdown((dropdown) =>
			dropdown
				.addOption("small", "صغير (مدمج مع النص)")
				.addOption("medium", "متوسط")
				.addOption("large", "كبير")
				.setValue(this.poem.size)
				.onChange((value) => {
					this.poem.size = value as "small" | "medium" | "large";
					this.updatePreview();
				})
		);

		// Numbering toggle
		new Setting(section).setName("ترقيم الأبيات").addToggle((toggle) =>
			toggle.setValue(this.poem.numbered).onChange((value) => {
				this.poem.numbered = value;
				this.updatePreview();
			})
		);
	}

	/**
	 * Setup verses input section
	 */
	private setupVersesSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "abyat-modal-section" });

		const header = section.createDiv({ cls: "abyat-verses-header" });
		header.createEl("h3", { text: "الأبيات" });

		new ButtonComponent(header).setButtonText("+ إضافة بيت").onClick(() => {
			this.addNewVerse();
		});

		const versesContainer = section.createDiv({
			cls: "abyat-verses-container",
		});
		this.renderVerseInputs(versesContainer);
	}

	/**
	 * Setup annotations section
	 */
	private setupAnnotationsSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "abyat-modal-section" });
		section.createEl("h3", { text: "التفسير والشروحات" });

		const info = section.createDiv({ cls: "abyat-annotation-info" });
		info.createEl("p", {
			text: "انقر على أي كلمة في المعاينة لإضافة تفسير لها",
			cls: "abyat-annotation-hint",
		});

		// Hidden annotation input that shows when word is selected
		const annotationInput = section.createDiv({
			cls: "abyat-annotation-input",
		});
		annotationInput.style.display = "none";
	}

	/**
	 * Add a new empty verse
	 */
	private addNewVerse(): void {
		this.poem.verses.push({ sadr: "", ajaz: "" });
		const container = this.contentEl.querySelector(
			".abyat-verses-container"
		) as HTMLElement;
		this.renderVerseInputs(container);
		this.updatePreview();

		// Focus on the new verse
		setTimeout(() => {
			this.focusOnVerse(this.poem.verses.length - 1);
		}, 100);
	}

	/**
	 * Render all verse input controls
	 */
	private renderVerseInputs(container: HTMLElement): void {
		container.empty();
		this.verseInputComponents = [];

		this.poem.verses.forEach((verse, index) => {
			const verseDiv = this.createVerseInputElement(verse, index);
			container.appendChild(verseDiv);
		});
	}

	/**
	 * Create input element for a single verse
	 */
	private createVerseInputElement(
		verse: AbyatVerse,
		index: number
	): HTMLElement {
		const verseDiv = document.createElement("div");
		verseDiv.className = "abyat-verse-input";

		this.addVerseHeader(verseDiv, index);
		this.addVerseInputs(verseDiv, verse, index);

		return verseDiv;
	}

	/**
	 * Add verse header with controls
	 */
	private addVerseHeader(container: HTMLElement, index: number): void {
		const header = container.createDiv({ cls: "abyat-verse-header" });

		header.createSpan({
			text: `البيت ${index + 1}`,
			cls: "abyat-verse-label",
		});

		const controls = header.createDiv({ cls: "abyat-verse-controls" });
		this.addVerseControls(controls, index);
	}

	/**
	 * Add verse control buttons (move up, move down, delete)
	 */
	private addVerseControls(container: HTMLElement, index: number): void {
		// Move up button
		if (index > 0) {
			new ButtonComponent(container)
				.setButtonText("↑")
				.setTooltip("نقل لأعلى (Ctrl+↑)")
				.onClick(() => this.moveVerse(index, index - 1));
		}

		// Move down button
		if (index < this.poem.verses.length - 1) {
			new ButtonComponent(container)
				.setButtonText("↓")
				.setTooltip("نقل لأسفل (Ctrl+↓)")
				.onClick(() => this.moveVerse(index, index + 1));
		}

		// Delete button (only if more than one verse)
		if (this.poem.verses.length > 1) {
			new ButtonComponent(container)
				.setButtonText("×")
				.setTooltip("حذف البيت (Ctrl+D)")
				.setClass("abyat-delete-btn")
				.onClick(() => this.deleteVerse(index));
		}
	}

	/**
	 * Move verse from one position to another
	 */
	private moveVerse(fromIndex: number, toIndex: number): void {
		[this.poem.verses[fromIndex], this.poem.verses[toIndex]] = [
			this.poem.verses[toIndex],
			this.poem.verses[fromIndex],
		];

		const container = this.contentEl.querySelector(
			".abyat-verses-container"
		) as HTMLElement;
		this.renderVerseInputs(container);
		this.updatePreview();

		// Update current verse index
		this.currentVerseIndex = toIndex;

		// Refocus on moved verse
		setTimeout(() => {
			this.focusOnVerse(toIndex);
		}, 100);
	}

	/**
	 * Delete verse at specified index
	 */
	private deleteVerse(index: number): void {
		this.poem.verses.splice(index, 1);
		const container = this.contentEl.querySelector(
			".abyat-verses-container"
		) as HTMLElement;
		this.renderVerseInputs(container);
		this.updatePreview();

		// Adjust current verse index
		if (this.currentVerseIndex >= this.poem.verses.length) {
			this.currentVerseIndex = Math.max(0, this.poem.verses.length - 1);
		}

		// Focus on appropriate verse
		setTimeout(() => {
			this.focusOnVerse(this.currentVerseIndex);
		}, 100);
	}

	/**
	 * Add input fields for sadr and ajaz
	 */
	private addVerseInputs(
		container: HTMLElement,
		verse: AbyatVerse,
		index: number
	): void {
		const inputsDiv = container.createDiv({ cls: "abyat-verse-inputs" });

		// Sadr (first half) input
		const sadrDiv = inputsDiv.createDiv({ cls: "abyat-input-group" });
		sadrDiv.createEl("label", { text: "الصدر:" });
		const sadrInput = new TextComponent(sadrDiv)
			.setPlaceholder("أدخل صدر البيت")
			.setValue(verse.sadr)
			.onChange((value) => {
				this.poem.verses[index].sadr = value;
				this.updatePreview();
			});
		sadrInput.inputEl.addClass("abyat-verse-text");

		// Add focus listener to update current verse
		sadrInput.inputEl.addEventListener("focus", () => {
			this.updateCurrentVerseIndex(index);
		});

		// Ajaz (second half) input
		const ajazDiv = inputsDiv.createDiv({ cls: "abyat-input-group" });
		ajazDiv.createEl("label", { text: "العجز:" });
		const ajazInput = new TextComponent(ajazDiv)
			.setPlaceholder("أدخل عجز البيت")
			.setValue(verse.ajaz)
			.onChange((value) => {
				this.poem.verses[index].ajaz = value;
				this.updatePreview();
			});
		ajazInput.inputEl.addClass("abyat-verse-text");

		// Add focus listener to update current verse
		ajazInput.inputEl.addEventListener("focus", () => {
			this.updateCurrentVerseIndex(index);
		});

		this.verseInputComponents.push({ sadr: sadrInput, ajaz: ajazInput });
	}

	/**
	 * Setup preview column
	 */
	private setupPreviewColumn(container: HTMLElement): void {
		container.createEl("h3", { text: "معاينة" });
		this.previewContainer = container.createDiv({
			cls: "abyat-preview-container",
		});
	}

	/**
	 * Update the preview with current poem data
	 */
	private updatePreview(): void {
		this.previewContainer.empty();

		const poemDiv = this.previewContainer.createDiv({
			cls: `abyat-container ${this.poem.size}`,
		});

		this.addPreviewHeader(poemDiv);
		this.addPreviewVerses(poemDiv);

		// Update highlighting after preview is rendered
		setTimeout(() => {
			this.updatePreviewHighlight();
		}, 10);
	}

	/**
	 * Add header to preview
	 */
	private addPreviewHeader(container: HTMLElement): void {
		if (!this.poem.title && !this.poem.poet) {
			return;
		}

		const header = container.createDiv({ cls: "abyat-header" });

		if (this.poem.title) {
			header.createDiv({ cls: "abyat-title", text: this.poem.title });
		}

		if (this.poem.poet) {
			header.createDiv({
				cls: "abyat-poet",
				text: `- ${this.poem.poet} -`,
			});
		}
	}

	/**
	 * Add verses to preview with clickable words for annotations
	 */
	private addPreviewVerses(container: HTMLElement): void {
		const versesDiv = container.createDiv({ cls: "abyat-verses" });

		let previewIndex = 0; // Track preview index separately from poem index

		this.poem.verses.forEach((verse, index) => {
			// Skip empty verses in preview
			if (!verse.sadr && !verse.ajaz) return;

			const verseDiv = versesDiv.createDiv({
				cls: `abyat-verse abyat-verse-preview ${this.poem.layout}`,
			});

			// Add data attribute to track which input verse this corresponds to
			verseDiv.setAttribute("data-verse-index", index.toString());

			if (this.poem.numbered) {
				verseDiv.createDiv({
					cls: "abyat-verse-number",
					text: (previewIndex + 1).toString(),
				});
			}

			const sadrDiv = verseDiv.createDiv({ cls: "abyat-sadr" });
			const ajazDiv = verseDiv.createDiv({ cls: "abyat-ajaz" });

			this.makeWordsClickableForAnnotation(verse.sadr, sadrDiv);
			this.makeWordsClickableForAnnotation(verse.ajaz, ajazDiv);

			previewIndex++;
		});
	}

	/**
	 * Make words in text clickable for adding annotations
	 */
	private makeWordsClickableForAnnotation(
		text: string,
		container: HTMLElement
	): void {
		const words = text.split(" ");

		words.forEach((word, index) => {
			if (index > 0) container.appendText(" ");

			const span = container.createSpan({
				cls: "abyat-word-clickable",
				text: word,
			});

			// Show existing annotation if available
			if (this.poem.annotations && this.poem.annotations[word]) {
				span.addClass("abyat-annotated");
				span.createDiv({
					cls: "abyat-tooltip",
					text: this.poem.annotations[word],
				});
			}

			// Make word clickable to add/edit annotation
			span.addEventListener("click", () => {
				this.showAnnotationInputForWord(word);
			});
		});
	}

	/**
	 * Show annotation input for selected word
	 */
	private showAnnotationInputForWord(word: string): void {
		this.selectedWordForAnnotation = word;

		const annotationSection = this.contentEl.querySelector(
			".abyat-annotation-input"
		) as HTMLElement;

		if (!annotationSection) return;

		this.renderAnnotationInput(annotationSection, word);
	}

	/**
	 * Render annotation input interface
	 */
	private renderAnnotationInput(container: HTMLElement, word: string): void {
		container.empty();
		container.style.display = "block";

		const wordLabel = container.createDiv({ cls: "abyat-annotation-word" });
		wordLabel.createEl("strong", { text: `كلمة: ${word}` });

		const inputDiv = container.createDiv({
			cls: "abyat-annotation-input-container",
		});

		const currentAnnotation = this.poem.annotations?.[word] || "";

		const textArea = new TextComponent(inputDiv)
			.setPlaceholder("أدخل التفسير أو الشرح")
			.setValue(currentAnnotation)
			.onChange((value) => {
				this.updateAnnotation(word, value);
			});

		textArea.inputEl.addClass("abyat-annotation-textarea");

		// Add delete button if annotation exists
		if (currentAnnotation) {
			new ButtonComponent(inputDiv)
				.setButtonText("حذف التفسير")
				.setClass("abyat-delete-annotation")
				.onClick(() => {
					this.deleteAnnotation(word);
					container.style.display = "none";
				});
		}
	}

	/**
	 * Update annotation for a word
	 */
	private updateAnnotation(word: string, annotation: string): void {
		if (!this.poem.annotations) {
			this.poem.annotations = {};
		}

		if (annotation.trim()) {
			this.poem.annotations[word] = annotation;
		} else {
			delete this.poem.annotations[word];
		}

		this.updatePreview();
	}

	/**
	 * Delete annotation for a word
	 */
	private deleteAnnotation(word: string): void {
		if (this.poem.annotations) {
			delete this.poem.annotations[word];
		}
		this.updatePreview();
	}

	/**
	 * Setup modal action buttons
	 */
	private setupModalButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({
			cls: "abyat-modal-buttons",
		});

		new ButtonComponent(buttonContainer)
			.setButtonText("إدراج (Ctrl+Enter)")
			.setCta()
			.onClick(() => {
				this.submitPoem();
			});

		new ButtonComponent(buttonContainer)
			.setButtonText("إلغاء (Esc)")
			.onClick(() => this.close());
	}
}
