import { AbyatPoem, AbyatVerse, AbyatAnnotation } from "./types";

/**
 * Parser class responsible for converting between poem objects and markdown text
 * Handles parsing poem metadata and verses from text format
 */
export class AbyatParser {
	/**
	 * Parse poem source text into AbyatPoem object
	 *
	 * Expected format:
	 * title: القصيدة
	 * poet: الشاعر
	 * tags: حب، طبيعة، حزن
	 * layout: side-by-side
	 * size: medium
	 * numbered: true
	 * annotations: [{"text":"كلمة","annotation":"تفسير",...}]
	 * legacyAnnotations: {"كلمة": "تفسير"} (for backward compatibility)
	 * ---
	 * صدر البيت الأول | عجز البيت الأول
	 * صدر البيت الثاني | عجز البيت الثاني
	 */
	parsePoem(source: string): AbyatPoem {
		const lines = source.split("\n");
		const poem: AbyatPoem = this.createDefaultPoem();

		let isParsingMetadata = true;

		for (const line of lines) {
			const trimmedLine = line.trim();

			if (trimmedLine === "---") {
				isParsingMetadata = false;
				continue;
			}

			if (isParsingMetadata) {
				this.parseMetadataLine(trimmedLine, poem);
			} else if (trimmedLine) {
				this.parseVerseLine(trimmedLine, poem);
			}
		}

		// Convert legacy annotations if present and no new annotations exist
		if (
			poem.legacyAnnotations &&
			(!poem.annotations || poem.annotations.length === 0)
		) {
			poem.annotations = this.convertLegacyAnnotations(
				poem.legacyAnnotations,
				poem.verses
			);
			delete poem.legacyAnnotations;
		}

		return poem;
	}

	/**
	 * Generate markdown text from AbyatPoem object
	 */
	generatePoemMarkdown(poem: AbyatPoem): string {
		const lines: string[] = ["```abyat"];

		// Add metadata
		this.addMetadataToLines(poem, lines);

		// Add separator
		lines.push("---");

		// Add verses
		poem.verses.forEach((verse) => {
			lines.push(`${verse.sadr} | ${verse.ajaz}`);
		});

		lines.push("```");
		return lines.join("\n");
	}

	/**
	 * Create default poem structure
	 */
	private createDefaultPoem(): AbyatPoem {
		return {
			verses: [],
			layout: "side-by-side",
			size: "medium",
			numbered: false,
			tags: [],
			annotations: [],
		};
	}

	/**
	 * Convert legacy annotations to new format
	 */
	private convertLegacyAnnotations(
		legacyAnnotations: Record<string, string>,
		verses: AbyatVerse[]
	): AbyatAnnotation[] {
		const annotations: AbyatAnnotation[] = [];
		let annotationId = 0;

		verses.forEach((verse, verseIndex) => {
			// Check sadr
			Object.keys(legacyAnnotations).forEach((word) => {
				const index = verse.sadr.indexOf(word);
				if (index !== -1) {
					annotations.push({
						id: `legacy_${annotationId++}`,
						text: word,
						annotation: legacyAnnotations[word],
						verseIndex,
						part: "sadr",
						startPos: index,
						endPos: index + word.length,
					});
				}
			});

			// Check ajaz
			Object.keys(legacyAnnotations).forEach((word) => {
				const index = verse.ajaz.indexOf(word);
				if (index !== -1) {
					annotations.push({
						id: `legacy_${annotationId++}`,
						text: word,
						annotation: legacyAnnotations[word],
						verseIndex,
						part: "ajaz",
						startPos: index,
						endPos: index + word.length,
					});
				}
			});
		});

		return annotations;
	}

	/**
	 * Parse individual metadata line (title:, poet:, tags:, etc.)
	 */
	private parseMetadataLine(line: string, poem: AbyatPoem): void {
		if (line.startsWith("title:")) {
			poem.title = line.substring(6).trim();
		} else if (line.startsWith("poet:")) {
			poem.poet = line.substring(5).trim();
		} else if (line.startsWith("tags:")) {
			const tagsString = line.substring(5).trim();
			poem.tags = this.parseTags(tagsString);
		} else if (line.startsWith("layout:")) {
			const layout = line.substring(7).trim();
			if (layout === "side-by-side" || layout === "stacked") {
				poem.layout = layout;
			}
		} else if (line.startsWith("size:")) {
			const size = line.substring(5).trim();
			if (size === "small" || size === "medium" || size === "large") {
				poem.size = size;
			}
		} else if (line.startsWith("numbered:")) {
			poem.numbered = line.substring(9).trim() === "true";
		} else if (line.startsWith("annotations:")) {
			try {
				const annotationsStr = line.substring(12).trim();
				const parsed = JSON.parse(annotationsStr);
				if (Array.isArray(parsed)) {
					poem.annotations = parsed as AbyatAnnotation[];
				}
			} catch (error) {
				console.error("Failed to parse annotations:", error);
				poem.annotations = [];
			}
		} else if (line.startsWith("legacyAnnotations:")) {
			try {
				poem.legacyAnnotations = JSON.parse(line.substring(18).trim());
			} catch (error) {
				console.error("Failed to parse legacy annotations:", error);
			}
		}
	}

	/**
	 * Parse tags from string - supports both comma-separated and JSON array formats
	 */
	private parseTags(tagsString: string): string[] {
		if (!tagsString) return [];

		// Try to parse as JSON array first
		if (tagsString.startsWith("[") && tagsString.endsWith("]")) {
			try {
				const parsed = JSON.parse(tagsString);
				return Array.isArray(parsed)
					? parsed.filter((tag) => typeof tag === "string")
					: [];
			} catch (error) {
				console.error("Failed to parse tags as JSON:", error);
			}
		}

		// Parse as comma-separated values
		return tagsString
			.split(/[،,]/) // Support both Arabic and English commas
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
	}

	/**
	 * Convert tags array to string format for storage
	 */
	private formatTags(tags: string[]): string {
		if (!tags || tags.length === 0) return "";

		// Use comma-separated format for readability
		return tags.join("، "); // Arabic comma with space
	}

	/**
	 * Parse individual verse line (صدر | عجز format)
	 */
	private parseVerseLine(line: string, poem: AbyatPoem): void {
		const parts = line.split("|").map((part) => part.trim());

		if (parts.length === 2) {
			const verse: AbyatVerse = {
				sadr: parts[0], // صدر البيت (first half)
				ajaz: parts[1], // عجز البيت (second half)
			};
			poem.verses.push(verse);
		}
	}

	/**
	 * Add poem metadata to markdown lines array
	 */
	private addMetadataToLines(poem: AbyatPoem, lines: string[]): void {
		if (poem.title) {
			lines.push(`title: ${poem.title}`);
		}

		if (poem.poet) {
			lines.push(`poet: ${poem.poet}`);
		}

		if (poem.tags && poem.tags.length > 0) {
			lines.push(`tags: ${this.formatTags(poem.tags)}`);
		}

		lines.push(`layout: ${poem.layout}`);
		lines.push(`size: ${poem.size}`);
		lines.push(`numbered: ${poem.numbered}`);

		// Save new format annotations
		if (poem.annotations && poem.annotations.length > 0) {
			lines.push(`annotations: ${JSON.stringify(poem.annotations)}`);
		}

		// Save legacy annotations if they still exist (for backward compatibility)
		if (
			poem.legacyAnnotations &&
			Object.keys(poem.legacyAnnotations).length > 0
		) {
			lines.push(
				`legacyAnnotations: ${JSON.stringify(poem.legacyAnnotations)}`
			);
		}
	}
}
