"use client";

import { useCallback, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────

type BodyLayout = "full" | "centered" | "narrow";
type Decoration = "none" | "underline" | "strikethrough";
type ThemePreset = "minimal" | "basic";
type SidebarPanel = "page-style" | "theme" | "global-css";

interface TextStyle {
  color: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
  decoration: Decoration;
}

export interface BroadcastStyle {
  background: { color: string; padding: number };
  body: {
    layout: BodyLayout;
    color: string;
    width: number;
    height: number | "auto";
    padding: number;
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
  };
  theme: ThemePreset;
  textStyles: Record<"text" | "title" | "subtitle" | "heading", TextStyle>;
  globalCSS: string;
}

// ── Defaults ───────────────────────────────────────────────────────

const THEME_MINIMAL: BroadcastStyle["textStyles"] = {
  text: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 1.5,
    letterSpacing: 0,
    decoration: "none",
  },
  title: {
    color: "#111827",
    fontSize: 31,
    fontWeight: "600",
    lineHeight: 1.2,
    letterSpacing: 0,
    decoration: "none",
  },
  subtitle: {
    color: "#111827",
    fontSize: 25,
    fontWeight: "600",
    lineHeight: 1.3,
    letterSpacing: 0,
    decoration: "none",
  },
  heading: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 1.4,
    letterSpacing: 0,
    decoration: "none",
  },
};

const THEME_BASIC: BroadcastStyle["textStyles"] = {
  text: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 1.6,
    letterSpacing: 0,
    decoration: "none",
  },
  title: {
    color: "#1f2937",
    fontSize: 31,
    fontWeight: "700",
    lineHeight: 1.2,
    letterSpacing: -0.5,
    decoration: "none",
  },
  subtitle: {
    color: "#1f2937",
    fontSize: 25,
    fontWeight: "600",
    lineHeight: 1.3,
    letterSpacing: -0.3,
    decoration: "none",
  },
  heading: {
    color: "#1f2937",
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 1.4,
    letterSpacing: 0,
    decoration: "none",
  },
};

export const DEFAULT_BROADCAST_STYLE: BroadcastStyle = {
  background: { color: "#000000", padding: 32 },
  body: {
    layout: "centered",
    color: "#ffffff",
    width: 600,
    height: "auto",
    padding: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "#000000",
  },
  theme: "minimal",
  textStyles: { ...THEME_MINIMAL },
  globalCSS: "",
};

const QUICK_INSERTS: Record<string, string> = {
  "@media dark":
    "@media (prefers-color-scheme: dark) {\n  /* dark mode styles */\n}",
  "@media mobile":
    "@media only screen and (max-width: 600px) {\n  /* mobile styles */\n}",
  ".button":
    ".button {\n  background-color: #000000;\n  color: #ffffff;\n  padding: 12px 24px;\n  border-radius: 4px;\n  text-decoration: none;\n}",
};

const TEXT_LEVELS: {
  key: "text" | "title" | "subtitle" | "heading";
  label: string;
}[] = [
  { key: "text", label: "Text" },
  { key: "title", label: "Title" },
  { key: "subtitle", label: "Subtitle" },
  { key: "heading", label: "Heading" },
];

const FONT_WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
];

