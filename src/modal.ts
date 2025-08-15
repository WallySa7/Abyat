import {
	App,
	Modal,
	Setting,
	TextComponent,
	ButtonComponent,
	Notice,
} from "obsidian";
import { AbyatPoem, AbyatVerse, AbyatAnnotation } from "./types";

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
	private selectedText: string = "";
	private selectedRange: {
		verseIndex: number;
		part: "sadr" | "ajaz";
		startPos: number;
		endPos: number;
	} | null = null;
	private currentVerseIndex: number = 0;
	private keyboardHandler: (event: KeyboardEvent) => void;
	private tagsInput: TextComponent;
	private tagsContainer: HTMLElement;
	private annotationsListContainer: HTMLElement;
	private annotationInputContainer: HTMLElement;
	private isSelecting: boolean = false;
	private selectionStart: HTMLElement | null = null;

	constructor(
		app: App,
		onSubmit: (poem: AbyatPoem) => void,
		existingPoem?: AbyatPoem
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.poem = existingPoem || this.createDefaultPoem();

		// Convert legacy annotations to new format if present
		if (this.poem.legacyAnnotations && !this.poem.annotations) {
			this.convertLegacyAnnotations();
		}

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
	 * Convert legacy annotations to new format
	 */
	private convertLegacyAnnotations(): void {
		if (!this.poem.legacyAnnotations) return;

		this.poem.annotations = [];
		let annotationId = 0;

		this.poem.verses.forEach((verse, verseIndex) => {
			// Check sadr
			Object.keys(this.poem.legacyAnnotations!).forEach((word) => {
				const index = verse.sadr.indexOf(word);
				if (index !== -1) {
					this.poem.annotations!.push({
						id: `ann_${annotationId++}`,
						text: word,
						annotation: this.poem.legacyAnnotations![word],
						verseIndex,
						part: "sadr",
						startPos: index,
						endPos: index + word.length,
					});
				}
			});

			// Check ajaz
			Object.keys(this.poem.legacyAnnotations!).forEach((word) => {
				const index = verse.ajaz.indexOf(word);
				if (index !== -1) {
					this.poem.annotations!.push({
						id: `ann_${annotationId++}`,
						text: word,
						annotation: this.poem.legacyAnnotations![word],
						verseIndex,
						part: "ajaz",
						startPos: index,
						endPos: index + word.length,
					});
				}
			});
		});

		delete this.poem.legacyAnnotations;
	}

	/**
	 * Generate unique annotation ID
	 */
	private generateAnnotationId(): string {
		return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Setup keyboard shortcuts for the modal
	 */
	private setupKeyboardShortcuts(): void {
		document.addEventListener("keydown", this.keyboardHandler);
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

		// Ctrl+T: Focus on tags input
		if (ctrlKey && key === "t") {
			event.preventDefault();
			this.focusOnTags();
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
				event.preventDefault();
				this.focusOnAjaz(this.currentVerseIndex);
			} else if (!isShiftTab && !isSadr) {
				event.preventDefault();
				if (this.currentVerseIndex < this.poem.verses.length - 1) {
					this.focusOnVerse(this.currentVerseIndex + 1);
				} else {
					this.addNewVerse();
					this.focusOnVerse(this.poem.verses.length - 1);
				}
			} else if (isShiftTab && !isSadr) {
				event.preventDefault();
				this.focusOnSadr(this.currentVerseIndex);
			} else if (isShiftTab && isSadr && this.currentVerseIndex > 0) {
				event.preventDefault();
				this.focusOnVerse(this.currentVerseIndex - 1, "ajaz");
			}
		}
	}

	/**
	 * Focus on tags input
	 */
	private focusOnTags(): void {
		if (this.tagsInput) {
			this.tagsInput.inputEl.focus();
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

			this.scrollToVerse(index);
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
		helpButton.innerHTML = "؟";
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
		hintsContainer.style.display = "none";

		const hintsTitle = hintsContainer.createEl("h4", {
			text: "اختصارات لوحة المفاتيح",
		});
		hintsTitle.style.marginBottom = "10px";

		const shortcuts = [
			{ keys: "Ctrl+Enter", description: "إدراج القصيدة" },
			{ keys: "Escape", description: "إغلاق النافذة" },
			{ keys: "Ctrl+N", description: "إضافة بيت جديد" },
			{ keys: "Ctrl+D", description: "حذف البيت الحالي" },
			{ keys: "Ctrl+T", description: "التركيز على العلامات" },
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
		const existingHighlights = this.previewContainer.querySelectorAll(
			".abyat-verse.highlighted"
		);
		existingHighlights.forEach((verse) => verse.removeClass("highlighted"));

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
			tags: [],
			annotations: [],
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
	 * Setup poem metadata inputs (title, poet, tags, layout, etc.)
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

		// Tags input
		this.setupTagsInput(section);

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
	 * Setup tags input with visual tag management
	 */
	private setupTagsInput(container: HTMLElement): void {
		const tagsSetting = new Setting(container);
		tagsSetting.setName("علامات التصنيف");
		tagsSetting.setDesc("اكتب علامة واضغط Enter أو فاصلة لإضافتها");

		// Tags display container
		this.tagsContainer = tagsSetting.settingEl.createDiv({
			cls: "abyat-tags-container",
		});

		// Tags input
		this.tagsInput = new TextComponent(tagsSetting.controlEl);
		this.tagsInput.setPlaceholder("أضف علامة تصنيف...");
		this.tagsInput.inputEl.addClass("abyat-tags-input");

		// Handle tag input
		this.tagsInput.inputEl.addEventListener("keydown", (event) => {
			if (
				event.key === "Enter" ||
				event.key === "," ||
				event.key === "،"
			) {
				event.preventDefault();
				this.addTagFromInput();
			} else if (
				event.key === "Backspace" &&
				this.tagsInput.getValue() === ""
			) {
				this.removeLastTag();
			}
		});

		this.tagsInput.inputEl.addEventListener("blur", () => {
			if (this.tagsInput.getValue().trim()) {
				this.addTagFromInput();
			}
		});

		// Render existing tags
		this.renderTags();
	}

	/**
	 * Add tag from input field
	 */
	private addTagFromInput(): void {
		const tagText = this.tagsInput.getValue().trim();
		if (tagText && !this.poem.tags?.includes(tagText)) {
			if (!this.poem.tags) {
				this.poem.tags = [];
			}
			this.poem.tags.push(tagText);
			this.tagsInput.setValue("");
			this.renderTags();
			this.updatePreview();
		}
	}

	/**
	 * Remove last tag
	 */
	private removeLastTag(): void {
		if (this.poem.tags && this.poem.tags.length > 0) {
			this.poem.tags.pop();
			this.renderTags();
			this.updatePreview();
		}
	}

	/**
	 * Remove specific tag
	 */
	private removeTag(tagToRemove: string): void {
		if (this.poem.tags) {
			this.poem.tags = this.poem.tags.filter(
				(tag) => tag !== tagToRemove
			);
			this.renderTags();
			this.updatePreview();
		}
	}

	/**
	 * Render tags visually
	 */
	private renderTags(): void {
		this.tagsContainer.empty();

		if (!this.poem.tags || this.poem.tags.length === 0) {
			return;
		}

		this.poem.tags.forEach((tag) => {
			const tagElement = this.tagsContainer.createDiv({
				cls: "abyat-tag",
			});

			tagElement.createSpan({
				cls: "abyat-tag-text",
				text: tag,
			});

			const removeButton = tagElement.createSpan({
				cls: "abyat-tag-remove",
				text: "×",
			});

			removeButton.addEventListener("click", () => {
				this.removeTag(tag);
			});
		});
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
	 * Setup annotations section with list and input
	 */
	private setupAnnotationsSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "abyat-modal-section" });
		section.createEl("h3", { text: "التفسير والشروحات" });

		// Instructions
		const info = section.createDiv({ cls: "abyat-annotation-info" });
		info.createEl("p", {
			text: "اختر النص في المعاينة لإضافة تفسير (انقر واسحب لتحديد عبارة)",
			cls: "abyat-annotation-hint",
		});

		// Annotation input container
		this.annotationInputContainer = section.createDiv({
			cls: "abyat-annotation-input",
		});
		this.annotationInputContainer.style.display = "none";

		// Annotations list
		const listHeader = section.createDiv({
			cls: "abyat-annotations-header",
		});
		listHeader.createEl("h4", { text: "الشروحات الحالية" });

		this.annotationsListContainer = section.createDiv({
			cls: "abyat-annotations-list",
		});

		this.updateAnnotationsList();
	}

	/**
	 * Update the annotations list display
	 */
	private updateAnnotationsList(): void {
		this.annotationsListContainer.empty();

		if (!this.poem.annotations || this.poem.annotations.length === 0) {
			this.annotationsListContainer.createEl("p", {
				text: "لا توجد شروحات حالياً",
				cls: "abyat-no-annotations",
			});
			return;
		}

		// Group annotations by verse
		const annotationsByVerse = new Map<number, AbyatAnnotation[]>();
		this.poem.annotations.forEach((ann) => {
			if (!annotationsByVerse.has(ann.verseIndex)) {
				annotationsByVerse.set(ann.verseIndex, []);
			}
			annotationsByVerse.get(ann.verseIndex)!.push(ann);
		});

		// Display annotations grouped by verse
		annotationsByVerse.forEach((annotations, verseIndex) => {
			const verseGroup = this.annotationsListContainer.createDiv({
				cls: "abyat-annotation-verse-group",
			});

			verseGroup.createEl("h5", {
				text: `البيت ${verseIndex + 1}`,
				cls: "abyat-annotation-verse-title",
			});

			annotations.forEach((ann) => {
				const annotationItem = verseGroup.createDiv({
					cls: "abyat-annotation-item",
				});

				const textPart = annotationItem.createDiv({
					cls: "abyat-annotation-item-text",
				});

				const textSpan = textPart.createSpan({
					cls: "abyat-annotation-text",
					text: ann.text,
				});

				const partLabel = textPart.createSpan({
					cls: "abyat-annotation-part",
					text: ` (${ann.part === "sadr" ? "الصدر" : "العجز"})`,
				});

				const annotationSpan = annotationItem.createDiv({
					cls: "abyat-annotation-value",
					text: ann.annotation,
				});

				const controls = annotationItem.createDiv({
					cls: "abyat-annotation-controls",
				});

				// Edit button
				new ButtonComponent(controls)
					.setButtonText("تعديل")
					.setClass("abyat-annotation-edit")
					.onClick(() => {
						this.editAnnotation(ann);
					});

				// Delete button
				new ButtonComponent(controls)
					.setButtonText("حذف")
					.setClass("abyat-annotation-delete")
					.onClick(() => {
						this.deleteAnnotation(ann.id);
					});
			});
		});
	}

	/**
	 * Edit an existing annotation
	 */
	private editAnnotation(annotation: AbyatAnnotation): void {
		this.selectedText = annotation.text;
		this.selectedRange = {
			verseIndex: annotation.verseIndex,
			part: annotation.part,
			startPos: annotation.startPos,
			endPos: annotation.endPos,
		};

		this.showAnnotationInput(annotation.annotation, annotation.id);

		// Scroll to annotation input
		this.annotationInputContainer.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
	}

	/**
	 * Delete an annotation
	 */
	private deleteAnnotation(annotationId: string): void {
		if (!this.poem.annotations) return;

		this.poem.annotations = this.poem.annotations.filter(
			(ann) => ann.id !== annotationId
		);

		this.updateAnnotationsList();
		this.updatePreview();
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

		// Update annotations verse indices
		if (this.poem.annotations) {
			this.poem.annotations.forEach((ann) => {
				if (ann.verseIndex === fromIndex) {
					ann.verseIndex = toIndex;
				} else if (ann.verseIndex === toIndex) {
					ann.verseIndex = fromIndex;
				}
			});
		}

		const container = this.contentEl.querySelector(
			".abyat-verses-container"
		) as HTMLElement;
		this.renderVerseInputs(container);
		this.updatePreview();
		this.updateAnnotationsList();

		this.currentVerseIndex = toIndex;

		setTimeout(() => {
			this.focusOnVerse(toIndex);
		}, 100);
	}

	/**
	 * Delete verse at specified index
	 */
	private deleteVerse(index: number): void {
		this.poem.verses.splice(index, 1);

		// Update or remove annotations for this verse
		if (this.poem.annotations) {
			// Remove annotations for deleted verse
			this.poem.annotations = this.poem.annotations.filter(
				(ann) => ann.verseIndex !== index
			);

			// Update indices for verses after the deleted one
			this.poem.annotations.forEach((ann) => {
				if (ann.verseIndex > index) {
					ann.verseIndex--;
				}
			});
		}

		const container = this.contentEl.querySelector(
			".abyat-verses-container"
		) as HTMLElement;
		this.renderVerseInputs(container);
		this.updatePreview();
		this.updateAnnotationsList();

		if (this.currentVerseIndex >= this.poem.verses.length) {
			this.currentVerseIndex = Math.max(0, this.poem.verses.length - 1);
		}

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
		this.addPreviewTags(poemDiv);
		this.addPreviewVerses(poemDiv);

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
	 * Add tags to preview
	 */
	private addPreviewTags(container: HTMLElement): void {
		if (!this.poem.tags || this.poem.tags.length === 0) {
			return;
		}

		const tagsDiv = container.createDiv({ cls: "abyat-tags-preview" });

		this.poem.tags.forEach((tag) => {
			tagsDiv.createSpan({
				cls: "abyat-tag-preview",
				text: tag,
			});
		});
	}

	/**
	 * Add verses to preview with selectable text for annotations
	 */
	private addPreviewVerses(container: HTMLElement): void {
		const versesDiv = container.createDiv({ cls: "abyat-verses" });

		let previewIndex = 0;

		this.poem.verses.forEach((verse, index) => {
			if (!verse.sadr && !verse.ajaz) return;

			const verseDiv = versesDiv.createDiv({
				cls: `abyat-verse abyat-verse-preview ${this.poem.layout}`,
			});

			verseDiv.setAttribute("data-verse-index", index.toString());

			if (this.poem.numbered) {
				verseDiv.createDiv({
					cls: "abyat-verse-number",
					text: (previewIndex + 1).toString(),
				});
			}

			const sadrDiv = verseDiv.createDiv({ cls: "abyat-sadr" });
			const ajazDiv = verseDiv.createDiv({ cls: "abyat-ajaz" });

			this.renderSelectableText(verse.sadr, sadrDiv, index, "sadr");
			this.renderSelectableText(verse.ajaz, ajazDiv, index, "ajaz");

			previewIndex++;
		});
	}

	/**
	 * Render text with selectable words/phrases and existing annotations
	 */
	private renderSelectableText(
		text: string,
		container: HTMLElement,
		verseIndex: number,
		part: "sadr" | "ajaz"
	): void {
		if (!text) return;

		// Get annotations for this text
		const annotations =
			this.poem.annotations?.filter(
				(ann) => ann.verseIndex === verseIndex && ann.part === part
			) || [];

		// Sort annotations by start position
		annotations.sort((a, b) => a.startPos - b.startPos);

		let lastPos = 0;

		// Render text with annotations
		annotations.forEach((ann) => {
			// Add text before annotation
			if (ann.startPos > lastPos) {
				const beforeText = text.substring(lastPos, ann.startPos);
				this.addSelectableSpan(
					beforeText,
					container,
					verseIndex,
					part,
					lastPos
				);
			}

			// Add annotated text
			const annotatedSpan = container.createSpan({
				cls: "abyat-annotated abyat-phrase-annotation",
				text: ann.text,
			});

			// Add tooltip
			const tooltip = annotatedSpan.createDiv({
				cls: "abyat-tooltip",
				text: ann.annotation,
			});

			// Make annotated text clickable to edit
			annotatedSpan.addEventListener("click", (e) => {
				e.stopPropagation();
				this.editAnnotation(ann);
			});

			lastPos = ann.endPos;
		});

		// Add remaining text
		if (lastPos < text.length) {
			const remainingText = text.substring(lastPos);
			this.addSelectableSpan(
				remainingText,
				container,
				verseIndex,
				part,
				lastPos
			);
		}
	}

	/**
	 * Add selectable span for text selection
	 */
	private addSelectableSpan(
		text: string,
		container: HTMLElement,
		verseIndex: number,
		part: "sadr" | "ajaz",
		startPos: number
	): void {
		const words = text.split(/(\s+)/); // Split while keeping spaces
		let currentPos = startPos;

		words.forEach((word) => {
			if (word.trim()) {
				const span = container.createSpan({
					cls: "abyat-selectable-word",
					text: word,
				});

				span.setAttribute("data-verse-index", verseIndex.toString());
				span.setAttribute("data-part", part);
				span.setAttribute("data-start-pos", currentPos.toString());
				span.setAttribute(
					"data-end-pos",
					(currentPos + word.length).toString()
				);

				// Mouse events for selection
				span.addEventListener("mousedown", (e) =>
					this.startSelection(e, span)
				);
				span.addEventListener("mouseenter", (e) =>
					this.continueSelection(e, span)
				);
				span.addEventListener("mouseup", (e) => this.endSelection(e));

				// Touch events for mobile
				span.addEventListener("touchstart", (e) =>
					this.startSelection(e, span)
				);
				span.addEventListener("touchmove", (e) =>
					this.handleTouchMove(e)
				);
				span.addEventListener("touchend", (e) => this.endSelection(e));
			} else {
				// Add space
				container.appendText(word);
			}
			currentPos += word.length;
		});
	}

	/**
	 * Start text selection
	 */
	private startSelection(e: Event, span: HTMLElement): void {
		e.preventDefault();
		this.clearSelection();

		this.isSelecting = true;
		this.selectionStart = span;
		span.addClass("abyat-selecting");
	}

	/**
	 * Continue text selection on mouse enter
	 */
	private continueSelection(e: Event, span: HTMLElement): void {
		if (!this.isSelecting || !this.selectionStart) return;

		const startVerse = parseInt(
			this.selectionStart.getAttribute("data-verse-index")!
		);
		const startPart = this.selectionStart.getAttribute("data-part");
		const currentVerse = parseInt(span.getAttribute("data-verse-index")!);
		const currentPart = span.getAttribute("data-part");

		// Only allow selection within the same verse part
		if (startVerse !== currentVerse || startPart !== currentPart) return;

		// Clear previous selection
		this.clearSelection(false);

		// Get all spans in the same verse part
		const container = span.parentElement;
		if (!container) return;

		const allSpans = Array.from(
			container.querySelectorAll(".abyat-selectable-word")
		);
		const startIndex = allSpans.indexOf(this.selectionStart);
		const endIndex = allSpans.indexOf(span);

		if (startIndex === -1 || endIndex === -1) return;

		const minIndex = Math.min(startIndex, endIndex);
		const maxIndex = Math.max(startIndex, endIndex);

		// Highlight selected spans
		for (let i = minIndex; i <= maxIndex; i++) {
			allSpans[i].addClass("abyat-selecting");
		}
	}

	/**
	 * Handle touch move for mobile selection
	 */
	private handleTouchMove(e: TouchEvent): void {
		if (!this.isSelecting) return;

		const touch = e.touches[0];
		const element = document.elementFromPoint(touch.clientX, touch.clientY);

		if (element && element.classList.contains("abyat-selectable-word")) {
			this.continueSelection(e, element as HTMLElement);
		}
	}

	/**
	 * End text selection
	 */
	private endSelection(e: Event): void {
		if (!this.isSelecting) return;

		e.preventDefault();
		this.isSelecting = false;

		// Get selected text
		const selectedSpans =
			this.previewContainer.querySelectorAll(".abyat-selecting");
		if (selectedSpans.length === 0) return;

		const firstSpan = selectedSpans[0] as HTMLElement;
		const lastSpan = selectedSpans[selectedSpans.length - 1] as HTMLElement;

		const verseIndex = parseInt(
			firstSpan.getAttribute("data-verse-index")!
		);
		const part = firstSpan.getAttribute("data-part") as "sadr" | "ajaz";
		const startPos = parseInt(firstSpan.getAttribute("data-start-pos")!);
		const endPos = parseInt(lastSpan.getAttribute("data-end-pos")!);

		// Get selected text
		let selectedText = "";
		selectedSpans.forEach((span, index) => {
			if (index > 0) selectedText += " ";
			selectedText += (span as HTMLElement).textContent;
		});

		this.selectedText = selectedText.trim();
		this.selectedRange = { verseIndex, part, startPos, endPos };

		// Show annotation input
		this.showAnnotationInput();

		// Clear selection highlighting
		this.clearSelection();
	}

	/**
	 * Clear text selection
	 */
	private clearSelection(resetStart: boolean = true): void {
		const selectedSpans =
			this.previewContainer.querySelectorAll(".abyat-selecting");
		selectedSpans.forEach((span) => span.removeClass("abyat-selecting"));

		if (resetStart) {
			this.selectionStart = null;
		}
	}

	/**
	 * Show annotation input for selected text
	 */
	private showAnnotationInput(
		existingAnnotation: string = "",
		existingId?: string
	): void {
		if (!this.selectedText || !this.selectedRange) return;

		this.annotationInputContainer.empty();
		this.annotationInputContainer.style.display = "block";

		const header = this.annotationInputContainer.createDiv({
			cls: "abyat-annotation-header",
		});

		header.createEl("strong", {
			text: `النص المحدد: "${this.selectedText}"`,
		});

		const inputGroup = this.annotationInputContainer.createDiv({
			cls: "abyat-annotation-input-group",
		});

		const textArea = new TextComponent(inputGroup)
			.setPlaceholder("أدخل التفسير أو الشرح")
			.setValue(existingAnnotation);

		textArea.inputEl.addClass("abyat-annotation-textarea");

		const buttonsDiv = this.annotationInputContainer.createDiv({
			cls: "abyat-annotation-buttons",
		});

		new ButtonComponent(buttonsDiv)
			.setButtonText("حفظ")
			.setCta()
			.onClick(() => {
				const annotation = textArea.getValue().trim();
				if (annotation) {
					this.saveAnnotation(annotation, existingId);
				}
			});

		new ButtonComponent(buttonsDiv).setButtonText("إلغاء").onClick(() => {
			this.annotationInputContainer.style.display = "none";
			this.selectedText = "";
			this.selectedRange = null;
		});

		// Focus on text area
		setTimeout(() => textArea.inputEl.focus(), 100);
	}

	/**
	 * Save annotation
	 */
	private saveAnnotation(annotationText: string, existingId?: string): void {
		if (!this.selectedText || !this.selectedRange) return;

		if (!this.poem.annotations) {
			this.poem.annotations = [];
		}

		if (existingId) {
			// Update existing annotation
			const existingAnn = this.poem.annotations.find(
				(ann) => ann.id === existingId
			);
			if (existingAnn) {
				existingAnn.annotation = annotationText;
			}
		} else {
			// Check for overlapping annotations
			const overlapping = this.poem.annotations.filter(
				(ann) =>
					ann.verseIndex === this.selectedRange!.verseIndex &&
					ann.part === this.selectedRange!.part &&
					((ann.startPos >= this.selectedRange!.startPos &&
						ann.startPos < this.selectedRange!.endPos) ||
						(ann.endPos > this.selectedRange!.startPos &&
							ann.endPos <= this.selectedRange!.endPos) ||
						(ann.startPos <= this.selectedRange!.startPos &&
							ann.endPos >= this.selectedRange!.endPos))
			);

			// Remove overlapping annotations
			overlapping.forEach((ann) => {
				this.poem.annotations = this.poem.annotations!.filter(
					(a) => a.id !== ann.id
				);
			});

			// Add new annotation
			const newAnnotation: AbyatAnnotation = {
				id: this.generateAnnotationId(),
				text: this.selectedText,
				annotation: annotationText,
				verseIndex: this.selectedRange.verseIndex,
				part: this.selectedRange.part,
				startPos: this.selectedRange.startPos,
				endPos: this.selectedRange.endPos,
			};

			this.poem.annotations.push(newAnnotation);
		}

		// Clear and hide input
		this.annotationInputContainer.style.display = "none";
		this.selectedText = "";
		this.selectedRange = null;

		// Update displays
		this.updateAnnotationsList();
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
