import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

class CategoryTemplates extends Model {
    static table = 'category_templates';

    @field('project_id') projectId: any;

    @text('category_value') categoryValue: any;
}

export default CategoryTemplates;
