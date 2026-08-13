import React from "react";

export default function PlayAssetDetails({ sections = [] }) {
    return (
        <div className="play-asset-info__details">
            {sections.map((section) => (
                <section key={section.title}>
                    <h3>{section.title}</h3>
                    <p>{section.content}</p>
                </section>
            ))}
        </div>
    );
}
