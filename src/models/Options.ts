import {Model} from '@nozbe/watermelondb';
import { field,  text } from '@nozbe/watermelondb/decorators';

class Options extends Model {
    static table = 'options';

    @field('field_id') fieldId: any;

    @text('name') name: any;

    @field('parent_id') parentId: any;

    @text('value_id') valueId: any;

    @text('sort_id') sortId: any;

}

export default Options;
