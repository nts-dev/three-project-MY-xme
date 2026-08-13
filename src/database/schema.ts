import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'categories',
            columns: [
                { name: 'category_id', type: 'string', isIndexed: true  },
                { name: 'category_index', type: 'string' },
                { name: 'project_id', type: 'number' },
                { name: 'name', type: 'string' },
                { name: 'fbx', type: 'string' },
                { name: 'textures', type: 'string'},
                { name: 'instances', type: 'string'},
                { name: 'properties', type: 'string'},
                { name: 'default_color', type: 'string'},

            ],
        }),
        tableSchema({
            name: 'assets',
            columns: [
                { name: 'instance_id', type: 'number' },
                { name: 'category', type: 'string', isIndexed: true },
                { name: 'asset_id', type: 'number' },
                { name: 'category_index', type: 'number' },
                { name: 'description', type: 'string' },
                { name: 'images', type: 'string' },
                { name: 'category_images', type: 'string' },
            ]
        }),
        tableSchema({
            name: 'fields',
            columns: [
                { name: 'value_id', type: 'string', isIndexed: true },
                { name: 'instance_id', type: 'number', isIndexed: true },
                { name: 'field_id', type: 'number', isIndexed: true  },
                { name: 'name', type: 'string' },
                { name: 'description', type: 'string' },
                { name: 'type', type: 'string' },
                { name: 'value', type: 'string' },
                { name: 'readonly', type: 'string' },
                { name: 'visible', type: 'string' },
                { name: 'index_id', type: 'string' },
                { name: 'show_extra', type: 'number' },
            ]
        }),
        tableSchema({
            name: 'templates',
            columns: [
                { name: 'field_id', type: 'number', isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'parent_id', type: 'number'  },
                { name: 'type', type: 'string' },
                { name: 'description', type: 'string' },
                { name: 'category_id', type: 'string' },
                { name: 'viewer', type: 'string' },
                { name: 'index_id', type: 'string' },
                { name: 'project_id', type: 'string' },
            ]
        }),
        tableSchema({
            name: 'category_templates',
            columns: [
                { name: 'project_id', type: 'number', isIndexed: true },
                { name: 'category_value', type: 'string' },
            ]
        }),
        tableSchema({
            name: 'options',
            columns: [
                { name: 'field_id', type: 'number' },
                { name: 'name', type: 'string' },
                { name: 'parent_id', type: 'number'  },
                { name: 'value_id', type: 'number', isIndexed: true },
                { name: 'sort_id', type: 'number' },
            ]
        }),
        tableSchema({
            name: 'branches',
            columns: [
                { name: 'branch_id', type: 'number', isIndexed: true },
                { name: 'name', type: 'string' }
            ]
        }),
        tableSchema({
            name: 'rooms',
            columns: [
                { name: 'room_id', type: 'number', isIndexed: true },
                { name: 'parent', type: 'number', isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'floors', type: 'string' },
                { name: 'landing_point', type: 'string' },
            ]
        }),
        tableSchema({
            name: 'user_chats',
            columns: [
                { name: 'user_id', type: 'number', isIndexed: true },
                { name: 'text', type: 'string' },
                { name: 'timestamp', type: 'string' },
                { name: 'user_name', type: 'string' },
                { name: 'is_command', type: 'string' },

            ]
        }),
        tableSchema({
            name: 'template_files',
            columns: [
                { name: 'template_id', type: 'number', isIndexed: true },
                { name: 'asset_id', type: 'number' },
                { name: 'asset_name', type: 'string' },
                { name: 'fbx', type: 'string' },
                { name: 'textures', type: 'string' },

            ]
        }),
    ],
});
