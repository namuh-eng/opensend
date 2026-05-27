import { useCallback, useEffect, useRef, useState } from "react";
import { BlockRenderer } from "./block-renderer";
import {
  type BlockType,
  COMPONENT_ITEMS,
  type EditorBlock,
  SLASH_MENU_ITEMS,
  VARIABLES,
} from "./types";

type ToolbarTab = "text" | "image" | "components" | "variables";

type BlockEditorCanvasProps = {
  blocks: EditorBlock[];
  onBlocksChange: (next: EditorBlock[]) => void;
  ariaLabel?: string;
  className?: string;
};

export function BlockEditorCanvas({
  blocks,
  onBlocksChange,
  ariaLabel = "Content editor",
  className,
}: BlockEditorCanvasProps) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [activeToolbarTab, setActiveToolbarTab] = useState<ToolbarTab>("text");
  const slashMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node)
      ) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const insertBlock = useCallback(
    (type: BlockType, content = "") => {
      const newBlock: EditorBlock = {
        id: crypto.randomUUID(),
        type,
        content,
      };
      onBlocksChange([...blocks, newBlock]);
      setSlashMenuOpen(false);
    },
    [blocks, onBlocksChange],
  );

  const updateBlockContent = useCallback(
    (id: string, content: string) => {
      onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
    },
    [blocks, onBlocksChange],
  );

  const removeBlock = useCallback(
    (id: string) => {
      onBlocksChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onBlocksChange],
  );

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/") setSlashMenuOpen(true);
    if (e.key === "Escape") setSlashMenuOpen(false);
  };

  return (
    <div className={className}>
      <div className="relative">
        <div
          data-testid="block-editor"
          className="min-h-[400px] border border-line rounded-lg p-4 relative"
          onKeyDown={handleEditorKeyDown}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: editor needs keyboard focus for slash commands
          tabIndex={0}
          aria-label={ariaLabel}
        >
          {blocks.length === 0 && !slashMenuOpen && (
            <p className="text-[14px] text-fg-4">
              Press &apos;/&apos; for commands
            </p>
          )}

          {blocks.map((block) => (
            <div
              key={block.id}
              data-testid={`block-${block.type}`}
              className="group relative mb-3"
            >
              <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="p-0.5 text-fg-4 hover:text-red-400 text-xs"
                  title="Remove block"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <BlockRenderer
                block={block}
                onUpdate={(content) => updateBlockContent(block.id, content)}
              />
            </div>
          ))}

          {slashMenuOpen && (
            <div
              ref={slashMenuRef}
              className="absolute left-4 z-50 w-[280px] max-h-[360px] overflow-y-auto bg-bg-card border border-line rounded-lg shadow-xl"
              style={{
                top:
                  blocks.length > 0 ? `${blocks.length * 48 + 16}px` : "16px",
              }}
            >
              {SLASH_MENU_ITEMS.map((category) => (
                <div key={category.category}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-fg-4 uppercase tracking-wider">
                    {category.category}
                  </div>
                  {category.items.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => insertBlock(item.type)}
                      className="w-full px-3 py-2 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors flex items-center gap-2.5"
                    >
                      <span className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.06] text-[11px] font-mono shrink-0">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-bg-card mt-3">
        <div className="flex items-center border-b border-line px-4">
          {(
            [
              { key: "text", label: "Text" },
              { key: "image", label: "Image" },
              { key: "components", label: "Components" },
              { key: "variables", label: "Variables" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveToolbarTab(tab.key)}
              className={`px-3 py-2.5 text-[13px] font-medium transition-colors relative ${
                activeToolbarTab === tab.key
                  ? "text-fg"
                  : "text-fg-4 hover:text-fg-2"
              }`}
            >
              {tab.label}
              {activeToolbarTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-2 min-h-[44px]">
          {activeToolbarTab === "text" && (
            <div className="flex items-center gap-1">
              {[
                { title: "Bold", icon: "B", style: "font-bold" },
                { title: "Italic", icon: "I", style: "italic" },
                { title: "Underline", icon: "U", style: "underline" },
                {
                  title: "Strikethrough",
                  icon: "S",
                  style: "line-through",
                },
                { title: "Code", icon: "</>", style: "font-mono text-[11px]" },
                { title: "Uppercase", icon: "AA", style: "text-[11px]" },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                >
                  <span className={btn.style}>{btn.icon}</span>
                </button>
              ))}

              <span className="w-px h-5 bg-white/10 mx-1" />

              {[
                { title: "Align left", icon: "≡" },
                { title: "Align center", icon: "≡" },
                { title: "Align right", icon: "≡" },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                >
                  {btn.icon}
                </button>
              ))}

              <span className="w-px h-5 bg-white/10 mx-1" />

              {[
                { title: "Bullet list", icon: "•" },
                { title: "Numbered list", icon: "1." },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  className="w-8 h-8 flex items-center justify-center rounded text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          )}

          {activeToolbarTab === "image" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 px-3 text-[13px] text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors"
              >
                Upload image
              </button>
              <span className="text-[12px] text-fg-4">or drag and drop</span>
            </div>
          )}

          {activeToolbarTab === "components" && (
            <div className="flex items-center gap-1 flex-wrap">
              {COMPONENT_ITEMS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => insertBlock(item.type)}
                  className="h-8 px-3 text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg rounded transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[11px] font-mono">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {activeToolbarTab === "variables" && (
            <div className="flex items-center gap-1 flex-wrap">
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => insertBlock("variable", v.value)}
                  className="h-8 px-2.5 text-[12px] font-mono text-fg-2 hover:bg-white/[0.08] hover:text-fg rounded border border-line transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
