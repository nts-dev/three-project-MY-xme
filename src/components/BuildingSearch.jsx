import React, { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import useGame from '../hooks/useGame';
import { sceneAssets } from '../threejs/player/puzzle/character/Constants';
import './BuildingSearch.css';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

export function findBuildingMatches(query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return Object.entries(sceneAssets).flatMap(([id, asset]) => {
        if (!asset?.position) return [];
        const metadata = asset.instanceData?.assetObject || {};
        const fields = Object.entries(metadata.fields || {}).map(([key, field]) => ({
            name: normalize(field?.name || key),
            value: String(field?.value ?? (typeof field === 'object' ? '' : field) ?? ''),
        }));
        const name = fields.find((field) => /^(company name|building name|assetname|name)$/.test(field.name) && field.value)?.value
            || metadata.description || asset.name || `Building ${id}`;
        const number = fields.find((field) => /^(building number|building no\.?)$/.test(field.name))?.value || '';
        const values = [id, name, number, metadata.description, ...fields.map((field) => field.value)].map(normalize);
        if (!terms.every((term) => values.some((value) => value.includes(term)))) return [];
        const exact = values.includes(normalize(query));
        return [{ id, name: String(name), number, exact }];
    }).sort((a, b) => Number(b.exact) - Number(a.exact) || a.name.localeCompare(b.name));
}

export default function BuildingSearch() {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState('');
    const [showResults, setShowResults] = useState(false);
    const setSearchItem = useGame((state) => state.setSearchItem);
    const setEditPopup = useGame((state) => state.setEditPopup);
    const matches = expanded ? findBuildingMatches(query) : [];

    const focus = (match) => {
        setSearchItem({ id: match.id, noZoom: false, view: 'building-front', requestId: Date.now() });
        setEditPopup(false);
        setMessage(`Viewing ${match.name}${match.number ? ` · ${match.number}` : ''}`);
        setShowResults(false);
    };
    const submit = (event) => {
        event.preventDefault();
        if (!query.trim()) return;
        const results = findBuildingMatches(query);
        if (results.length) focus(results[0]);
        else setMessage('No matching building found. Try a name or building number.');
    };

    return (
        <div className="building-search" onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') setExpanded(false);
        }}>
            <form className="building-search-bar" onSubmit={submit}>
                {expanded && <input autoFocus aria-label="Search building name or number" placeholder="Building name, number…"
                    value={query} onChange={(event) => { setQuery(event.target.value); setMessage(''); setShowResults(true); }}
                    onFocus={() => setShowResults(true)} />}
                <button type={expanded ? 'submit' : 'button'} aria-label={expanded ? 'Search and zoom to building' : 'Open building search'}
                    aria-expanded={expanded} title={expanded ? 'Search' : 'Search buildings'} onClick={() => { if (!expanded) setExpanded(true); }}>
                    <SearchIcon fontSize="small" />
                </button>
                {expanded && <button type="button" aria-label="Collapse building search" title="Collapse search" onClick={() => setExpanded(false)}><CloseIcon fontSize="small" /></button>}
            </form>
            {expanded && showResults && query.trim() && matches.length > 0 && <ul className="building-search-results" aria-label="Matching buildings">
                {matches.slice(0, 8).map((match) => <li key={match.id}><button type="button" onClick={() => focus(match)}>
                    <span>{match.name}</span><small>{match.number ? `Building ${match.number} · ` : ''}ID {match.id}</small>
                </button></li>)}
            </ul>}
            {expanded && message && <div className="building-search-message" role="status">{message}</div>}
        </div>
    );
}
