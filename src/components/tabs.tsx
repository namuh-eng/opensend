"use client";

interface Tab {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-0 border-b border-line">
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            data-state={isActive ? "active" : "inactive"}
            className={`px-4 py-2 text-[14px] font-medium transition-colors relative ${
              isActive ? "text-fg" : "text-fg-2 hover:text-fg"
            }`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
