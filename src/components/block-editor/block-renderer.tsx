import type { EditorBlock } from "./types";

export function BlockRenderer({
  block,
  onUpdate,
}: {
  block: EditorBlock;
  onUpdate: (content: string) => void;
}) {
  switch (block.type) {
    case "title":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent border-none outline-none text-[28px] font-bold text-fg placeholder-[#444]"
        />
      );
    case "subtitle":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Subtitle"
          className="w-full bg-transparent border-none outline-none text-[20px] font-semibold text-fg-2 placeholder-[#444]"
        />
      );
    case "heading":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Heading"
          className="w-full bg-transparent border-none outline-none text-[18px] font-semibold text-fg placeholder-[#444]"
        />
      );
    case "quote":
      return (
        <div className="border-l-2 border-fg-2 pl-4">
          <textarea
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="Quote"
            rows={2}
            className="w-full bg-transparent border-none outline-none text-[14px] italic text-fg-2 placeholder-[#444] resize-none"
          />
        </div>
      );
    case "code_block":
      return (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Code"
          rows={4}
          className="w-full bg-white/[0.03] border border-line rounded-md p-3 font-mono text-[13px] text-fg placeholder-[#444] resize-none outline-none"
        />
      );
    case "bullet_list":
      return (
        <div className="flex items-start gap-2">
          <span className="text-fg-2 mt-0.5">&#8226;</span>
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="List item"
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-fg placeholder-[#444]"
          />
        </div>
      );
    case "numbered_list":
      return (
        <div className="flex items-start gap-2">
          <span className="text-fg-2 mt-0.5">1.</span>
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="List item"
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-fg placeholder-[#444]"
          />
        </div>
      );
    case "image":
      return (
        <div className="border border-dashed border-line-2 rounded-lg p-8 text-center">
          <p className="text-[13px] text-fg-4">
            Click to upload or drag and drop an image
          </p>
        </div>
      );
    case "youtube":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Paste YouTube URL..."
          className="w-full bg-white/[0.03] border border-line rounded-md px-3 py-2 text-[13px] text-fg placeholder-[#444] outline-none"
        />
      );
    case "twitter":
      return (
        <input
          type="text"
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Paste X/Twitter URL..."
          className="w-full bg-white/[0.03] border border-line rounded-md px-3 py-2 text-[13px] text-fg placeholder-[#444] outline-none"
        />
      );
    case "button":
      return (
        <div className="flex justify-center">
          <input
            type="text"
            value={block.content || "Button"}
            onChange={(e) => onUpdate(e.target.value)}
            className="btn btn-primary min-w-[120px] text-center"
          />
        </div>
      );
    case "divider":
      return <hr className="border-t border-line-2 my-2" />;
    case "section":
      return (
        <div className="border border-line rounded-lg p-4 min-h-[60px]">
          <p className="text-[12px] text-fg-4">Section block</p>
        </div>
      );
    case "columns":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-line rounded-lg p-3 min-h-[60px]">
            <p className="text-[12px] text-fg-4">Column 1</p>
          </div>
          <div className="border border-line rounded-lg p-3 min-h-[60px]">
            <p className="text-[12px] text-fg-4">Column 2</p>
          </div>
        </div>
      );
    case "social_links":
      return (
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-[13px] text-fg-2">Social Links</span>
        </div>
      );
    case "unsubscribe_footer":
      return (
        <div className="text-center py-3 text-[12px] text-fg-4">
          <a href="{{{OPENSEND_UNSUBSCRIBE_URL}}}" className="underline">
            Unsubscribe
          </a>
        </div>
      );
    case "html":
      return (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="<html>...</html>"
          rows={6}
          className="w-full bg-white/[0.03] border border-line rounded-md p-3 font-mono text-[13px] text-fg placeholder-[#444] resize-none outline-none"
        />
      );
    case "variable":
      return (
        <span className="inline-block px-2 py-1 bg-white/[0.08] rounded text-[13px] font-mono text-fg-2 border border-line">
          {block.content}
        </span>
      );
    default:
      return (
        <textarea
          value={block.content}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Type something..."
          rows={2}
          className="w-full bg-transparent border-none outline-none text-[14px] text-fg placeholder-[#444] resize-none"
        />
      );
  }
}
