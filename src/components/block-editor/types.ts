export type BlockType =
  | "text"
  | "title"
  | "subtitle"
  | "heading"
  | "bullet_list"
  | "numbered_list"
  | "quote"
  | "code_block"
  | "image"
  | "youtube"
  | "twitter"
  | "button"
  | "divider"
  | "section"
  | "columns"
  | "social_links"
  | "unsubscribe_footer"
  | "html"
  | "variable";

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string;
}

export type SlashMenuItem = {
  type: BlockType;
  label: string;
  icon: string;
};

export type SlashMenuCategory = {
  category: string;
  items: SlashMenuItem[];
};

export const SLASH_MENU_ITEMS: SlashMenuCategory[] = [
  {
    category: "Text",
    items: [
      { type: "text", label: "Text", icon: "T" },
      { type: "title", label: "Title", icon: "H1" },
      { type: "subtitle", label: "Subtitle", icon: "H2" },
      { type: "heading", label: "Heading", icon: "H3" },
      { type: "bullet_list", label: "Bullet list", icon: "•" },
      { type: "numbered_list", label: "Numbered list", icon: "1." },
      { type: "quote", label: "Quote", icon: "❝" },
      { type: "code_block", label: "Code block", icon: "</>" },
    ],
  },
  {
    category: "Media",
    items: [
      { type: "image", label: "Image", icon: "\u{1F5BC}" },
      { type: "youtube", label: "YouTube", icon: "▶" },
      { type: "twitter", label: "X/Twitter", icon: "\u{1D54F}" },
    ],
  },
  {
    category: "Layout",
    items: [
      { type: "button", label: "Button", icon: "▢" },
      { type: "divider", label: "Divider", icon: "—" },
      { type: "section", label: "Section", icon: "☐" },
      { type: "columns", label: "Columns", icon: "▥" },
      { type: "social_links", label: "Social Links", icon: "\u{1F517}" },
      {
        type: "unsubscribe_footer",
        label: "Unsubscribe Footer",
        icon: "✉",
      },
    ],
  },
  {
    category: "Utility",
    items: [
      { type: "html", label: "HTML", icon: "<>" },
      { type: "variable", label: "Variable", icon: "{}" },
    ],
  },
];

export const VARIABLES: { label: string; value: string }[] = [
  { label: "{{{contact.first_name}}}", value: "{{{contact.first_name}}}" },
  { label: "{{{contact.last_name}}}", value: "{{{contact.last_name}}}" },
  { label: "{{{contact.email}}}", value: "{{{contact.email}}}" },
  {
    label: "{{{contact.company_name}}}",
    value: "{{{contact.company_name}}}",
  },
  {
    label: "{{{OPENSEND_UNSUBSCRIBE_URL}}}",
    value: "{{{OPENSEND_UNSUBSCRIBE_URL}}}",
  },
];

export const COMPONENT_ITEMS: SlashMenuItem[] = (
  SLASH_MENU_ITEMS.find((c) => c.category === "Layout")?.items ?? []
).concat(
  (SLASH_MENU_ITEMS.find((c) => c.category === "Utility")?.items ?? []).filter(
    (i) => i.type === "html" || i.type === "code_block",
  ),
);
