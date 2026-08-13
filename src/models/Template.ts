import {Model} from '@nozbe/watermelondb';
import { field,  text } from '@nozbe/watermelondb/decorators';

class Template extends Model {
    static table = 'templates';

    @field('field_id') fieldId: any;

    @text('name') name: any;

    @field('parent_id') parentId: any;

    @text('description') description: any;

    @text('type') type: any;

    @text('category_id') categoryId: any;

    @text('viewer') viewer: any;

    @text('index_id') indexId: any;

    @text('project_id') projectId: any;


}

export default Template;
