import {
	Plugin,
	MarkdownPostProcessorContext,
	MarkdownView,
	Menu,
} from "obsidian";
import { AbyatModal } from "./src/modal";
import { AbyatVerse, AbyatPoem } from "./src/types";

export default class AbyatPlugin extends Plugin {
	async onload() {
		// Add command to insert poem
		this.addCommand({
			id: "insert-abyat",
			name: "Insert Arabic Poem",
			editorCallback: (editor, view) => {
				const modal = new AbyatModal(this.app, (poem) => {
					const poemBlock = this.generatePoemBlock(poem);
					editor.replaceSelection(poemBlock);
				});
				modal.open();
			},
		});

		// Register markdown post processor
		this.registerMarkdownPostProcessor((element, context) => {
			const codeblocks = element.querySelectorAll("code");

			codeblocks.forEach((codeblock) => {
				const text = codeblock.innerText.trim();
				if (text.startsWith("```abyat")) {
					this.renderPoem(codeblock, text, context);
				}
			});
		});

		// Register the code block processor
		this.registerMarkdownCodeBlockProcessor("abyat", (source, el, ctx) => {
			this.renderPoemFromSource(source, el, ctx);
		});

		// Add styles
		this.addStyles();
	}

	private addStyles() {
		const style = document.createElement("style");
		style.textContent = `
            .abyat-container {
                background: var(--background-primary);
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                direction: rtl;
                font-family: var(--font-text);
                position: relative;
            }

            .abyat-header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid var(--background-modifier-border);
                padding-bottom: 10px;
            }

            .abyat-title {
                font-size: 1.4em;
                font-weight: bold;
                color: var(--text-title-h2);
                margin-bottom: 8px;
            }

            .abyat-poet {
                font-size: 1.1em;
                color: var(--text-muted);
            }

            .abyat-verses {
                margin: 20px 0;
            }

            .abyat-verse {
                margin: 15px 0;
                position: relative;
            }

            .abyat-verse-number {
                position: absolute;
                right: -30px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted);
                font-size: 0.9em;
            }

            /* Side by side layout */
            .abyat-verse.side-by-side {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 40px;
            }

            .abyat-verse.side-by-side .abyat-sadr,
            .abyat-verse.side-by-side .abyat-ajaz {
                flex: 1;
                text-align: center;
            }

            /* Stacked layout */
            .abyat-verse.stacked {
                display: flex;
                flex-direction: column;
            }

            .abyat-verse.stacked .abyat-sadr {
                text-align: right;
                padding-right: 0;
            }

            .abyat-verse.stacked .abyat-ajaz {
                text-align: right;
                padding-right: 60px;
            }

            /* Size variants */
            .abyat-container.small {
                padding: 12px;
                margin: 10px 0;
            }

            .abyat-container.small .abyat-title {
                font-size: 1.1em;
            }

            .abyat-container.small .abyat-poet {
                font-size: 0.95em;
            }

            .abyat-container.small .abyat-verse {
                font-size: 0.95em;
                margin: 10px 0;
            }

            .abyat-container.large {
                padding: 30px;
                margin: 30px 0;
            }

            .abyat-container.large .abyat-title {
                font-size: 1.8em;
            }

            .abyat-container.large .abyat-poet {
                font-size: 1.3em;
            }

            .abyat-container.large .abyat-verse {
                font-size: 1.3em;
                margin: 25px 0;
            }

            /* Annotated word */
            .abyat-annotated {
                cursor: help;
                border-bottom: 1px solid var(--text-accent);
                position: relative;
            }

            .abyat-tooltip {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                padding: 8px 12px;
                font-size: 0.9em;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
                margin-bottom: 5px;
            }

            .abyat-annotated:hover .abyat-tooltip {
                opacity: 1;
            }

            /* Edit button */
            .abyat-edit-btn {
                position: absolute;
                top: 10px;
                left: 10px;
                background: var(--background-modifier-hover);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 0.9em;
                opacity: 0;
                transition: opacity 0.2s;
            }

            .abyat-container:hover .abyat-edit-btn {
                opacity: 1;
            }

            .abyat-edit-btn:hover {
                background: var(--background-modifier-active);
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .abyat-container {
                    padding: 15px;
                    margin: 15px 0;
                }

                .abyat-verse.side-by-side {
                    flex-direction: column;
                    gap: 10px;
                }

                .abyat-verse-number {
                    position: static;
                    display: inline-block;
                    margin-left: 10px;
                }

            }
        `;
		document.head.appendChild(style);
	}

	private generatePoemBlock(poem: AbyatPoem): string {
		const lines: string[] = ["```abyat"];

		if (poem.title) lines.push(`title: ${poem.title}`);
		if (poem.poet) lines.push(`poet: ${poem.poet}`);
		lines.push(`layout: ${poem.layout}`);
		lines.push(`size: ${poem.size}`);
		lines.push(`numbered: ${poem.numbered}`);

		if (poem.annotations && Object.keys(poem.annotations).length > 0) {
			lines.push(`annotations: ${JSON.stringify(poem.annotations)}`);
		}

		lines.push("---");

		poem.verses.forEach((verse) => {
			lines.push(`${verse.sadr} | ${verse.ajaz}`);
		});

		lines.push("```");
		return lines.join("\n");
	}

