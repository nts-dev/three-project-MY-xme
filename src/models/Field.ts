import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';

class Field extends Model {
    static table = 'fields';

    @text('value_id') valueId: any;

    @field('instance_id') instanceId: any;

    @field('field_id') fieldId: any;

    @text('name') name: any;

    @text('description') description: any;

    @text('type') type: any;

    @text('value') value: any;

    @text('read_only') readonly: any;

    @text('visible') visible: any;

    @text('index_id') indexId: any;

    @field('show_extra') showExtra: any;
}

export default Field;
