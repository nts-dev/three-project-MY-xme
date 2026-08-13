import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

class TemplateFiles extends Model {
    static table = 'template_files';

    @field('template_id') templateId: any;

    @field('asset_id') assetId: any;

    @text('asset_name') assetName: any;

    @text('fbx') fbx: any;

    @text('textures') textures: any;

}

export default TemplateFiles;
