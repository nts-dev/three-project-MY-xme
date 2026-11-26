import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiMagnifyingGlass, HiXMark } from 'react-icons/hi2';
import useGame from '../hooks/useGame';
import { sceneAssets } from '../threejs/player/puzzle/character/Constants';
import { getBusinessKind } from './popup/gui/playAssetInfo/businessKind';
import './BuildingSearch.css';

// Building search in the top bar: a field that lists matching buildings as you type (name, building
// number, business type, or another field such as the street), best matches first. Arrow keys and
// Enter pick one; the camera then flies to its front.

const normalize = (value) => String(value ?? '').trim().toLowerCase();
const MAX_RESULTS = 8;
const NAME_FIELDS = /^(company name|building name|assetname|name)$/;
const NUMBER_FIELDS = /^(building number|building no\.?)$/;
// Fields too technical to search or show.
const SKIP_FIELDS = /^(x-?pos|y-?pos|z-?pos|rotation|scale|id|uuid|image|images|photo|icon|color|colour|model|url|link)/;

const fieldList = (metadata) => Object.entries(metadata.fields || {}).map(([key, field]) => ({
    label: String(field?.name || key),
    key: normalize(field?.name || key),
    value: String(field?.value ?? (typeof field === 'object' ? '' : field) ?? ''),
}));

/** Search index of the scene's buildings (name, number, kind, searchable fields). */
function buildIndex() {
    return Object.entries(sceneAssets).flatMap(([id, asset]) => {
        if (!asset?.position) return [];
        const metadata = asset.instanceData?.assetObject || {};
        const fields = fieldList(metadata);
        const value = (test) => fields.find((field) => test.test(field.key) && field.value.trim())?.value || '';
        const number = value(NUMBER_FIELDS);
        // Units without a company name: by their number (not the 3D model's name, e.g.
        // "Malaysia Environment Buildings", which would also match unrelated searches).
        const letters = (text) => normalize(text).replace(/[^a-z0-9]/g, '');
        const modelName = letters(asset.name || metadata.name || '');
        const real = (text) => (text && letters(text) !== modelName && !/environmentbuildings/.test(letters(text)) ? text : '');
        const name = real(value(NAME_FIELDS)) || real(metadata.description) || (number ? `Building No. ${number}` : `Unit ${id}`);
        const kind = getBusinessKind(value(/^(business type|kind of business)$/), name, value(/^business description$/));
        const extra = fields.filter((field) => field.value.trim() && !NAME_FIELDS.test(field.key) && !NUMBER_FIELDS.test(field.key) && !SKIP_FIELDS.test(field.key));
        return [{ id, name: String(name), number: String(number), kind, extra, nameKey: normalize(name), numberKey: normalize(number) }];
    });
}

/**
 * Best matches first: the whole name or number, then names starting with the text, names with a
 * word starting with it, names containing it, the business type, and last other fields (shown with
 * the field they matched in). Every word typed must match somewhere.
 */
