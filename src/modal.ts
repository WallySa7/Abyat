import {
	App,
	Modal,
	Setting,
	TextComponent,
	ButtonComponent,
	ToggleComponent,
} from "obsidian";
import { AbyatPoem, AbyatVerse } from "./types";

export class AbyatModal extends Modal {
	private poem: AbyatPoem;
	private onSubmit: (poem: AbyatPoem) => void;
	private verseInputs: Array<{ sadr: TextComponent; ajaz: TextComponent }> =
		[];
	private previewEl: HTMLElement;
	private selectedWord: string | null = null;

	constructor(
		app: App,
		onSubmit: (poem: AbyatPoem) => void,
		existingPoem?: AbyatPoem
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.poem = existingPoem || {
			verses: [{ sadr: "", ajaz: "" }],
			layout: "side-by-side",
			size: "medium",
			numbered: false,
			annotations: {},
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("abyat-modal");

		this.modalEl.addClass("abyat");

		// Add custom styles for modal
		this.addModalStyles();

		contentEl.createEl("h2", { text: "إدراج قصيدة عربية" });

		// Create main container with two columns
		const mainContainer = contentEl.createDiv({
			cls: "abyat-modal-container",
		});
		const inputColumn = mainContainer.createDiv({
			cls: "abyat-modal-input",
		});
		const previewColumn = mainContainer.createDiv({
			cls: "abyat-modal-preview",
		});

		// Metadata section
		const metadataSection = inputColumn.createDiv({
			cls: "abyat-modal-section",
		});
		metadataSection.createEl("h3", { text: "معلومات القصيدة" });

		// Title input
		new Setting(metadataSection).setName("عنوان القصيدة").addText((text) =>
			text
				.setPlaceholder("أدخل عنوان القصيدة")
				.setValue(this.poem.title || "")
				.onChange((value) => {
					this.poem.title = value;
					this.updatePreview();
				})
		);

		// Poet input
		new Setting(metadataSection)
			.setName("القائل (اسم الشاعر)")
			.addText((text) =>
				text
					.setPlaceholder("أدخل اسم الشاعر")
					.setValue(this.poem.poet || "")
					.onChange((value) => {
						this.poem.poet = value;
						this.updatePreview();
					})
			);

		// Layout options
		new Setting(metadataSection)
			.setName("تخطيط الأبيات")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("side-by-side", "جنباً إلى جنب")
					.addOption("stacked", "متدرج (درج)")
					.setValue(this.poem.layout)
					.onChange((value) => {
						this.poem.layout = value as "side-by-side" | "stacked";
						this.updatePreview();
					})
			);

		// Size options
		new Setting(metadataSection)
			.setName("حجم القصيدة")
			.addDropdown((dropdown) =>
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
		new Setting(metadataSection)
			.setName("ترقيم الأبيات")
			.addToggle((toggle) =>
				toggle.setValue(this.poem.numbered).onChange((value) => {
					this.poem.numbered = value;
					this.updatePreview();
				})
			);

		// Verses section
		const versesSection = inputColumn.createDiv({
			cls: "abyat-modal-section",
		});
		const versesHeader = versesSection.createDiv({
			cls: "abyat-verses-header",
		});
		versesHeader.createEl("h3", { text: "الأبيات" });

		const addVerseBtn = new ButtonComponent(versesHeader)
			.setButtonText("+ إضافة بيت")
			.onClick(() => {
				this.poem.verses.push({ sadr: "", ajaz: "" });
				this.renderVerses(versesContainer);
				this.updatePreview();
			});

		const versesContainer = versesSection.createDiv({
			cls: "abyat-verses-container",
		});
		this.renderVerses(versesContainer);

		// Annotations section
		const annotationsSection = inputColumn.createDiv({
			cls: "abyat-modal-section",
		});
		annotationsSection.createEl("h3", { text: "التفسير والشروحات" });

		const annotationInfo = annotationsSection.createDiv({
			cls: "abyat-annotation-info",
		});
		annotationInfo.createEl("p", {
			text: "انقر على أي كلمة في المعاينة لإضافة تفسير لها",
			cls: "abyat-annotation-hint",
		});

		const annotationInput = annotationsSection.createDiv({
			cls: "abyat-annotation-input",
		});
		annotationInput.style.display = "none";

		// Preview section
		previewColumn.createEl("h3", { text: "معاينة" });
		this.previewEl = previewColumn.createDiv({
			cls: "abyat-preview-container",
		});
		this.updatePreview();

		// Buttons
		const buttonContainer = contentEl.createDiv({
			cls: "abyat-modal-buttons",
		});

		new ButtonComponent(buttonContainer)
			.setButtonText("إدراج")
			.setCta()
			.onClick(() => {
				this.onSubmit(this.poem);
				this.close();
			});

		new ButtonComponent(buttonContainer)
			.setButtonText("إلغاء")
			.onClick(() => this.close());
	}

	private renderVerses(container: HTMLElement) {
		container.empty();
		this.verseInputs = [];

		this.poem.verses.forEach((verse, index) => {
			const verseDiv = container.createDiv({ cls: "abyat-verse-input" });

			// Verse header with number and controls
			const verseHeader = verseDiv.createDiv({
				cls: "abyat-verse-header",
			});
			verseHeader.createSpan({
				text: `البيت ${index + 1}`,
				cls: "abyat-verse-label",
			});

			const controls = verseHeader.createDiv({
				cls: "abyat-verse-controls",
			});

			// Move up button
			if (index > 0) {
				new ButtonComponent(controls)
					.setButtonText("↑")
					.setTooltip("نقل لأعلى")
					.onClick(() => {
						[this.poem.verses[index], this.poem.verses[index - 1]] =
							[
								this.poem.verses[index - 1],
								this.poem.verses[index],
							];
						this.renderVerses(container);
						this.updatePreview();
					});
			}

			// Move down button
			if (index < this.poem.verses.length - 1) {
				new ButtonComponent(controls)
					.setButtonText("↓")
					.setTooltip("نقل لأسفل")
					.onClick(() => {
						[this.poem.verses[index], this.poem.verses[index + 1]] =
							[
								this.poem.verses[index + 1],
								this.poem.verses[index],
							];
						this.renderVerses(container);
						this.updatePreview();
					});
			}

			// Delete button
			if (this.poem.verses.length > 1) {
				new ButtonComponent(controls)
					.setButtonText("×")
					.setTooltip("حذف البيت")
					.setClass("abyat-delete-btn")
					.onClick(() => {
						this.poem.verses.splice(index, 1);
						this.renderVerses(container);
						this.updatePreview();
					});
			}

			// Verse inputs
			const inputsDiv = verseDiv.createDiv({ cls: "abyat-verse-inputs" });

			// Sadr input
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

			// Ajaz input
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

			this.verseInputs.push({ sadr: sadrInput, ajaz: ajazInput });
		});
	}

	private updatePreview() {
		this.previewEl.empty();

		const poemDiv = this.previewEl.createDiv({
			cls: `abyat-container ${this.poem.size}`,
		});

		// Add header if title or poet exists
		if (this.poem.title || this.poem.poet) {
			const header = poemDiv.createDiv({ cls: "abyat-header" });
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

		// Add verses
		const versesDiv = poemDiv.createDiv({ cls: "abyat-verses" });

		this.poem.verses.forEach((verse, index) => {
			if (!verse.sadr && !verse.ajaz) return; // Skip empty verses in preview

			const verseDiv = versesDiv.createDiv({
				cls: `abyat-verse ${this.poem.layout}`,
			});

			if (this.poem.numbered) {
				verseDiv.createDiv({
					cls: "abyat-verse-number",
					text: (index + 1).toString(),
				});
			}

			const sadrDiv = verseDiv.createDiv({ cls: "abyat-sadr" });
			const ajazDiv = verseDiv.createDiv({ cls: "abyat-ajaz" });

			// Make words clickable for annotations
			this.makeWordsClickable(verse.sadr, sadrDiv);
			this.makeWordsClickable(verse.ajaz, ajazDiv);
		});
	}

	private makeWordsClickable(text: string, container: HTMLElement) {
		const words = text.split(" ");

		words.forEach((word, index) => {
			if (index > 0) container.appendText(" ");

			const span = container.createSpan({
				cls: "abyat-word-clickable",
				text: word,
			});

			if (this.poem.annotations && this.poem.annotations[word]) {
				span.addClass("abyat-annotated");
				const tooltip = span.createDiv({
					cls: "abyat-tooltip",
					text: this.poem.annotations[word],
				});
			}

			span.addEventListener("click", () => {
				this.showAnnotationInput(word);
			});
		});
	}

	private showAnnotationInput(word: string) {
		this.selectedWord = word;

		const annotationSection = this.contentEl.querySelector(
			".abyat-annotation-input"
		) as HTMLElement;
		if (!annotationSection) return;

		annotationSection.empty();
		annotationSection.style.display = "block";

		const wordLabel = annotationSection.createDiv({
			cls: "abyat-annotation-word",
		});
		wordLabel.createEl("strong", { text: `كلمة: ${word}` });

		const inputDiv = annotationSection.createDiv({
			cls: "abyat-annotation-input-container",
		});

		const currentAnnotation = this.poem.annotations?.[word] || "";

		const textArea = new TextComponent(inputDiv)
			.setPlaceholder("أدخل التفسير أو الشرح")
			.setValue(currentAnnotation)
			.onChange((value) => {
				if (!this.poem.annotations) {
					this.poem.annotations = {};
				}
				if (value) {
					this.poem.annotations[word] = value;
				} else {
					delete this.poem.annotations[word];
				}
				this.updatePreview();
			});

		textArea.inputEl.addClass("abyat-annotation-textarea");

		if (currentAnnotation) {
			new ButtonComponent(inputDiv)
				.setButtonText("حذف التفسير")
				.setClass("abyat-delete-annotation")
				.onClick(() => {
					if (this.poem.annotations) {
						delete this.poem.annotations[word];
					}
					annotationSection.style.display = "none";
					this.updatePreview();
				});
		}
	}

	private addModalStyles() {
		const style = document.createElement("style");
		style.textContent = `
            .abyat {
                width: 60vw;
            }

            .abyat-modal {
                direction: rtl;
            }

            .abyat-modal-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 20px;
                max-height: 70vh;
                overflow-y: auto;
            }

            .abyat-modal-input,
            .abyat-modal-preview {
                padding: 15px;
                background: var(--background-secondary);
                border-radius: 8px;
            }

            .abyat-modal-section {
                margin-bottom: 20px;
            }

            .abyat-modal-section h3 {
                margin-bottom: 10px;
                color: var(--text-title-h3);
            }

            .abyat-verses-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .abyat-verses-container {
                max-height: 300px;
                overflow-y: auto;
            }

            .abyat-verse-input {
                background: var(--background-primary);
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 10px;
            }

            .abyat-verse-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .abyat-verse-label {
                font-weight: bold;
                color: var(--text-muted);
            }

            .abyat-verse-controls {
                display: flex;
                gap: 5px;
            }

            .abyat-verse-controls button {
                padding: 2px 8px;
                font-size: 0.9em;
            }

            .abyat-delete-btn {
                color: var(--text-error);
            }

            .abyat-verse-inputs {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .abyat-input-group {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .abyat-input-group label {
                min-width: 50px;
                font-weight: 500;
            }

            .abyat-verse-text {
                flex: 1;
                direction: rtl;
            }

            .abyat-preview-container {
                background: var(--background-primary);
                border-radius: 8px;
                padding: 15px;
                min-height: 200px;
            }

            .abyat-word-clickable {
                cursor: pointer;
                transition: background-color 0.2s;
                padding: 2px 4px 5px 4px;
                border-radius: 3px;
            }

            .abyat-word-clickable:hover {
                background: var(--background-modifier-hover);
            }

            .abyat-annotation-info {
                padding: 10px;
                background: var(--background-primary);
                border-radius: 6px;
                margin-bottom: 10px;
            }

            .abyat-annotation-hint {
                color: var(--text-muted);
                font-size: 0.9em;
                margin: 0;
            }

            .abyat-annotation-input {
                background: var(--background-primary);
                border-radius: 6px;
                padding: 10px;
            }

            .abyat-annotation-word {
                margin-bottom: 10px;
            }

            .abyat-annotation-textarea {
                width: 100%;
                min-height: 60px;
            }

            .abyat-delete-annotation {
                margin-top: 10px;
                color: var(--text-error);
            }

            .abyat-modal-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .abyat-modal-container {
                    grid-template-columns: 1fr;
                }
                
                .abyat-modal-preview {
                    order: -1;
                }
            }
        `;
		document.head.appendChild(style);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
