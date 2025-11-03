#### **Content Formatting Rule: Granular Anchors**

Within Markdown file, you MUST make the content "addressable" by inserting unique anchors. An anchor is a machine-readable HTML comment placed directly before a heading.

*   **Format:** The anchor format MUST be `<!-- anchor: [unique-kebab-case-key] -->`.
*   **Placement:** Place an anchor immediately before any sub-heading (e.g., `### 3.1`, `#### 3.8.1`) that represents a distinct concept a future agent might need to reference.