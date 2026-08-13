import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';

class Asset extends Model {
    static table = 'assets';

    @field('instance_id') instanceId: any;

    @text('category') category: any;

    @field('asset_id') assetId: any;

    @field('category_index') categoryIndex: any;

    @text('description') _description: any;

    @text('images') _images: any;

    @text('category_images') _categoryImages: any;

    get description() {
        return JSON.parse(this._description || '[]');
    }

    set description(descriptionArray) {
        this._description = JSON.stringify(descriptionArray);
    }

    get images() {
        return JSON.parse(this._images || '[]');
    }

    set images(imagesArray) {
        this._images = JSON.stringify(imagesArray);
    }

    get categoryImages() {
        return JSON.parse(this._categoryImages || '[]');
    }

    set categoryImages(categoryImagesArray) {
        this._categoryImages = JSON.stringify(categoryImagesArray);
    }
}

export default Asset;
