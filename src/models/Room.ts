import { Model } from '@nozbe/watermelondb';
import { field,  text } from '@nozbe/watermelondb/decorators';

class Room extends Model {
    static table = 'rooms';

    @field('room_id') roomId: any;

    @field('parent') parent: any;

    @text('name') name: any;

    @text('floors') floors: any;

    @text('landing_point') landingPoint: any;
}

export default Room;
