import {Database} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Category from '../models/Category';
import Asset from '../models/Asset';
import Field from '../models/Field';
import schema from './schema';
import Branch from "../models/Branch";
import Room from "../models/Room";
import Template from "../models/Template";
import Options from "../models/Options";
import CategoryTemplates from "../models/CategoryTemplates";
import UserChats from "../models/UserChats";
import TemplateFiles from "../models/TemplateFiles";

const adapter = new LokiJSAdapter({
    dbName: 'project_3d_v35', // Optional, default is 'watermelon'
    schema,
    useWebWorker: false, // Recommended to be true, but can be false for simplicity
    extraLokiOptions: {
        autosave: true,
        autosaveInterval: 5000,
    },
    useIncrementalIndexedDB: true,
    onQuotaExceededError: (error) => {
        console.error('Quota exceeded error:', error);
    },
});

const database = new Database({
    adapter,
    modelClasses: [Category, Asset, Field, Branch, Room,Template,Options, CategoryTemplates,UserChats,TemplateFiles],
    actionsEnabled: true
});

export default database;
