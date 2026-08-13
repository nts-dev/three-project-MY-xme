import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';

class Category extends Model {
    static table = 'categories';

    @text('category_id') categoryId: any;

    @text('category_index') categoryIndex: any;

    @field('project_id') projectId: any;

    @text('name') name: any;

    @text('fbx') fbx: any;

    @text('textures') _textures: any;

    @text('instances') instances: any;

    @text('properties') properties: any;

    @text('default_color') defaultColor: any;


    get textures() {
        return JSON.parse(this._textures || '[]');
    }

    set textures(texturesArray) {
        this._textures = JSON.stringify(texturesArray);
    }
}

export default Category;