// ── Helper: collapsible section ────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-semibold text-fg-2 uppercase tracking-wider hover:bg-white/[0.03] transition-colors"
      >
        {title}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={`transition-transform ${open ? "" : "-rotate-90"}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Number input ───────────────────────────────────────────────────

function NumInput({
  value,
  onChange,
  testId,
  suffix,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  testId?: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type="number"
        data-testid={testId}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-7 px-2 text-[12px] text-fg bg-white/[0.06] border border-line rounded outline-none focus:border-line-3 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="absolute right-2 text-[10px] text-fg-4 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Color picker ───────────────────────────────────────────────────

function ColorInput({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-line cursor-pointer bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-7 px-2 text-[12px] text-fg bg-white/[0.06] border border-line rounded outline-none focus:border-line-3 transition-colors font-mono"
      />
    </div>
  );
}

// ── Row helper ─────────────────────────────────────────────────────

function Row({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="text-[11px] text-fg-3 shrink-0 w-[80px]">{label}</span>
      <div className="flex-1 max-w-[160px]">{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function BroadcastEditorSidebar({
  style,
  onChange,
  onClose,
  initialPanel = "page-style",
}: {
  style: BroadcastStyle;
  onChange: (style: BroadcastStyle) => void;
  onClose: () => void;
  initialPanel?: SidebarPanel;
}) {
  const [activePanel, setActivePanel] = useState<SidebarPanel>(initialPanel);

  const update = useCallback(
    (partial: Partial<BroadcastStyle>) => {
      onChange({ ...style, ...partial });
    },
    [style, onChange],
  );

  const updateBody = useCallback(
    (partial: Partial<BroadcastStyle["body"]>) => {
      onChange({ ...style, body: { ...style.body, ...partial } });
    },
    [style, onChange],
  );

  const updateBackground = useCallback(
    (partial: Partial<BroadcastStyle["background"]>) => {
      onChange({ ...style, background: { ...style.background, ...partial } });
    },
    [style, onChange],
  );

  const updateTextStyle = useCallback(
    (
      level: keyof BroadcastStyle["textStyles"],
      partial: Partial<TextStyle>,
    ) => {
      onChange({
        ...style,
        textStyles: {
          ...style.textStyles,
          [level]: { ...style.textStyles[level], ...partial },
        },
      });
    },
    [style, onChange],
  );

  return (
    <div
      data-testid="editor-right-sidebar"
      className="w-[300px] h-full border-l border-line bg-bg-card flex flex-col shrink-0 overflow-hidden"
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-line shrink-0">
        <div className="flex items-center gap-1">
          {(
            [
              { key: "page-style", label: "Page style" },
              { key: "theme", label: "Theme" },
              { key: "global-css", label: "Global CSS" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePanel(tab.key)}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                activePanel === tab.key
                  ? "text-fg bg-white/10"
                  : "text-fg-4 hover:text-fg-2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="p-1 rounded text-fg-4 hover:text-fg hover:bg-white/[0.08] transition-colors"
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activePanel === "page-style" && (
          <PageStylePanel
            style={style}
            onUpdateBackground={updateBackground}
            onUpdateBody={updateBody}
            onSwitchToTheme={() => setActivePanel("theme")}
            onSwitchToCSS={() => setActivePanel("global-css")}
          />
        )}

        {activePanel === "theme" && (
          <ThemePanel
            style={style}
            onUpdate={update}
            onUpdateTextStyle={updateTextStyle}
          />
        )}

        {activePanel === "global-css" && (
          <GlobalCSSPanel style={style} onUpdate={update} />
        )}
      </div>
    </div>
  );
}

// ── Page Style Panel ───────────────────────────────────────────────

function PageStylePanel({
  style,
  onUpdateBackground,
  onUpdateBody,
  onSwitchToTheme,
  onSwitchToCSS,
}: {
  style: BroadcastStyle;
  onUpdateBackground: (p: Partial<BroadcastStyle["background"]>) => void;
  onUpdateBody: (p: Partial<BroadcastStyle["body"]>) => void;
  onSwitchToTheme: () => void;
  onSwitchToCSS: () => void;
}) {
  return (
    <>
      <CollapsibleSection title="Background">
        <Row label="Color">
          <ColorInput
            value={style.background.color}
            onChange={(color) => onUpdateBackground({ color })}
            testId="bg-color"
          />
        </Row>
        <Row label="Padding">
          <NumInput
            value={style.background.padding}
            onChange={(padding) => onUpdateBackground({ padding })}
            testId="bg-padding"
            suffix="px"
            min={0}
          />
        </Row>
      </CollapsibleSection>

      <CollapsibleSection title="Body">
        {/* Layout options */}
        <div className="mb-3">
          <span className="text-[11px] text-fg-3 block mb-1.5">Layout</span>
          <div className="flex gap-1">
            {(["full", "centered", "narrow"] as const).map((layout) => (
              <button
                key={layout}
                type="button"
                data-testid={`layout-${layout}`}
                onClick={() => onUpdateBody({ layout })}
                className={`flex-1 h-8 text-[11px] rounded border transition-colors ${
                  style.body.layout === layout
                    ? "border-white/30 text-fg bg-white/10"
                    : "border-line text-fg-4 hover:text-fg-2"
                }`}
              >
                {layout.charAt(0).toUpperCase() + layout.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Row label="Color">
          <ColorInput
            value={style.body.color}
            onChange={(color) => onUpdateBody({ color })}
            testId="body-color"
          />
        </Row>
        <Row label="Width">
          <NumInput
            value={style.body.width}
            onChange={(width) => onUpdateBody({ width })}
            testId="body-width"
            suffix="px"
            min={300}
            max={900}
          />
        </Row>
        <Row label="Height">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              data-testid="body-height"
              value={style.body.height === "auto" ? "auto" : style.body.height}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateBody({
                  height: val === "auto" ? "auto" : Number(val) || 0,
                });
              }}
              className="w-full h-7 px-2 text-[12px] text-fg bg-white/[0.06] border border-line rounded outline-none focus:border-line-3 transition-colors"
            />
          </div>
        </Row>
        <Row label="Padding">
          <NumInput
            value={style.body.padding}
            onChange={(padding) => onUpdateBody({ padding })}
            testId="body-padding"
            suffix="px"
            min={0}
          />
        </Row>
        <Row label="Corners">
          <NumInput
            value={style.body.borderRadius}
            onChange={(borderRadius) => onUpdateBody({ borderRadius })}
            testId="body-border-radius"
            suffix="px"
            min={0}
          />
        </Row>
        <Row label="Border width">
          <NumInput
            value={style.body.borderWidth}
            onChange={(borderWidth) => onUpdateBody({ borderWidth })}
            testId="body-border-width"
            suffix="px"
            min={0}
          />
        </Row>
        <Row label="Border color">
          <ColorInput
            value={style.body.borderColor}
            onChange={(borderColor) => onUpdateBody({ borderColor })}
            testId="body-border-color"
          />
        </Row>
      </CollapsibleSection>

      {/* Quick links to other panels */}
      <div className="px-4 py-3 space-y-2">
        <button
          type="button"
          onClick={onSwitchToTheme}
          className="w-full flex items-center justify-between h-8 px-3 text-[12px] text-fg-2 border border-line rounded hover:border-line-2 hover:text-fg transition-colors"
        >
          Edit theme
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onSwitchToCSS}
          className="w-full flex items-center justify-between h-8 px-3 text-[12px] text-fg-2 border border-line rounded hover:border-line-2 hover:text-fg transition-colors"
        >
          Global CSS
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </>
  );
}

// ── Theme Panel ────────────────────────────────────────────────────

function ThemePanel({
  style,
  onUpdate,
  onUpdateTextStyle,
}: {
  style: BroadcastStyle;
  onUpdate: (p: Partial<BroadcastStyle>) => void;
  onUpdateTextStyle: (
    level: keyof BroadcastStyle["textStyles"],
    p: Partial<TextStyle>,
  ) => void;
}) {
  const switchTheme = (preset: ThemePreset) => {
    const styles =
      preset === "minimal" ? { ...THEME_MINIMAL } : { ...THEME_BASIC };
    onUpdate({ theme: preset, textStyles: styles });
  };

  return (
    <>
      {/* Presets */}
      <div className="px-4 py-3 border-b border-line">
        <span className="text-[11px] text-fg-3 block mb-2">Preset</span>
        <div className="flex gap-2">
          {(["minimal", "basic"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`theme-preset-${preset}`}
              data-active={style.theme === preset ? "true" : "false"}
              onClick={() => switchTheme(preset)}
              className={`flex-1 h-9 text-[12px] font-medium rounded border transition-colors ${
                style.theme === preset
                  ? "border-white/30 text-fg bg-white/10"
                  : "border-line text-fg-4 hover:text-fg-2"
              }`}
            >
              {preset.charAt(0).toUpperCase() + preset.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Text style levels */}
      {TEXT_LEVELS.map((level) => (
        <CollapsibleSection
          key={level.key}
          title={level.label}
          defaultOpen={level.key === "text"}
        >
          <Row label="Color">
            <ColorInput
              value={style.textStyles[level.key].color}
              onChange={(color) => onUpdateTextStyle(level.key, { color })}
            />
          </Row>
          <Row label="Size">
            <NumInput
              value={style.textStyles[level.key].fontSize}
              onChange={(fontSize) =>
                onUpdateTextStyle(level.key, { fontSize })
              }
              suffix="px"
              min={8}
              max={72}
            />
          </Row>
          <Row label="Weight">
            <select
              value={style.textStyles[level.key].fontWeight}
              onChange={(e) =>
                onUpdateTextStyle(level.key, { fontWeight: e.target.value })
              }
              className="w-full h-7 px-2 text-[12px] text-fg bg-white/[0.06] border border-line rounded outline-none focus:border-line-3 transition-colors"
            >
              {FONT_WEIGHTS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Height">
            <NumInput
              value={style.textStyles[level.key].lineHeight}
              onChange={(lineHeight) =>
                onUpdateTextStyle(level.key, { lineHeight })
              }
              min={0.5}
              max={4}
            />
          </Row>
          <Row label="Spacing">
            <NumInput
              value={style.textStyles[level.key].letterSpacing}
              onChange={(letterSpacing) =>
                onUpdateTextStyle(level.key, { letterSpacing })
              }
              suffix="px"
            />
          </Row>
          <Row label="Decoration">
            <select
              value={style.textStyles[level.key].decoration}
              onChange={(e) =>
                onUpdateTextStyle(level.key, {
                  decoration: e.target.value as Decoration,
                })
              }
              className="w-full h-7 px-2 text-[12px] text-fg bg-white/[0.06] border border-line rounded outline-none focus:border-line-3 transition-colors"
            >
              <option value="none">None</option>
              <option value="underline">Underline</option>
              <option value="strikethrough">Strikethrough</option>
            </select>
          </Row>
        </CollapsibleSection>
      ))}
    </>
  );
}

// ── Global CSS Panel ───────────────────────────────────────────────

function GlobalCSSPanel({
  style,
  onUpdate,
}: {
  style: BroadcastStyle;
  onUpdate: (p: Partial<BroadcastStyle>) => void;
}) {
  const insertSnippet = (snippet: string) => {
    const separator = style.globalCSS ? "\n\n" : "";
    onUpdate({ globalCSS: style.globalCSS + separator + snippet });
  };

  return (
    <div className="px-4 py-3">
      <span className="text-[11px] text-fg-3 block mb-2">Quick insert</span>
      <div className="flex flex-wrap gap-1 mb-3">
        {Object.entries(QUICK_INSERTS).map(([label, snippet]) => (
          <button
            key={label}
            type="button"
            onClick={() => insertSnippet(snippet)}
            className="h-7 px-2.5 text-[11px] font-mono text-fg-2 border border-line rounded hover:border-line-2 hover:text-fg transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        data-testid="global-css-editor"
        value={style.globalCSS}
        onChange={(e) => onUpdate({ globalCSS: e.target.value })}
        placeholder="/* Add custom CSS styles */&#10;p { color: red; }"
        rows={16}
        className="w-full bg-white/[0.03] border border-line rounded-md p-3 font-mono text-[12px] text-fg placeholder-[#444] resize-none outline-none focus:border-line-3 transition-colors leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}
