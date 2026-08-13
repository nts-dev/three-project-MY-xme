import { Model } from '@nozbe/watermelondb';
import { field,  text } from '@nozbe/watermelondb/decorators';

class UserChats extends Model {
    static table = 'user_chats';

    @field('user_id') userId: any;

    @text('text') text: any;

    @field('timestamp') timestamp: any;

    @text('user_name') userName: any;

    @text('is_command') isCommand: any;


}

export default UserChats;
