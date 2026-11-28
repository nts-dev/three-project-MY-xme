import { sceneAssets } from '../threejs/player/puzzle/character/Constants';
import { getBusinessKind } from './popup/gui/playAssetInfo/businessKind';

// Building search index (shared by the top bar search, BuildingSearch.jsx, and the route walk's
// From / To fields): the scene's buildings by name, building number, business type and their other
// searchable fields, best matches first.

const normalize = (value) => String(value ?? '').trim().toLowerCase();
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
export function buildIndex() {
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
        // The first real name: the Company Name before other name fields (a unit's "Name" field can
        // hold the model's name, which hid its company: "Girbau Southeast Asia" was only "Building No. 70").
        const names = [/^company name$/, NAME_FIELDS].flatMap((test) => fields.filter((field) => test.test(field.key)).map((field) => field.value.trim()));
        const name = names.map(real).find(Boolean) || real(metadata.description) || (number ? `Building No. ${number}` : `Unit ${id}`);
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