	private renderPoemFromSource(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	) {
		const poem = this.parsePoem(source);
		this.createPoemElement(poem, el, ctx, source);
	}

	private renderPoem(
		codeblock: HTMLElement,
		text: string,
		context: MarkdownPostProcessorContext
	) {
		const source = text.replace(/^```abyat\n/, "").replace(/\n```$/, "");
		const poem = this.parsePoem(source);

		const container = document.createElement("div");
		this.createPoemElement(poem, container, context, source);

		codeblock.replaceWith(container);
	}

	private parsePoem(source: string): AbyatPoem {
		const lines = source.split("\n");
		const poem: AbyatPoem = {
			verses: [],
			layout: "side-by-side",
			size: "medium",
			numbered: false,
			annotations: {},
		};

		let inMetadata = true;

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed === "---") {
				inMetadata = false;
				continue;
			}

			if (inMetadata) {
				if (trimmed.startsWith("title:")) {
					poem.title = trimmed.substring(6).trim();
				} else if (trimmed.startsWith("poet:")) {
					poem.poet = trimmed.substring(5).trim();
				} else if (trimmed.startsWith("layout:")) {
					poem.layout = trimmed.substring(7).trim() as
						| "side-by-side"
						| "stacked";
				} else if (trimmed.startsWith("size:")) {
					poem.size = trimmed.substring(5).trim() as
						| "small"
						| "medium"
						| "large";
				} else if (trimmed.startsWith("numbered:")) {
					poem.numbered = trimmed.substring(9).trim() === "true";
				} else if (trimmed.startsWith("annotations:")) {
					try {
						poem.annotations = JSON.parse(
							trimmed.substring(12).trim()
						);
					} catch (e) {
						console.error("Failed to parse annotations:", e);
					}
				}
			} else if (trimmed) {
				const parts = trimmed.split("|").map((p) => p.trim());
				if (parts.length === 2) {
					poem.verses.push({
						sadr: parts[0],
						ajaz: parts[1],
					});
				}
			}
		}

		return poem;
	}

	private createPoemElement(
		poem: AbyatPoem,
		container: HTMLElement,
		ctx?: MarkdownPostProcessorContext,
		originalSource?: string
	) {
		container.empty();

		const poemDiv = container.createDiv({
			cls: `abyat-container ${poem.size}`,
		});

		// Add edit button
		const editBtn = poemDiv.createDiv({
			cls: "abyat-edit-btn",
			text: "تعديل",
		});
		const originalBlock = "```abyat\n" + (originalSource ?? "") + "\n```";

		editBtn.addEventListener("click", async () => {
			const modal = new AbyatModal(
				this.app,
				async (updatedPoem) => {
					const poemBlock = this.generatePoemBlock(updatedPoem);
					const file = this.app.workspace.getActiveFile();
					if (file) {
						try {
							const content = await this.app.vault.read(file);

							// Replace the exact block that was rendered
							const newContent = content.replace(
								originalBlock,
								poemBlock
							);

							if (newContent === content) {
								console.warn(
									"Poem block not found for replacement"
								);
								return;
							}

							await this.app.vault.modify(file, newContent);
						} catch (error) {
							console.error("Failed to update poem:", error);
						}
					}
				},
				poem
			);
			modal.open();
		});

		// Add header if title or poet exists
		if (poem.title || poem.poet) {
			const header = poemDiv.createDiv({ cls: "abyat-header" });
			if (poem.title) {
				header.createDiv({ cls: "abyat-title", text: poem.title });
			}
			if (poem.poet) {
				header.createDiv({
					cls: "abyat-poet",
					text: `- ${poem.poet} -`,
				});
			}
		}

		// Add verses
		const versesDiv = poemDiv.createDiv({ cls: "abyat-verses" });

		poem.verses.forEach((verse, index) => {
			const verseDiv = versesDiv.createDiv({
				cls: `abyat-verse ${poem.layout}`,
			});

			if (poem.numbered) {
				verseDiv.createDiv({
					cls: "abyat-verse-number",
					text: (index + 1).toString(),
				});
			}

			const sadrDiv = verseDiv.createDiv({ cls: "abyat-sadr" });
			const ajazDiv = verseDiv.createDiv({ cls: "abyat-ajaz" });

			// Process annotations
			this.processTextWithAnnotations(
				verse.sadr,
				sadrDiv,
				poem.annotations || {}
			);
			this.processTextWithAnnotations(
				verse.ajaz,
				ajazDiv,
				poem.annotations || {}
			);
		});
	}

	private processTextWithAnnotations(
		text: string,
		container: HTMLElement,
		annotations: Record<string, string>
	) {
		const words = text.split(" ");

		words.forEach((word, index) => {
			if (index > 0) container.appendText(" ");

			if (annotations[word]) {
				const span = container.createSpan({
					cls: "abyat-annotated",
					text: word,
				});
				span.createDiv({
					cls: "abyat-tooltip",
					text: annotations[word],
				});
			} else {
				container.appendText(word);
			}
		});
	}
}
