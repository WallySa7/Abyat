import { AbyatPoem, AbyatVerse } from "./types";

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
	 * layout: side-by-side
	 * size: medium
	 * numbered: true
	 * annotations: {"كلمة": "تفسير"}
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
			annotations: {},
		};
	}

	/**
	 * Parse individual metadata line (title:, poet:, etc.)
	 */
	private parseMetadataLine(line: string, poem: AbyatPoem): void {
		if (line.startsWith("title:")) {
			poem.title = line.substring(6).trim();
		} else if (line.startsWith("poet:")) {
			poem.poet = line.substring(5).trim();
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
				poem.annotations = JSON.parse(line.substring(12).trim());
			} catch (error) {
				console.error("Failed to parse annotations:", error);
				poem.annotations = {};
			}
		}
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

		lines.push(`layout: ${poem.layout}`);
		lines.push(`size: ${poem.size}`);
		lines.push(`numbered: ${poem.numbered}`);

		if (poem.annotations && Object.keys(poem.annotations).length > 0) {
			lines.push(`annotations: ${JSON.stringify(poem.annotations)}`);
		}
	}
}
