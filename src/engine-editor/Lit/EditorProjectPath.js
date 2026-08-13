import { LitElement, css, html } from 'lit';

class EditorProjectPath extends LitElement {
    static properties = {
        label: { type: String },
        path: { type: String },
    };

    static styles = css`
        :host {
            display: block;
            min-width: 0;
            color: #e9f7fb;
            font-family: Inter, Roboto, Arial, sans-serif;
        }

        .path-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 30px;
            padding: 0 9px;
            border-bottom: 1px solid rgba(106, 180, 196, 0.28);
            background: #1d5865;
            box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.04);
        }

        .label {
            flex: 0 0 auto;
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
            line-height: 1;
            text-transform: uppercase;
        }

        .path {
            min-width: 0;
            overflow: hidden;
            color: #a7c7cf;
            font-size: 12px;
            font-weight: 600;
            line-height: 1;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `;

    constructor() {
        super();
        this.label = 'Project';
        this.path = 'No project loaded';
    }

    render() {
        return html`
            <div class="path-bar">
                <span class="label">${this.label}</span>
                <span class="path" title=${this.path}>${this.path}</span>
            </div>
        `;
    }
}

if (!customElements.get('editor-project-path')) {
    customElements.define('editor-project-path', EditorProjectPath);
}