export function findBuildingMatches(query, index = buildIndex()) {
    const text = normalize(query);
    const terms = text.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const results = [];
    for (const item of index) {
        let score = 0;
        let via = null;
        if (item.nameKey === text || (item.numberKey && item.numberKey === text)) score = 100;
        else if (item.nameKey.startsWith(text)) score = 80;
        else if (item.numberKey && item.numberKey.startsWith(text)) score = 75;
        else if (terms.every((term) => item.nameKey.split(/[^a-z0-9]+/).some((word) => word.startsWith(term)))) score = 60;
        else if (item.nameKey.includes(text)) score = 45;
        else if (terms.every((term) => item.nameKey.includes(term) || item.numberKey.includes(term) || normalize(item.kind.label).includes(term))) score = 35;
        else {
            // Other fields: every word must match the name or one field (that field is shown).
            const field = item.extra.find((f) => terms.every((term) => normalize(f.value).includes(term) || item.nameKey.includes(term)));
            if (field) { score = 10; via = field; }
        }
        if (score) results.push({ ...item, score, via });
    }
    return results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** A short piece of a long field around the first match ("…build company providing…"). */
function excerpt(text, query) {
    const value = String(text).replace(/\s+/g, ' ');
    const at = normalize(value).indexOf(normalize(query).split(/\s+/)[0] || '');
    if (value.length <= 40 || at < 0) return value.slice(0, 40);
    const start = Math.max(0, at - 14);
    return `${start ? '…' : ''}${value.slice(start, start + 40)}${start + 40 < value.length ? '…' : ''}`;
}

/** The text with the first match of `query` wrapped in <mark>. */
function Highlight({ text, query }) {
    const at = normalize(text).indexOf(normalize(query));
    if (!query.trim() || at < 0) return text;
    const end = at + query.trim().length;
    return <>{text.slice(0, at)}<mark>{text.slice(at, end)}</mark>{text.slice(end)}</>;
}

export default function BuildingSearch() {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [message, setMessage] = useState('');
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const setSearchItem = useGame((state) => state.setSearchItem);
    const setEditPopup = useGame((state) => state.setEditPopup);

    // The index is built when the field is used (the scene's buildings can change between uses).
    const index = useMemo(() => (open ? buildIndex() : []), [open]);
    const matches = useMemo(() => (query.trim() ? findBuildingMatches(query, index) : []), [query, index]);
    const shown = matches.slice(0, MAX_RESULTS);
    useEffect(() => setActive(0), [query]);

    // Close the list on a click elsewhere.
    useEffect(() => {
        if (!open) return undefined;
        const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
        document.addEventListener('pointerdown', onPointer);
        return () => document.removeEventListener('pointerdown', onPointer);
    }, [open]);

    // "Viewing ..." fades after a few seconds.
    useEffect(() => {
        if (!message) return undefined;
        const timer = setTimeout(() => setMessage(''), 3500);
        return () => clearTimeout(timer);
    }, [message]);

    const focus = (match) => {
        setSearchItem({ id: match.id, noZoom: false, view: 'building-front', requestId: Date.now() });
        setEditPopup(false);
        setMessage(`Viewing ${match.name}`);
        setOpen(false);
        inputRef.current?.blur();
    };

    const onKeyDown = (event) => {
        event.stopPropagation(); // typing must not move the camera / avatar
        if (event.key === 'ArrowDown' && shown.length) {
            event.preventDefault();
            setOpen(true);
            setActive((value) => (value + 1) % shown.length);
        } else if (event.key === 'ArrowUp' && shown.length) {
            event.preventDefault();
            setActive((value) => (value - 1 + shown.length) % shown.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (shown[active]) focus(shown[active]);
        } else if (event.key === 'Escape') {
            if (query) setQuery('');
            else inputRef.current?.blur();
            setOpen(false);
        }
    };

    const listOpen = open && query.trim().length > 0;

    return (
        <div className={`building-search${listOpen ? ' is-open' : ''}`} ref={rootRef} onKeyDown={(event) => event.stopPropagation()}>
            <div className={`bsearch__bar${listOpen ? ' is-open' : ''}`} role="combobox" aria-expanded={listOpen} aria-haspopup="listbox" aria-owns="bsearch-results">
                <HiMagnifyingGlass className="bsearch__icon" aria-hidden="true" />
                <input
                    ref={inputRef}
                    className="bsearch__input"
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Search buildings by name, number or business"
                    aria-autocomplete="list"
                    aria-controls="bsearch-results"
                    aria-activedescendant={listOpen && shown[active] ? `bsearch-${shown[active].id}` : undefined}
                    placeholder="Search buildings"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setOpen(true); setMessage(''); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />
                {query && (
                    <button type="button" className="bsearch__clear" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                        <HiXMark aria-hidden="true" />
                    </button>
                )}
            </div>

            {listOpen && (
                <div className="bsearch__panel">
                    {shown.length > 0 ? (
                        <ul id="bsearch-results" className="bsearch__results" role="listbox" aria-label="Matching buildings">
                            {shown.map((match, i) => {
                                const { Icon, color, label } = match.kind;
                                return (
                                    <li key={match.id} id={`bsearch-${match.id}`} role="option" aria-selected={i === active}>
                                        <button
                                            type="button"
                                            className={`bsearch__item${i === active ? ' is-active' : ''}`}
                                            onMouseEnter={() => setActive(i)}
                                            onClick={() => focus(match)}
                                        >
                                            <span className="bsearch__badge" style={{ '--kind': color }}><Icon aria-hidden="true" /></span>
                                            <span className="bsearch__text">
                                                <span className="bsearch__name"><Highlight text={match.name} query={query} /></span>
                                                <span className="bsearch__meta">
                                                    {match.number && !match.name.startsWith('Building No.') ? `No. ${match.number} · ` : ''}{label}
                                                    {match.via && <> · {match.via.label}: <Highlight text={excerpt(match.via.value, query)} query={query} /></>}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="bsearch__empty">No buildings match “{query.trim()}”</p>
                    )}
                    {matches.length > 0 && (
                        <p className="bsearch__foot">
                            {matches.length > MAX_RESULTS ? `${MAX_RESULTS} of ${matches.length} · ` : ''}
                            <kbd>↑</kbd><kbd>↓</kbd> to choose · <kbd>Enter</kbd> to go
                        </p>
                    )}
                </div>
            )}

            {message && !listOpen && <div className="bsearch__toast" role="status">{message}</div>}
        </div>
    );
}
