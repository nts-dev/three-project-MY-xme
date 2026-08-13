import React, { useMemo, useState } from "react";
import { flattenMenu } from "./systemBuilderUtils";

export default function SystemBuilderNativeSidebar({ menu }) {
    const [query, setQuery] = useState("");
    const items = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return flattenMenu(menu)
            .filter((item) => item.label && (!normalizedQuery || item.label.toLowerCase().includes(normalizedQuery)))
            .slice(0, 42);
    }, [menu, query]);

    return (
        <aside className="sb-native-sidebar">
            <div className="sb-native-sidebar__title">
                <span />
                <strong>System Builder</strong>
            </div>
            <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search model..."
            />
            <div className="sb-native-menu">
                {items.map((item) => (
                    <button
                        type="button"
                        key={`${item.id}-${item.path}`}
                        className={item.path?.includes("/system-builder/system/200") ? "is-active" : ""}
                        style={{ paddingLeft: 12 + item.depth * 14 }}
                    >
                        {item.depth > 0 ? <span aria-hidden="true">›</span> : null}
                        {item.label}
                    </button>
                ))}
            </div>
        </aside>
    );
}
