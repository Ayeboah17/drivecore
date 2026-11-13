import { createCn } from "cn/config"

// Keep semantic Tailwind tokens in their correct merge groups so caller
// className overrides work just like built-in font, spacing, and radius utilities.
export const cn = createCn({
  extend: {
    theme: {
      text: [
        "page-title", "page-title-lg", "section-heading", "card-heading",
        "card-heading-sm", "body", "table", "label",
      ],
      spacing: [
        "page", "card", "control", "table-row", "sidebar", "sidebar-collapsed", "topbar",
      ],
      radius: ["control", "card"],
      font: ["heading"],
    },
  },
})
